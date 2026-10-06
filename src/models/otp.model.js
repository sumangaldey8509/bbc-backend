const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required for OTP'],
      trim: true,
      lowercase: true,
    },
    otp: {
      type: String,
      required: [true, 'OTP code is required'],
      trim: true,
      minlength: 6,
      maxlength: 6,
    },
    type: {
      type: String,
      enum: ['email_verification', 'forgot_password'],
      default: 'email_verification',
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from creation
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: MongoDB automatically removes documents when current time reaches expiresAt
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, type: 1 });

const Otp = mongoose.model('Otp', otpSchema);

module.exports = Otp;
