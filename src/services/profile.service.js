const ProfileDetails = require('../models/profileDetails.model');
const User = require('../models/user.model');
const Role = require('../models/role.model');
const emailService = require('./email.service');
const { destroy } = require('../lib/cloudinary');
const { userFolderSlug } = require('../utils/slug');
const industryService = require('./industry.service');
const locationService = require('./location.service');
const {
  profileSubmittedForReviewEmail,
  profileReviewedEmail,
} = require('../utils/emailTemplates');
const config = require('../config');
const logger = require('../utils/logger');

const PHOTO_FIELDS = {
  avatar: { field: 'avatar', stamp: 'avatarUpdatedAt', publicId: 'avatar' },
  cover: { field: 'coverImage', stamp: 'coverImageUpdatedAt', publicId: 'cover' },
};

/**
 * Fields that MUST be filled before a profile can be submitted for review.
 * (Profile photo and cover image are encouraged but not blocking. `yearJoined`
 * is derived from the User's creation date, not entered by the member.)
 */
const REQUIRED_FIELDS = [
  'designation',
  'companyName',
  'industry',
  'state',
  'city',
  'gstNumber',
  'turnover',
  'bio',
  'officeAddress',
];

/**
 * Every field that contributes to the profile-completion percentage — the
 * required set plus the optional-but-recommended ones (website, photo, cover).
 */
const COMPLETION_FIELDS = [...REQUIRED_FIELDS, 'website', 'avatar', 'coverImage'];

const isFilled = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null;
};

/**
 * @param {Object|null} profile
 * @returns {{ percent, filled, total, missing, missingRequired, canSubmit }}
 *  - `percent`/`missing` cover every completion field (incl. photo & cover)
 *  - `missingRequired`/`canSubmit` cover only the fields that block submission
 */
const computeCompletion = (profile) => {
  const total = COMPLETION_FIELDS.length;
  const p = profile || {};

  const missing = COMPLETION_FIELDS.filter((field) => !isFilled(p[field]));
  const missingRequired = REQUIRED_FIELDS.filter((field) => !isFilled(p[field]));
  const filled = total - missing.length;

  return {
    percent: Math.round((filled / total) * 100),
    filled,
    total,
    missing,
    missingRequired,
    canSubmit: missingRequired.length === 0,
  };
};

const httpError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

/** Year the member joined = year their User account was created. */
const joinYear = (userCreatedAt) => {
  const d = userCreatedAt ? new Date(userCreatedAt) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;
};

/** Overlay the derived `yearJoined` on a plain profile object. */
const withYearJoined = (profile, userCreatedAt) => {
  if (!profile) return profile;
  return { ...profile, yearJoined: joinYear(userCreatedAt) };
};

/** Get a user's profile with the derived join year, or null. */
const getByUserId = async (userId) => {
  const [profile, user] = await Promise.all([
    ProfileDetails.findOne({ userId }).lean(),
    User.findById(userId).select('createdAt').lean(),
  ]);
  return withYearJoined(profile, user && user.createdAt);
};

/**
 * Create or update the caller's profile. Editing a rejected profile moves it
 * back to draft; an approved profile stays approved (post-approval maintenance).
 * @param {string} userId
 * @param {Object} data - whitelisted profile fields
 * @returns {Promise<Object>}
 */
