const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
};

/**
 * Validate MongoDB ObjectId
 * @param {string} id
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
};

/**
 * Validate 6-digit OTP code
 * @param {string} otp
 * @returns {boolean}
 */
const isValidOTP = (otp) => {
  return typeof otp === 'string' && OTP_REGEX.test(otp.trim());
};

/**
 * Validate Create / Register User payload
 * @param {Object} data
 * @returns {{ isValid: boolean, error: string | null }}
 */
const validateCreateUser = (data = {}) => {
  const { firstName, lastName, email, password, roles, countryCode, phoneNumber } = data;

  if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 2) {
    return {
      isValid: false,
      error: 'First name is required and must be at least 2 characters long.',
    };
  }

  if (!lastName || typeof lastName !== 'string' || lastName.trim().length < 1) {
    return {
      isValid: false,
      error: 'Last name is required.',
    };
  }

  if (!email || !isValidEmail(email)) {
    return {
      isValid: false,
      error: 'A valid email address is required.',
    };
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 6) {
      return {
        isValid: false,
        error: 'Password must be at least 6 characters long.',
      };
    }
  }

  if (countryCode !== undefined && (typeof countryCode !== 'string' || countryCode.trim() === '')) {
    return {
      isValid: false,
      error: 'Country code must be a non-empty string (e.g. "+91").',
    };
  }

  if (phoneNumber !== undefined && phoneNumber !== null) {
    if (typeof phoneNumber !== 'string' || phoneNumber.trim().length < 4) {
      return {
        isValid: false,
        error: 'Phone number must be a valid string with at least 4 digits.',
      };
    }
  }

  if (roles !== undefined) {
    if (!Array.isArray(roles)) {
      return {
        isValid: false,
        error: 'Roles must be an array of MongoDB Role IDs.',
      };
    }

    for (const roleId of roles) {
      if (!isValidObjectId(roleId)) {
        return {
          isValid: false,
          error: `Invalid role ID format: "${roleId}". Must be a valid MongoDB ObjectId.`,
        };
      }
    }
  }

  return { isValid: true, error: null };
};

/**
 * Validate Login payload (Email or Phone number + Password)
 * @param {Object} data
 * @returns {{ isValid: boolean, error: string | null }}
 */
const validateLogin = (data = {}) => {
  const { identifier, email, phoneNumber, password } = data;
  const loginIdentifier = identifier || email || phoneNumber;

  if (!loginIdentifier || typeof loginIdentifier !== 'string' || loginIdentifier.trim() === '') {
    return {
      isValid: false,
      error: 'Email or phone number is required to log in.',
    };
  }

  if (!password || typeof password !== 'string' || password.trim() === '') {
    return {
      isValid: false,
      error: 'Password is required.',
    };
  }

  return { isValid: true, error: null };
};

/**
 * Validate Verify OTP payload
 * @param {Object} data
 * @returns {{ isValid: boolean, error: string | null }}
 */
const validateVerifyOtp = (data = {}) => {
  const { email, otp, type } = data;

  if (!email || !isValidEmail(email)) {
    return {
      isValid: false,
      error: 'A valid email address is required.',
    };
  }

  if (!otp || !isValidOTP(otp)) {
    return {
      isValid: false,
      error: 'A valid 6-digit OTP code is required.',
    };
  }

  if (type !== undefined && !['email_verification', 'forgot_password'].includes(type)) {
    return {
      isValid: false,
      error: 'Invalid OTP type. Allowed types: email_verification, forgot_password.',
    };
  }

  return { isValid: true, error: null };
};

/**
 * Validate Forgot Password payload
 * @param {Object} data
 * @returns {{ isValid: boolean, error: string | null }}
 */
const validateForgotPassword = (data = {}) => {
  const { email } = data;

  if (!email || !isValidEmail(email)) {
    return {
      isValid: false,
      error: 'A valid email address is required.',
    };
  }

  return { isValid: true, error: null };
};

/**
 * Validate Reset Password payload
 * @param {Object} data
 * @returns {{ isValid: boolean, error: string | null }}
 */
const validateResetPassword = (data = {}) => {
  const { email, otp, newPassword } = data;

  if (!email || !isValidEmail(email)) {
    return {
      isValid: false,
      error: 'A valid email address is required.',
    };
  }

  if (!otp || !isValidOTP(otp)) {
    return {
      isValid: false,
      error: 'A valid 6-digit OTP code is required.',
    };
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return {
      isValid: false,
      error: 'New password must be at least 6 characters long.',
    };
  }

  return { isValid: true, error: null };
};

/**
 * Validate a Role create / update payload.
 * @param {Object} data
 * @param {boolean} [isUpdate=false] - when true, every field is optional
 * @returns {{ isValid: boolean, error: string | null }}
 */
const validateRolePayload = (data = {}, isUpdate = false) => {
  const { name, description, permissions, isActive } = data;

  if (!isUpdate || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return {
        isValid: false,
        error: 'Role name is required and must be at least 2 characters long.',
      };
    }
    if (!/^[a-zA-Z0-9 _-]+$/.test(name.trim())) {
      return {
        isValid: false,
        error: 'Role name may only contain letters, numbers, spaces, hyphens and underscores.',
      };
    }
  }

  if (description !== undefined && typeof description !== 'string') {
    return { isValid: false, error: 'Description must be a string.' };
  }

  if (permissions !== undefined) {
    if (!Array.isArray(permissions) || permissions.some((p) => typeof p !== 'string' || !p.trim())) {
      return {
        isValid: false,
        error: 'Permissions must be an array of non-empty strings.',
      };
    }
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    return { isValid: false, error: 'isActive must be a boolean.' };
  }

  return { isValid: true, error: null };
};

/**
 * Validate Complete-Verification payload: { email, otp, newPassword? }
 * newPassword is optional (member may keep the admin-assigned one).
 * @param {Object} data
 * @returns {{ isValid: boolean, error: string | null }}
 */
const validateCompleteVerification = (data = {}) => {
  const { email, otp, newPassword } = data;

  if (!email || !isValidEmail(email)) {
    return { isValid: false, error: 'A valid email address is required.' };
  }
  if (!otp || !isValidOTP(otp)) {
    return { isValid: false, error: 'A valid 6-digit OTP code is required.' };
  }
  if (newPassword !== undefined && newPassword !== null && newPassword !== '') {
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return { isValid: false, error: 'New password must be at least 6 characters long.' };
    }
  }

  return { isValid: true, error: null };
};

module.exports = {
  isValidEmail,
  isValidObjectId,
  isValidOTP,
  validateCreateUser,
  validateLogin,
  validateVerifyOtp,
  validateForgotPassword,
  validateResetPassword,
  validateCompleteVerification,
  validateRolePayload,
};
