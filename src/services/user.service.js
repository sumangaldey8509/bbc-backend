const User = require('../models/user.model');
const ProfileDetails = require('../models/profileDetails.model');
const otpService = require('./otp.service');
const { validateCreateUser } = require('../utils/validator');

/** Build an Error the controller can map straight to an HTTP status. */
const httpError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

const joinYear = (userCreatedAt) => {
  const d = userCreatedAt ? new Date(userCreatedAt) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;
};

const withYearJoined = (profile, userCreatedAt) => {
  if (!profile) return profile;
  return { ...profile, yearJoined: joinYear(userCreatedAt) };
};

/**
 * Create (register) a new user.
 *
 * Validates and normalizes the payload, creates the user (the model's pre-save
 * hook hashes the password), then generates and sends a 6-digit email
 * verification OTP so the member can confirm their email.
 *
 * @param {Object} payload - firstName, lastName, email, password, countryCode?, phoneNumber?, roles?: [roleId]
 * @returns {Promise<User>} the created user (password excluded via toJSON transform)
 * @throws {Error} with `statusCode` 400 when the payload is invalid
 */
const createUser = async (payload = {}) => {
  const { firstName, lastName, email, password, countryCode, phoneNumber, roles } = payload;

  const validation = validateCreateUser({
    firstName,
    lastName,
    email,
    password,
    countryCode,
    phoneNumber,
    roles,
  });
  if (!validation.isValid) {
    throw httpError(validation.error, 400);
  }
  if (!password) {
    throw httpError('Password is required to create a user.', 400);
  }

  const user = await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    password,
    countryCode: countryCode ? countryCode.trim() : '+91',
    phoneNumber: phoneNumber ? phoneNumber.trim() : null,
    roles,
  });
  await user.populate('roles');

  // Kick off email verification (2-minute OTP). Non-fatal if email delivery
  // fails — the code is always logged server-side for development.
  await otpService.createAndSendOTP({
    email: user.email,
    type: 'email_verification',
    firstName: user.firstName,
  });

  return user;
};

/**
 * Get all users with their profile details attached.
 * @param {Object} filter
 * @returns {Promise<Array<Object>>}
 */
const getAllUsers = async (filter = {}) => {
  const users = await User.find(filter).populate('roles').sort({ createdAt: -1 }).lean();
  const userIds = users.map((u) => u._id);
  const profiles = await ProfileDetails.find({ userId: { $in: userIds } }).lean();
  const profileMap = new Map();
  profiles.forEach((p) => profileMap.set(String(p.userId), p));

  return users.map((u) => {
    const p = profileMap.get(String(u._id));
    return {
      ...u,
      profileDetails: p ? withYearJoined(p, u.createdAt) : null,
    };
  });
};

/**
 * Get user by ID with profile details attached.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const getUserById = async (id) => {
  const user = await User.findById(id).populate('roles').lean();
  if (!user) return null;
  const profile = await ProfileDetails.findOne({ userId: id }).lean();
  return {
    ...user,
    profileDetails: profile ? withYearJoined(profile, user.createdAt) : null,
  };
};

/**
 * Update user by ID
 * @param {string} id
 * @param {Object} updateData
 * @returns {Promise<Object|null>}
 */
const updateUserById = async (id, updateData) => {
  const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate('roles').lean();
  if (!user) return null;
  const profile = await ProfileDetails.findOne({ userId: id }).lean();
  return {
    ...user,
    profileDetails: profile ? withYearJoined(profile, user.createdAt) : null,
  };
};

/**
 * Delete user by ID
 * @param {string} id
 * @returns {Promise<User|null>}
 */
const deleteUserById = async (id) => {
  return await User.findByIdAndDelete(id);
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
};
