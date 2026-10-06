const crypto = require('crypto');
const Otp = require('../models/otp.model');
const emailService = require('./email.service');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Generate a cryptographically secure 6-digit OTP
 * @returns {string}
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Create an OTP record and send it via email
 * @param {Object} options
 * @param {string} options.email
 * @param {string} [options.type='email_verification']
 * @param {string} [options.firstName='User']
 * @returns {Promise<{ otp: string, expiresAt: Date }>}
 */
const createAndSendOTP = async ({ email, type = 'email_verification', firstName = 'User' }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const otpCode = generateOTP();
  const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000); // 2 minutes

  // Delete previous pending OTPs for this email and type
  await Otp.deleteMany({ email: normalizedEmail, type });

  // Save new OTP
  await Otp.create({
    email: normalizedEmail,
    otp: otpCode,
    type,
    expiresAt,
  });

  const subject =
    type === 'forgot_password'
      ? 'Password Reset OTP - Curated Table'
      : 'Verify Your Email - Curated Table';

  const title =
    type === 'forgot_password'
      ? 'Reset Your Password'
      : 'Verify Your Email Address';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #1a202c; text-align: center; margin-bottom: 8px;">Curated Table</h2>
      <h3 style="color: #2d3748; text-align: center; margin-top: 0;">${title}</h3>
      <p style="color: #4a5568; font-size: 15px;">Hello <strong>${firstName}</strong>,</p>
      <p style="color: #4a5568; font-size: 15px;">Your 6-digit verification code is:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5; background: #eef2ff; padding: 12px 24px; border-radius: 8px; border: 1px dashed #6366f1;">
          ${otpCode}
        </span>
      </div>
      <p style="color: #e53e3e; font-size: 14px; text-align: center; font-weight: 500;">
        ⏱️ This OTP is valid for 2 minutes only.
      </p>
      <p style="color: #718096; font-size: 13px; margin-top: 24px; border-top: 1px solid #edf2f7; padding-top: 16px;">
        If you did not request this code, please ignore this email.
      </p>
    </div>
  `;

  // Always log OTP in console for easy development and debugging
  logger.info(`[OTP Generated] For: ${normalizedEmail} | Type: ${type} | Code: ${otpCode} | Expires: ${expiresAt.toISOString()}`);

  try {
    if (config.email.user && config.email.pass) {
      await emailService.sendEmail({
        to: normalizedEmail,
        subject,
        text: `Your verification OTP is ${otpCode}. It is valid for 2 minutes.`,
        html,
      });
    } else {
      logger.warn('SMTP credentials not fully configured in .env. OTP was logged to console above.');
    }
  } catch (emailError) {
    logger.warn(`Could not deliver email to ${normalizedEmail}: ${emailError.message}. Use console OTP code for testing.`);
  }

  return { otp: otpCode, expiresAt };
};

/**
 * Verify an OTP code
 * @param {Object} options
 * @param {string} options.email
 * @param {string} options.otp
 * @param {string} [options.type='email_verification']
 * @param {boolean} [options.consume=true] - when false, a valid code is NOT deleted
 *        (used to "peek"-check a reset code before the password is actually changed)
 * @returns {Promise<boolean>}
 */
const verifyOTP = async ({ email, otp, type = 'email_verification', consume = true }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedOtp = otp.trim();

  const otpRecord = await Otp.findOne({
    email: normalizedEmail,
    otp: trimmedOtp,
    type,
  });

  if (!otpRecord) {
    throw new Error('Invalid OTP code. Please check and try again.');
  }

  if (new Date() > otpRecord.expiresAt) {
    // Delete expired record
    await Otp.deleteOne({ _id: otpRecord._id });
    throw new Error('OTP code has expired (valid for 2 minutes). Please request a new one.');
  }

  if (consume) {
    await Otp.deleteOne({ _id: otpRecord._id });
  }

  return true;
};

module.exports = {
  generateOTP,
  createAndSendOTP,
  verifyOTP,
};