const upsertForUser = async (userId, data) => {
  const [existing, user] = await Promise.all([
    ProfileDetails.findOne({ userId }),
    User.findById(userId).select('createdAt').lean(),
  ]);

  // `yearJoined` is derived from the account creation date — never client input.
  const allowed = [
    'designation', 'companyName', 'industry', 'state', 'city', 'gstNumber',
    'turnover', 'turnoverUnit', 'avatar', 'coverImage', 'bio',
    'requirementDocs', 'website', 'officeAddress',
  ];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }

  // Stamp photo timestamps when a new URL comes in.
  const prevAvatar = existing ? existing.avatar : '';
  const prevCover = existing ? existing.coverImage : '';
  if (update.avatar !== undefined && update.avatar && update.avatar !== prevAvatar) {
    update.avatarUpdatedAt = new Date();
  }
  if (update.coverImage !== undefined && update.coverImage && update.coverImage !== prevCover) {
    update.coverImageUpdatedAt = new Date();
  }

  // Keep the taxonomy usage counts in sync (non-fatal).
  const reconcileCatalogues = async () => {
    try {
      if (update.industry !== undefined) {
        const before = new Set((existing ? existing.industry : []).map((s) => s.toLowerCase()));
        const after = new Set(update.industry.map((s) => s.toLowerCase()));
        const added = update.industry.filter((s) => !before.has(s.toLowerCase()));
        const removed = (existing ? existing.industry : []).filter((s) => !after.has(s.toLowerCase()));
        await industryService.applyUsageDelta(added, removed);
      }

      const prevCity = existing ? { state: existing.state, city: existing.city } : { state: '', city: '' };
      const nextCity = {
        state: update.state !== undefined ? update.state : prevCity.state,
        city: update.city !== undefined ? update.city : prevCity.city,
      };
      const changed =
        nextCity.state.toLowerCase() !== (prevCity.state || '').toLowerCase() ||
        nextCity.city.toLowerCase() !== (prevCity.city || '').toLowerCase();
      if (changed) {
        if (prevCity.city) await locationService.bumpCityUsage(prevCity.state, prevCity.city, -1);
        if (nextCity.city) await locationService.bumpCityUsage(nextCity.state, nextCity.city, 1);
      }
    } catch (err) {
      logger.warn(`Location/industry catalogue sync failed: ${err.message}`);
    }
  };

  if (!existing) {
    const created = await ProfileDetails.create({ userId, ...update, status: 'draft' });
    await reconcileCatalogues();
    return withYearJoined(created.toJSON(), user && user.createdAt);
  }

  await reconcileCatalogues();
  Object.assign(existing, update);
  if (existing.status === 'rejected') {
    existing.status = 'draft';
    existing.reviewNote = '';
  }
  await existing.save();
  return withYearJoined(existing.toJSON(), user && user.createdAt);
};

/**
 * Remove a member's profile photo or cover — clears it in Mongo and deletes the
 * asset from Cloudinary.
 * @param {Object} user - the authenticated user doc (needs firstName/lastName/_id)
 * @param {'avatar'|'cover'} kind
 * @returns {Promise<Object>}
 */
const removePhoto = async (user, kind) => {
  const meta = PHOTO_FIELDS[kind];
  if (!meta) throw httpError('kind must be "avatar" or "cover".', 400);

  const profile = await ProfileDetails.findOne({ userId: user._id });
  if (!profile || !profile[meta.field]) {
    throw httpError('There is no photo to remove.', 404);
  }

  // Delete from Cloudinary (deterministic public id for avatar/cover).
  const publicId = `${config.cloudinary.folder}/users/${userFolderSlug(user)}/${meta.publicId}`;
  await destroy(publicId, { resourceType: 'image' });

  profile[meta.field] = '';
  profile[meta.stamp] = null;
  if (profile.status === 'rejected') {
    profile.status = 'draft';
    profile.reviewNote = '';
  }
  await profile.save();
  return withYearJoined(profile.toJSON(), user.createdAt);
};

/** Users holding the `admin` role (id + email + name). */
const getAdminRecipients = async () => {
  const adminRole = await Role.findOne({ name: 'admin' });
  if (!adminRole) return [];
  return User.find({ roles: adminRole._id, isActive: true }).select('firstName lastName email').lean();
};

