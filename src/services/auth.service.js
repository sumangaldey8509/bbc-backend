const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const otpService = require('./otp.service');
const emailService = require('./email.service');
const { passwordChangedEmail } = require('../utils/emailTemplates');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Generate JWT token for a user
 * @param {Object} user
 * @returns {string}
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      roles: user.roles,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
    }
  );
};

/**
 * Login with Email OR Phone Number + Password
 * @param {Object} credentials
 * @param {string} credentials.identifier - Email or Phone Number
 * @param {string} credentials.password
 * @returns {Promise<{ token: string, user: Object }>}
 */
const login = async ({ identifier, password }) => {
  const cleanIdentifier = identifier.trim();

  // Search by email or phone number
  const user = await User.findOne({
    $or: [
      { email: cleanIdentifier.toLowerCase() },
      { phoneNumber: cleanIdentifier },
    ],
  })
    .select('+password')
    .populate('roles');

  if (!user) {
    throw new Error('Invalid email/phone number or password.');
  }

  if (!user.isActive) {
    throw new Error('Your account has been deactivated. Please contact support.');
  }

  // Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid email/phone number or password.');
  }

  // Unverified members must confirm their email before their first sign-in.
  // Send a fresh code so the client can walk them straight into verification.
  if (!user.isEmailVerified) {
    await otpService.createAndSendOTP({
      email: user.email,
      type: 'email_verification',
      firstName: user.firstName,
    });
    throw Object.assign(
      new Error(
        'Please verify your email address to sign in. We just sent a 6-digit verification code to your email.'
      ),
      { statusCode: 403, code: 'EMAIL_NOT_VERIFIED', email: user.email }
    );
  }

  const token = generateToken(user);

  // Return user without password
  const userJson = user.toJSON();

  return { token, user: userJson };
};

/**
 * Check an email-verification OTP WITHOUT consuming it, so the client can then
 * offer an optional "set a new password" step. `completeEmailVerification`
 * actually spends the code and flips isEmailVerified.
 * @param {Object} options
 * @param {string} options.email
 * @param {string} options.otp
 * @returns {Promise<{ verified: true }>}
 */
const verifyEmailOTP = async ({ email, otp }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error('No user account found with this email address.');
  }

  await otpService.verifyOTP({
    email: normalizedEmail,
    otp,
    type: 'email_verification',
    consume: false,
  });

  return { verified: true };
};

/**
 * Finish first-time email verification: consumes the email-verification OTP,
 * sets isEmailVerified, and optionally sets a new password (member may instead
 * keep the password their administrator assigned).
 * @param {Object} options
 * @param {string} options.email
 * @param {string} options.otp
 * @param {string} [options.newPassword] - when provided, replaces the password
 * @returns {Promise<Object>} the updated user (with roles populated)
 */
const completeEmailVerification = async ({ email, otp, newPassword }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Spend the code for real.
  await otpService.verifyOTP({
    email: normalizedEmail,
    otp,
    type: 'email_verification',
    consume: true,
  });

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error('No user account found with this email address.');
  }

  user.isEmailVerified = true;

  const changingPassword = typeof newPassword === 'string' && newPassword.length > 0;
  if (changingPassword) {
    user.password = newPassword; // pre-save hook hashes it
  }

  await user.save();
  await user.populate('roles');

  if (changingPassword) {
    try {
      const { subject, text, html } = passwordChangedEmail({
        firstName: user.firstName,
        when: new Date(),
      });
      if (config.email.user && config.email.pass) {
        await emailService.sendEmail({ to: user.email, subject, text, html });
      }
    } catch (notifyError) {
      logger.warn(
        `Verification succeeded but the password-changed email to ${user.email} failed: ${notifyError.message}`
      );
    }
  }

  return user;
};

/**
 * Check a forgot-password OTP without consuming it, so the client can gate the
 * "enter new password" step. The code is actually spent by `resetPassword`.
 * @param {Object} options
 * @param {string} options.email
 * @param {string} options.otp
 * @returns {Promise<{ verified: true }>}
 */
const verifyForgotPasswordOTP = async ({ email, otp }) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error('No user account found with this email address.');
  }

  await otpService.verifyOTP({
    email: normalizedEmail,
    otp,
    type: 'forgot_password',
    consume: false,
  });

  return { verified: true };
};

/**
 * Resend OTP (Email verification or Forgot password)
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.type='email_verification']
 * @returns {Promise<{ expiresAt: Date }>}
 */
const resendOTP = async ({ email, type = 'email_verification' }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new Error('No user registered with this email address.');
  }

  return await otpService.createAndSendOTP({
    email: normalizedEmail,
    type,
    firstName: user.firstName,
  });
};

/**
 * Initiate Forgot Password (send 6-digit OTP)
 * @param {string} email
 * @returns {Promise<{ expiresAt: Date }>}
 */
const forgotPassword = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new Error('No user account found with this email address.');
  }

  return await otpService.createAndSendOTP({
    email: normalizedEmail,
    type: 'forgot_password',
    firstName: user.firstName,
  });
};

/**
 * Reset Password using OTP
 * @param {Object} options
 * @param {string} options.email
 * @param {string} options.otp
 * @param {string} options.newPassword
 * @returns {Promise<boolean>}
 */
const resetPassword = async ({ email, otp, newPassword }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Verify OTP
  await otpService.verifyOTP({
    email: normalizedEmail,
    otp,
    type: 'forgot_password',
  });

  // Find user
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error('User not found.');
  }

  // Update password (pre-save hook will hash it)
  user.password = newPassword;
  await user.save();

  // Notify the member their password changed (non-fatal on email failure).
  try {
    const { subject, text, html } = passwordChangedEmail({
      firstName: user.firstName,
      when: new Date(),
    });
    if (config.email.user && config.email.pass) {
      await emailService.sendEmail({ to: user.email, subject, text, html });
    } else {
      logger.warn(
        `SMTP not configured — password-changed notification for ${user.email} was not sent.`
      );
    }
  } catch (notifyError) {
    logger.warn(
      `Password reset succeeded but the confirmation email to ${user.email} failed: ${notifyError.message}`
    );
  }

  return true;
};

module.exports = {
  generateToken,
  login,
  verifyEmailOTP,
  completeEmailVerification,
  verifyForgotPasswordOTP,
  resendOTP,
  forgotPassword,
  resetPassword,
};
