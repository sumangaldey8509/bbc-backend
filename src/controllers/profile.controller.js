const profileService = require('../services/profile.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const { isValidObjectId } = require('../utils/validator');

const asArray = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
};

/** Normalize an incoming profile payload to the model shape. */
const normalizeProfileInput = (body = {}) => {
  const out = {};
  const strings = [
    'designation', 'companyName', 'gstNumber',
    'state', 'city', 'avatar', 'coverImage', 'bio', 'website', 'officeAddress',
  ];
  for (const key of strings) {
    if (body[key] !== undefined) out[key] = String(body[key] ?? '').trim();
  }
  if (body.industry !== undefined) out.industry = asArray(body.industry);

  if (body.turnover !== undefined) {
    const n = Number(body.turnover);
    out.turnover = Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (body.turnoverUnit !== undefined) {
    const u = String(body.turnoverUnit).toLowerCase();
    out.turnoverUnit = ['k', 'l', 'cr'].includes(u) ? u : 'cr';
  }
  // `yearJoined` is server-derived from the account creation date — ignore client input.
  if (body.requirementDocs !== undefined) {
    out.requirementDocs = Array.isArray(body.requirementDocs)
      ? body.requirementDocs
          .filter((d) => d && d.title && d.publicLink)
          .map((d) => ({ title: String(d.title).trim(), publicLink: String(d.publicLink).trim() }))
      : [];
  }
  return out;
};

const withCompletion = (profile) => ({
  profile,
  completion: profileService.computeCompletion(profile),
  status: profile ? profile.status : 'draft',
  gate: profile && profile.status === 'approved' ? 'ok' : 'blocked',
});

/**
 * GET /api/profile/me — the caller's profile + completion + gate state.
 */
const getMyProfile = async (req, res) => {
  try {
    const profile = await profileService.getByUserId(req.user._id);
    return sendSuccess(res, withCompletion(profile), 'Profile retrieved.');
  } catch (error) {
    return sendError(res, 'Failed to load profile.', 500, error);
  }
};

/**
 * PUT /api/profile/me — create or update the caller's profile (draft save).
 */
const upsertMyProfile = async (req, res) => {
  try {
    const data = normalizeProfileInput(req.body);
    const profile = await profileService.upsertForUser(req.user._id, data);
    return sendSuccess(res, withCompletion(profile), 'Profile saved.');
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return sendError(res, messages.join(', '), 400, error);
    }
    return sendError(res, error.message || 'Failed to save profile.', error.statusCode || 500, error);
  }
};

/**
 * DELETE /api/profile/me/photo — remove the caller's avatar or cover.
 * Body: { kind: "avatar" | "cover" }
 */
const removeMyPhoto = async (req, res) => {
  try {
    const kind = String(req.body.kind || '').toLowerCase();
    const profile = await profileService.removePhoto(req.user, kind);
    return sendSuccess(res, withCompletion(profile), 'Photo removed.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to remove photo.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * POST /api/profile/me/submit — submit the caller's completed profile for review.
 */
const submitMyProfile = async (req, res) => {
  try {
    const profile = await profileService.submitForReview(req.user._id);
    return sendSuccess(
      res,
      withCompletion(profile),
      'Profile submitted for review. The secretariat has been notified.'
    );
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to submit profile.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * GET /api/profile/reviews — admin review queue.
 * Query: ?status=submitted,under_review,approved,rejected (comma-separated)
 */
const listReviews = async (req, res) => {
  try {
    const status = req.query.status
      ? String(req.query.status).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const profiles = await profileService.listForReview({ status });
    return sendSuccess(res, profiles, 'Review queue retrieved.');
  } catch (error) {
    return sendError(res, 'Failed to load review queue.', 500, error);
  }
};

/**
 * GET /api/profile/:userId — admin: full profile for one member.
 */
const getProfileForAdmin = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.userId)) {
      return sendError(res, 'Invalid user id.', 400);
    }
    const profile = await profileService.getForAdmin(req.params.userId);
    if (!profile) {
      return sendError(res, 'This member has not created a profile yet.', 404);
    }
    return sendSuccess(
      res,
      { ...profile, completion: profileService.computeCompletion(profile) },
      'Profile retrieved.'
    );
  } catch (error) {
    return sendError(res, 'Failed to load profile.', 500, error);
  }
};

/**
 * PATCH /api/profile/:userId/review — admin decision.
 * Body: { status: 'approved'|'rejected'|'under_review', note? }
 */
const reviewProfile = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.userId)) {
      return sendError(res, 'Invalid user id.', 400);
    }
    const { status, note } = req.body;
    const profile = await profileService.reviewProfile(req.params.userId, {
      status,
      note,
      reviewerId: req.user._id,
    });
    return sendSuccess(res, profile, `Profile ${status.replace('_', ' ')}.`);
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to review profile.',
      error.statusCode || 500,
      error
    );
  }
};

module.exports = {
  getMyProfile,
  upsertMyProfile,
  removeMyPhoto,
  submitMyProfile,
  listReviews,
  getProfileForAdmin,
  reviewProfile,
};
