const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }],
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastMessage: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastMessageSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    readState: [{
      _id: false,
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      lastReadAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true, collection: 'conversations' }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
