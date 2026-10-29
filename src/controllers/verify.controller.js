const { FORMAT, kyc, mark, sendOtp, checkOtp } = require('../utils/verify');
const { sendSuccess, sendError } = require('../helpers/response.helper');

const handleVerification = async (req, res) => {
  try {
    const { action, type, value, code } = req.body || {};

    if (action === 'kyc') {
      if (!type || !FORMAT[type] || !FORMAT[type].test(value)) {
        return sendError(res, `Invalid ${type ? type.toUpperCase() : 'identity'} format.`, 400);
      }

      const r = await kyc(type, value);
      if (r.verified) {
        await mark(type, value);
      }
      return sendSuccess(res, { verified: r.verified, name: r.name, address: r.address });
    }

    if (action === 'otp-send') {
      if (!type || !value) {
        return sendError(res, 'Type and value are required to send OTP.', 400);
      }
      await sendOtp(type, value);
      return sendSuccess(res, { sent: true }, 'Verification OTP sent successfully.');
    }

    if (action === 'otp-check') {
      if (!type || !value || !code) {
        return sendError(res, 'Type, value, and code are required to verify OTP.', 400);
      }
      await checkOtp(type, value, code);
      return sendSuccess(res, { verified: true }, 'OTP verified successfully.');
    }

    return sendError(res, 'Invalid verification action specified.', 400);
  } catch (error) {
    return sendError(res, error.message || 'Verification operation failed.', 400, error);
  }
};

module.exports = {
  handleVerification,
};
