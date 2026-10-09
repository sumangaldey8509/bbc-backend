const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const ProfileDetails = require('../models/profileDetails.model');
const { broadcastFeedEvent, broadcastPrivateMessageChanged } = require('./realtime.service');
const { sendToUser } = require('./pushNotification.service');

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const assertObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw httpError(`Invalid ${label}.`, 400);
};

const participantKey = (a, b) => [String(a), String(b)].sort().join(':');

const serializeMessage = (message, userId) => {
  const deliveredAt = message.deliveredAt || null;
  const seenAt = message.seenAt || null;
  return {
    id: String(message._id),
    threadId: String(message.conversation),
    senderId: String(message.sender),
    text: message.text,
    createdAt: message.createdAt,
    deliveredAt,
    seenAt,
    receiptStatus: seenAt ? 'seen' : deliveredAt ? 'delivered' : 'sent',
    isMe: String(message.sender) === String(userId),
  };
};

const notifyUsers = async (userIds) => {
  const uniqueUserIds = [...new Set(userIds.map(String))];
  await Promise.allSettled(
    uniqueUserIds.map((userId) => broadcastPrivateMessageChanged(userId))
  );
};

const createRealtimeToken = (userId) => {
  if (!config.supabase.jwtSecret) {
    throw httpError('Supabase private messaging is not configured.', 503);
  }
  const topic = `user:${String(userId)}:messages`;
  const token = jwt.sign(
    {
      sub: String(userId),
      role: 'authenticated',
      aud: 'authenticated',
      realtime_topic: topic,
    },
    config.supabase.jwtSecret,
    { algorithm: 'HS256', expiresIn: '10m' }
  );
  return { token, topic, expiresInSeconds: 600 };
};

const assertMembership = async (threadId, userId) => {
  assertObjectId(threadId, 'conversation ID');
  const thread = await Conversation.findOne({ _id: threadId, participants: userId });
  if (!thread) throw httpError('Conversation not found.', 404);
  return thread;
};

