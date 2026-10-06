const authService = require('../services/auth.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');
const {
  validateLogin,
  validateVerifyOtp,
  validateForgotPassword,
  validateResetPassword,
  validateCompleteVerification,
} = require('../utils/validator');

/**
 * Login with Email OR Phone Number + Password
 */
const login = async (req, res) => {
  try {
    const { identifier, email, phoneNumber, password } = req.body;
    const loginIdentifier = identifier || email || phoneNumber;

    const validation = validateLogin({ identifier: loginIdentifier, password });
    if (!validation.isValid) {
      return sendError(res, validation.error, 400);
    }

    const result = await authService.login({
      identifier: loginIdentifier,
      password,
    });

    return sendSuccess(res, result, 'Login successful.');
  } catch (error) {
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({
        success: false,
        message: error.message,
        code: 'EMAIL_NOT_VERIFIED',
        email: error.email,
      });
    }
    const status = error.message.includes('Invalid') ? 401 : error.message.includes('deactivated') ? 403 : 500;
    return sendError(res, error.message || 'Login failed.', status, error);
  }
};

/**
 * Check a 6-digit OTP WITHOUT consuming it (so the client can gate a next step).
 * Body: { email, otp, type?: 'email_verification' | 'forgot_password' }
 * - forgot_password  -> code is spent later by /reset-password
 * - email_verification -> code is spent later by /complete-verification
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp, type = 'email_verification' } = req.body;

    const validation = validateVerifyOtp({ email, otp, type });
    if (!validation.isValid) {
      return sendError(res, validation.error, 400);
    }

    const result =
      type === 'forgot_password'
        ? await authService.verifyForgotPasswordOTP({ email, otp })
        : await authService.verifyEmailOTP({ email, otp });

    const message =
      type === 'forgot_password'
        ? 'Reset code verified. You can now set a new password.'
        : 'Verification code confirmed. Continue to finish verifying your email.';

    return sendSuccess(res, result, message);
  } catch (error) {
    const status = error.message && error.message.includes('No user account') ? 404 : 400;
    return sendError(res, error.message || 'OTP verification failed.', status, error);
  }
};

/**
 * Finish first-time email verification.
 * Body: { email, otp, newPassword? }
 * Consumes the email-verification OTP, sets isEmailVerified, and (optionally)
 * changes the password. Returns the updated user.
 */
const completeVerification = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const validation = validateCompleteVerification({ email, otp, newPassword });
    if (!validation.isValid) {
      return sendError(res, validation.error, 400);
    }

    const user = await authService.completeEmailVerification({
      email,
      otp,
      newPassword: newPassword || undefined,
    });

    return sendSuccess(
      res,
      user,
      newPassword
        ? 'Email verified and password updated. You can now sign in.'
        : 'Email verified. You can now sign in with your existing password.'
    );
  } catch (error) {
    const status = error.message && error.message.includes('No user account') ? 404 : 400;
    return sendError(res, error.message || 'Verification failed.', status, error);
  }
};

/**
 * Resend 6-digit OTP
 */
const resendOtp = async (req, res) => {
  try {
    const { email, type = 'email_verification' } = req.body;

    if (!email) {
      return sendError(res, 'Email address is required to resend OTP.', 400);
    }

    const result = await authService.resendOTP({ email, type });
    const label = type === 'forgot_password' ? 'password reset code' : 'verification code';
    return sendSuccess(
      res,
      { expiresAt: result.expiresAt },
      `A new 6-digit ${label} has been sent to your email (valid for 2 minutes).`
    );
  } catch (error) {
    const status = error.message.includes('No user registered') ? 404 : 400;
    return sendError(res, error.message || 'Failed to resend OTP.', status, error);
  }
};

/**
 * Initiate Forgot Password (send reset OTP)
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const validation = validateForgotPassword({ email });
    if (!validation.isValid) {
      return sendError(res, validation.error, 400);
    }

    const result = await authService.forgotPassword(email);
    return sendSuccess(
      res,
      { expiresAt: result.expiresAt },
      'Password reset code has been sent to your email (valid for 2 minutes).'
    );
  } catch (error) {
    const status = error.message.includes('No user account') ? 404 : 400;
    return sendError(res, error.message || 'Failed to process forgot password request.', status, error);
  }
};

/**
 * Reset Password using 6-digit OTP
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const validation = validateResetPassword({ email, otp, newPassword });
    if (!validation.isValid) {
      return sendError(res, validation.error, 400);
    }

    await authService.resetPassword({ email, otp, newPassword });
    return sendSuccess(res, null, 'Password has been successfully reset. You can now log in with your new password.');
  } catch (error) {
    return sendError(res, error.message || 'Failed to reset password.', 400, error);
  }
};

/**
 * Logout
 */
const logout = async (req, res) => {
  // With stateless JWT, client deletes token; server confirms logout
  return sendSuccess(res, null, 'Logged out successfully.');
};

/**
 * Get Profile of Logged-in User (Excluding password)
 */
const getMe = async (req, res) => {
  try {
    // req.user populated by authenticate middleware
    return sendSuccess(res, req.user, 'Current user profile retrieved successfully.');
  } catch (error) {
    return sendError(res, 'Failed to retrieve profile.', 500, error);
  }
};

module.exports = {
  login,
  verifyOtp,
  completeVerification,
  resendOtp,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
};
