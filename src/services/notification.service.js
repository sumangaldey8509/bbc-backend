const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const ProfileDetails = require('../models/profileDetails.model');
const { broadcastFeedEvent } = require('./realtime.service');

/**
 * Create a new notification and broadcast to Supabase realtime channel.
 */
const createNotification = async ({
  recipientId,
  senderId,
  type,
  title,
  message,
  postId = null,
  commentId = null,
}) => {
  if (!recipientId || !senderId) return null;

  // Prevent self-notifications (e.g. user liking/commenting on their own post)
  if (String(recipientId) === String(senderId)) {
    return null;
  }

  const notification = await Notification.create({
    recipient: recipientId,
    sender: senderId,
    type,
    title,
    message,
    postId: postId && mongoose.Types.ObjectId.isValid(postId) ? postId : null,
    commentId: commentId && mongoose.Types.ObjectId.isValid(commentId) ? commentId : null,
    read: false,
  });

  // Hydrate sender details for real-time delivery
  const [senderUser, senderProfile] = await Promise.all([
    User.findById(senderId).select('firstName lastName').lean(),
    ProfileDetails.findOne({ userId: senderId }).select('avatar designation companyName').lean(),
  ]);

  const senderName = senderUser
    ? `${senderUser.firstName || ''} ${senderUser.lastName || ''}`.trim()
    : 'BBC Member';

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0D1B2A&color=fff&bold=true`;

  const payload = {
    id: String(notification._id),
    _id: notification._id,
    recipientId: String(recipientId),
    senderId: String(senderId),
    senderName,
    senderAvatar: senderProfile?.avatar || defaultAvatar,
    senderCompany: senderProfile?.companyName || 'Business Council Member',
    title: notification.title,
    message: notification.message,
    type: notification.type,
    postId: postId ? String(postId) : undefined,
    commentId: commentId ? String(commentId) : undefined,
    read: false,
    timestamp: 'Just now',
    createdAt: notification.createdAt,
  };

  // Broadcast in real-time via Supabase
  void broadcastFeedEvent('new_notification', payload);

  return payload;
};

/**
 * Get paginated notifications for the logged-in user.
 */
const getUserNotifications = async (userId, { page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('sender', 'firstName lastName')
      .lean(),
    Notification.countDocuments({ recipient: userId }),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  const senderIds = [...new Set(notifications.map(n => n.sender?._id || n.sender).filter(Boolean))];
  const profiles = await ProfileDetails.find({ userId: { $in: senderIds } })
    .select('userId avatar designation companyName')
    .lean();
  const profileMap = new Map(profiles.map(p => [String(p.userId), p]));

  const items = notifications.map(notif => {
    const sUser = notif.sender;
    const sProfile = profileMap.get(String(sUser?._id || sUser));
    const senderName = sUser
      ? `${sUser.firstName || ''} ${sUser.lastName || ''}`.trim()
      : 'BBC Member';

    return {
      id: String(notif._id),
      recipientId: String(notif.recipient),
      senderId: String(sUser?._id || sUser),
      senderName,
      senderAvatar:
        sProfile?.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0D1B2A&color=fff&bold=true`,
      senderCompany: sProfile?.companyName || 'Business Council Member',
      title: notif.title,
      message: notif.message,
      type: notif.type,
      postId: notif.postId ? String(notif.postId) : undefined,
      commentId: notif.commentId ? String(notif.commentId) : undefined,
      read: notif.read,
      timestamp: notif.createdAt
        ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Recently',
      createdAt: notif.createdAt,
    };
  });

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      hasMore: skip + items.length < total,
    },
    unreadCount,
  };
};

/**
 * Mark a single notification as read.
 */
const markNotificationRead = async (notificationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    const error = new Error('Invalid Notification ID');
    error.statusCode = 400;
    throw error;
  }

  const notif = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { read: true },
    { new: true }
  );

  if (!notif) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  return { id: String(notif._id), read: true };
};

/**
 * Mark all notifications as read for a user.
 */
const markAllRead = async (userId) => {
  await Notification.updateMany({ recipient: userId, read: false }, { read: true });
  return { success: true };
};

/**
 * Delete all notifications for a user.
 */
const clearUserNotifications = async (userId) => {
  await Notification.deleteMany({ recipient: userId });
  return { success: true };
};

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationRead,
  markAllRead,
  clearUserNotifications,
};