const getMemberCards = async (ids) => {
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: ids }, isActive: true }).select('firstName lastName email').lean(),
    ProfileDetails.find({ userId: { $in: ids } }).select('userId avatar designation companyName city state').lean(),
  ]);
  const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));
  return new Map(users.map((user) => {
    const profile = profileMap.get(String(user._id));
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Council Member';
    return [String(user._id), {
      id: String(user._id),
      name,
      email: user.email,
      avatar: profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D1B2A&color=fff&bold=true`,
      designation: profile?.designation || 'Executive Member',
      companyName: profile?.companyName || 'Bengal Business Council',
      location: [profile?.city, profile?.state].filter(Boolean).join(', '),
    }];
  }));
};

const listThreads = async (userId) => {
  const threads = await Conversation.find({ participants: userId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();
  const otherIds = threads.flatMap((thread) =>
    thread.participants.filter((id) => String(id) !== String(userId))
  );
  const members = await getMemberCards(otherIds);

  return Promise.all(threads.map(async (thread) => {
    const otherId = thread.participants.find((id) => String(id) !== String(userId));
    const read = thread.readState?.find((entry) => String(entry.user) === String(userId));
    const unreadCount = await Message.countDocuments({
      conversation: thread._id,
      sender: { $ne: userId },
      status: 'sent',
      createdAt: { $gt: read?.lastReadAt || new Date(0) },
    });
    return {
      id: String(thread._id),
      participant: members.get(String(otherId)),
      lastMessage: thread.lastMessage || 'Start the conversation',
      lastMessageAt: thread.lastMessageAt || thread.createdAt,
      unreadCount,
    };
  }));
};

const getOrCreateThread = async (userId, otherUserId) => {
  assertObjectId(otherUserId, 'participant ID');
  if (String(userId) === String(otherUserId)) throw httpError('You cannot message yourself.', 400);
  const other = await User.findOne({ _id: otherUserId, isActive: true }).select('_id').lean();
  if (!other) throw httpError('Member not found.', 404);

  const key = participantKey(userId, otherUserId);
  let thread = await Conversation.findOne({ participantKey: key });
  if (!thread) {
    try {
      thread = await Conversation.create({
        participants: [userId, otherUserId],
        participantKey: key,
        readState: [
          { user: userId, lastReadAt: new Date() },
          { user: otherUserId, lastReadAt: new Date(0) },
        ],
      });
    } catch (error) {
      if (error.code === 11000) thread = await Conversation.findOne({ participantKey: key });
      else throw error;
    }
  }
  const members = await getMemberCards([otherUserId]);
  return {
    id: String(thread._id),
    participant: members.get(String(otherUserId)),
    lastMessage: thread.lastMessage || 'Start the conversation',
    lastMessageAt: thread.lastMessageAt || thread.createdAt,
    unreadCount: 0,
  };
};

const getMessages = async (threadId, userId, { page = 1, limit = 50 } = {}) => {
  await assertMembership(threadId, userId);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;
  const [items, total] = await Promise.all([
    Message.find({ conversation: threadId, status: 'sent' })
      .sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Message.countDocuments({ conversation: threadId, status: 'sent' }),
  ]);
  return {
    items: items.reverse().map((message) => serializeMessage(message, userId)),
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      hasMore: skip + items.length < total,
    },
  };
};

const sendMessage = async (threadId, userId, text) => {
  const thread = await assertMembership(threadId, userId);
  if (!text || !text.trim()) throw httpError('Message cannot be empty.', 400);
  if (text.trim().length > 2000) throw httpError('Message cannot exceed 2000 characters.', 400);
  const createdAt = new Date();
  const message = await Message.create({ conversation: threadId, sender: userId, text: text.trim() });
  thread.lastMessage = message.text;
  thread.lastMessageAt = createdAt;
  thread.lastMessageSender = userId;
  const ownRead = thread.readState.find((entry) => String(entry.user) === String(userId));
  if (ownRead) ownRead.lastReadAt = createdAt;
  else thread.readState.push({ user: userId, lastReadAt: createdAt });
  await thread.save();
  await notifyUsers(thread.participants);
  const recipientId = thread.participants.find((participantId) => String(participantId) !== String(userId));

  // Broadcast realtime new_message event over Supabase
  void broadcastFeedEvent('new_message', {
    threadId: String(thread._id),
    senderId: String(userId),
    recipientId: recipientId ? String(recipientId) : null,
    participants: thread.participants.map(String),
    message: {
      id: String(message._id),
      threadId: String(thread._id),
      senderId: String(userId),
      text: message.text,
      createdAt: message.createdAt,
      deliveredAt: message.deliveredAt || null,
      seenAt: message.seenAt || null,
      receiptStatus: 'sent',
    },
    lastMessage: message.text,
    lastMessageAt: createdAt,
  });

  if (recipientId) {
    try {
      const members = await getMemberCards([userId]);
      const sender = members.get(String(userId));
      await sendToUser(recipientId, {
        title: sender?.name || 'New BBC message',
        body: message.text,
        data: {
          type: 'message',
          threadId: String(thread._id),
          senderId: String(userId),
        },
      });
    } catch (_) {
      // Message delivery must not fail if the optional push notification cannot be sent.
    }
  }
  return serializeMessage(message, userId);
};

/** Mark every pending message that has reached this member's active app as delivered. */
const markMessagesDelivered = async (userId) => {
  const threads = await Conversation.find({ participants: userId }).select('_id').lean();
  const threadIds = threads.map((thread) => thread._id);
  if (!threadIds.length) return { deliveredCount: 0 };

  const pending = await Message.find({
    conversation: { $in: threadIds },
    sender: { $ne: userId },
    status: 'sent',
    deliveredAt: null,
  }).select('sender').lean();

  if (!pending.length) return { deliveredCount: 0 };
  const deliveredAt = new Date();
  const result = await Message.updateMany(
    { _id: { $in: pending.map((message) => message._id) }, deliveredAt: null },
    { $set: { deliveredAt } }
  );
  await notifyUsers(pending.map((message) => message.sender));

  void broadcastFeedEvent('messages_delivered', {
    recipientId: String(userId),
    deliveredAt,
  });

  return { deliveredCount: result.modifiedCount, deliveredAt };
};

const markThreadRead = async (threadId, userId) => {
  const thread = await assertMembership(threadId, userId);
  const seenAt = new Date();
  const unseen = await Message.find({
    conversation: threadId,
    sender: { $ne: userId },
    status: 'sent',
    seenAt: null,
  }).select('sender').lean();
  if (unseen.length) {
    await Message.updateMany(
      { _id: { $in: unseen.map((message) => message._id) }, seenAt: null },
      { $set: { deliveredAt: seenAt, seenAt } }
    );
  }
  const entry = thread.readState.find((item) => String(item.user) === String(userId));
  if (entry) entry.lastReadAt = seenAt;
  else thread.readState.push({ user: userId, lastReadAt: seenAt });
  await thread.save();
  if (unseen.length) await notifyUsers(unseen.map((message) => message.sender));

  void broadcastFeedEvent('message_read', {
    threadId: String(thread._id),
    readerId: String(userId),
    participants: thread.participants.map(String),
    seenAt,
  });

  return { threadId: String(thread._id), unreadCount: 0, seenCount: unseen.length, seenAt };
};

module.exports = {
  createRealtimeToken,
  listThreads,
  getOrCreateThread,
  getMessages,
  sendMessage,
  markMessagesDelivered,
  markThreadRead,
};