/**
 * Submit the caller's profile for admin review. Requires 100% completion.
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const submitForReview = async (userId) => {
  const [profile, member] = await Promise.all([
    ProfileDetails.findOne({ userId }),
    User.findById(userId).select('firstName lastName email createdAt').lean(),
  ]);
  if (!profile) {
    throw httpError('Add your profile details before submitting for review.', 400);
  }

  const completion = computeCompletion(profile.toObject());
  if (!completion.canSubmit) {
    const labels = completion.missingRequired.join(', ');
    throw httpError(`Fill every required field before submitting. Still needed: ${labels}.`, 400);
  }

  if (profile.status === 'approved') {
    throw httpError('Your profile is already approved.', 409);
  }

  profile.status = 'submitted';
  profile.submittedAt = new Date();
  profile.reviewedAt = null;
  profile.reviewedBy = null;
  profile.reviewNote = '';
  await profile.save();

  // Notify admins (non-fatal).
  try {
    const admins = await getAdminRecipients();
    if (config.email.user && config.email.pass && admins.length) {
      const memberName = member
        ? `${member.firstName} ${member.lastName}`.trim()
        : 'A member';
      await Promise.all(
        admins.map((admin) => {
          const { subject, text, html } = profileSubmittedForReviewEmail({
            adminName: admin.firstName,
            memberName,
            memberEmail: member ? member.email : '',
          });
          return emailService.sendEmail({ to: admin.email, subject, text, html });
        })
      );
    } else if (!admins.length) {
      logger.warn('Profile submitted but no active admin users found to notify.');
    }
  } catch (notifyError) {
    logger.warn(`Profile submitted but admin notification failed: ${notifyError.message}`);
  }

  return withYearJoined(profile.toJSON(), member && member.createdAt);
};

/**
 * Admin review action.
 * @param {string} userId - whose profile
 * @param {Object} options
 * @param {'approved'|'rejected'|'under_review'} options.status
 * @param {string} [options.note]
 * @param {string} options.reviewerId
 * @returns {Promise<Object>}
 */
const reviewProfile = async (userId, { status, note = '', reviewerId }) => {
  if (!['approved', 'rejected', 'under_review'].includes(status)) {
    throw httpError('status must be one of: approved, rejected, under_review.', 400);
  }

  const profile = await ProfileDetails.findOne({ userId });
  if (!profile) {
    throw httpError('This member has not created a profile yet.', 404);
  }
  if (profile.status === 'draft') {
    throw httpError('This profile has not been submitted for review yet.', 400);
  }
  if (status === 'rejected' && !note.trim()) {
    throw httpError('A reason is required when rejecting a profile.', 400);
  }

  profile.status = status;
  profile.reviewNote = note.trim();
  profile.reviewedAt = new Date();
  profile.reviewedBy = reviewerId;
  await profile.save();

  const member = await User.findById(userId).select('firstName email createdAt').lean();

  // Notify the member (non-fatal).
  try {
    if (member && config.email.user && config.email.pass) {
      const { subject, text, html } = profileReviewedEmail({
        firstName: member.firstName,
        status,
        note: note.trim(),
      });
      await emailService.sendEmail({ to: member.email, subject, text, html });
    }
  } catch (notifyError) {
    logger.warn(`Profile review saved but member notification failed: ${notifyError.message}`);
  }

  return withYearJoined(profile.toJSON(), member && member.createdAt);
};

/**
 * List profiles for the admin review queue.
 * @param {Object} [options]
 * @param {string|string[]} [options.status] - defaults to submitted + under_review
 * @returns {Promise<Array>}
 */
const listForReview = async ({ status } = {}) => {
  const statuses = status
    ? (Array.isArray(status) ? status : [status])
    : ['submitted', 'under_review'];

  const rows = await ProfileDetails.find({ status: { $in: statuses } })
    .sort({ submittedAt: -1, updatedAt: -1 })
    .populate('userId', 'firstName lastName email countryCode phoneNumber roles isActive createdAt')
    .populate('reviewedBy', 'firstName lastName')
    .lean();

  return rows.map((row) => withYearJoined(row, row.userId && row.userId.createdAt));
};

/** Full profile for a single member, with user info (admin view). */
const getForAdmin = async (userId) => {
  const row = await ProfileDetails.findOne({ userId })
    .populate('userId', 'firstName lastName email countryCode phoneNumber roles isActive isEmailVerified createdAt')
    .populate('reviewedBy', 'firstName lastName')
    .lean();

  return withYearJoined(row, row && row.userId && row.userId.createdAt);
};

module.exports = {
  REQUIRED_FIELDS,
  COMPLETION_FIELDS,
  computeCompletion,
  getByUserId,
  upsertForUser,
  removePhoto,
  submitForReview,
  reviewProfile,
  listForReview,
  getForAdmin,
};
