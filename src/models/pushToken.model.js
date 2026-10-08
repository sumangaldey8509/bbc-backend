const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios'],
      required: true,
      index: true,
    },
    deviceName: {
      type: String,
      trim: true,
      default: '',
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, collection: 'push_tokens' }
);

pushTokenSchema.index({ user: 1, platform: 1, active: 1 });

module.exports = mongoose.model('PushToken', pushTokenSchema);
