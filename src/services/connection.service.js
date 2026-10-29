const mongoose = require('mongoose');
const Connection = require('../models/connection.model');
const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const ProfileDetails = require('../models/profileDetails.model');
const notificationService = require('./notification.service');
const { sendToUser } = require('./pushNotification.service');
const { broadcastFeedEvent } = require('./realtime.service');
const logger = require('../utils/logger');

/**
 * Send a connection request from requesterId to targetUserId.
 */
const sendConnectionRequest = async ({ requesterId, targetUserId, note = '' }) => {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    const error = new Error('Invalid target user ID');
    error.statusCode = 400;
    throw error;
  }

  if (String(requesterId) === String(targetUserId)) {
    const error = new Error('You cannot connect with yourself');
    error.statusCode = 400;
    throw error;
  }

  const targetUser = await User.findById(targetUserId).lean();
  if (!targetUser) {
    const error = new Error('Member not found');
    error.statusCode = 404;
    throw error;
  }

  // Check if a connection record already exists in either direction
  let connection = await Connection.findOne({
    $or: [
      { requester: requesterId, recipient: targetUserId },
      { requester: targetUserId, recipient: requesterId },
    ],
  });

  if (connection) {
    if (connection.status === 'accepted') {
      const error = new Error('You are already connected with this member');
      error.statusCode = 400;
      throw error;
    }

    if (connection.status === 'pending') {
      if (String(connection.requester) === String(requesterId)) {
        const error = new Error('Connection request is already pending');
        error.statusCode = 400;
        throw error;
      } else {
        // The other user already sent us a request! Auto-accept it.
        connection.status = 'accepted';
        await connection.save();

        // Notify both parties of acceptance
        const [u1, u2] = await Promise.all([
          User.findById(requesterId).select('firstName lastName').lean(),
          User.findById(targetUserId).select('firstName lastName').lean(),
        ]);
        const u1Name = u1 ? `${u1.firstName || ''} ${u1.lastName || ''}`.trim() : 'A member';
        const u2Name = u2 ? `${u2.firstName || ''} ${u2.lastName || ''}`.trim() : 'A member';

        await notificationService.createNotification({
          recipientId: targetUserId,
          senderId: requesterId,
          type: 'connection_accepted',
          title: 'Connection Accepted',
          message: `${u1Name} accepted your connection request.`,
          connectionId: connection._id,
        });

        void sendToUser(targetUserId, {
          title: 'Connection Accepted',
          body: `${u1Name} accepted your connection request. You are now connected!`,
          data: {
            type: 'connection_accepted',
            connectionId: String(connection._id),
            senderId: String(requesterId),
          },
        }).catch((err) => logger.warn(`[connection] Push notification failed: ${err.message}`));

        return connection;
      }
    }

    // If previously rejected or cancelled, reuse and reactivate
    connection.requester = requesterId;
    connection.recipient = targetUserId;
    connection.status = 'pending';
    connection.note = note || '';
    await connection.save();
  } else {
    connection = await Connection.create({
      requester: requesterId,
      recipient: targetUserId,
      status: 'pending',
      note: note || '',
    });
  }

  // Get requester details for the notification
  const requester = await User.findById(requesterId).select('firstName lastName').lean();
  const requesterName = requester
    ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim()
    : 'A member';

  // 1. In-App Notification (also broadcasts over Supabase Realtime)
  await notificationService.createNotification({
    recipientId: targetUserId,
    senderId: requesterId,
    type: 'connection_request',
    title: 'New Connection Request',
    message: `${requesterName} sent you a connection request.`,
    connectionId: connection._id,
  });

  // 2. Expo Push Notification to User B
  void sendToUser(targetUserId, {
    title: 'New Connection Request',
    body: `${requesterName} wants to connect with you on Bengal Business Council.`,
    data: {
      type: 'connection_request',
      connectionId: String(connection._id),
      senderId: String(requesterId),
    },
  }).catch((err) => {
    logger.warn(`[connection] Push notification failed: ${err.message}`);
  });

  return connection;
};

/**
 * Accept an incoming connection request.
 */
const acceptConnectionRequest = async ({ connectionId, recipientId, senderId }) => {
  let query = { status: 'pending' };
  if (connectionId && mongoose.Types.ObjectId.isValid(connectionId)) {
    query._id = connectionId;
    query.recipient = recipientId;
  } else if (senderId && mongoose.Types.ObjectId.isValid(senderId)) {
    query.requester = senderId;
    query.recipient = recipientId;
  } else {
    const error = new Error('Invalid connection request');
    error.statusCode = 400;
    throw error;
  }

  const connection = await Connection.findOne(query);
  if (!connection) {
    // Check if the connection was recently cancelled or withdrawn by sender
    let checkCancelledQuery = {};
    if (connectionId && mongoose.Types.ObjectId.isValid(connectionId)) {
      checkCancelledQuery._id = connectionId;
    } else if (senderId && mongoose.Types.ObjectId.isValid(senderId)) {
      checkCancelledQuery.requester = senderId;
      checkCancelledQuery.recipient = recipientId;
    }

    const cancelledConn = await Connection.findOne(checkCancelledQuery);
    if (cancelledConn && cancelledConn.status === 'cancelled') {
      // Clean up orphaned notification for recipient
      await Notification.deleteMany({
        recipient: recipientId,
        $or: [
          { connectionId: cancelledConn._id },
          { sender: senderId || cancelledConn.requester, type: 'connection_request' },
        ],
      });
      const error = new Error('This connection request was withdrawn by the sender.');
      error.statusCode = 410;
      error.code = 'CONNECTION_WITHDRAWN';
      throw error;
    }

    const error = new Error('Pending connection request not found');
    error.statusCode = 404;
    throw error;
  }

  connection.status = 'accepted';
  await connection.save();

  // Clean up the connection_request notification for recipient since it is now accepted
  await Notification.deleteMany({
    recipient: recipientId,
    $or: [
      { connectionId: connection._id },
      { sender: connection.requester, type: 'connection_request' },
    ],
  });

  // Notify the original requester
  const recipient = await User.findById(recipientId).select('firstName lastName').lean();
  const recipientName = recipient
    ? `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim()
    : 'A member';

  // In-App notification
  await notificationService.createNotification({
    recipientId: connection.requester,
    senderId: recipientId,
    type: 'connection_accepted',
    title: 'Connection Accepted',
    message: `${recipientName} accepted your connection request.`,
    connectionId: connection._id,
  });

  // Push notification
  void sendToUser(connection.requester, {
    title: 'Connection Accepted',
    body: `${recipientName} accepted your connection request. You are now connected!`,
    data: {
      type: 'connection_accepted',
      connectionId: String(connection._id),
      senderId: String(recipientId),
    },
  }).catch((err) => {
    logger.warn(`[connection] Push notification failed: ${err.message}`);
  });

  return connection;
};

/**
 * Reject / Ignore an incoming connection request.
 */
const rejectConnectionRequest = async ({ connectionId, recipientId, senderId }) => {
  let query = { status: 'pending' };
  if (connectionId && mongoose.Types.ObjectId.isValid(connectionId)) {
    query._id = connectionId;
    query.recipient = recipientId;
  } else if (senderId && mongoose.Types.ObjectId.isValid(senderId)) {
    query.requester = senderId;
    query.recipient = recipientId;
  } else {
    const error = new Error('Invalid connection request');
    error.statusCode = 400;
    throw error;
  }

  const connection = await Connection.findOne(query);
  if (!connection) {
    const error = new Error('Pending connection request not found');
    error.statusCode = 404;
    throw error;
  }

  connection.status = 'rejected';
  await connection.save();

  // Dismiss / remove the notification from recipient's notification panel
  await Notification.deleteMany({
    recipient: recipientId,
    $or: [
      { connectionId: connection._id },
      { sender: senderId || connection.requester, type: 'connection_request' },
    ],
  });

  // Broadcast silent realtime disconnection event so User A's pending button quietly resets to [+ Connect]
  void broadcastFeedEvent('connection_removed', {
    connectionId: String(connection._id),
    user1Id: String(connection.requester),
    user2Id: String(recipientId),
  });

  return { success: true, status: 'rejected' };
};

/**
 * Cancel an outgoing connection request.
 */
const cancelConnectionRequest = async ({ connectionId, requesterId, targetUserId }) => {
  let query = { status: 'pending' };
  if (connectionId && mongoose.Types.ObjectId.isValid(connectionId)) {
    query._id = connectionId;
    query.requester = requesterId;
  } else if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
    query.requester = requesterId;
    query.recipient = targetUserId;
  } else {
    const error = new Error('Invalid connection request');
    error.statusCode = 400;
    throw error;
  }

  const connection = await Connection.findOne(query);
  if (!connection) {
    const error = new Error('Pending connection request not found');
    error.statusCode = 404;
    throw error;
  }

  connection.status = 'cancelled';
  await connection.save();

  // 1. Remove the pending connection notification from User B's notification list
  await Notification.deleteMany({
    recipient: connection.recipient,
    $or: [
      { connectionId: connection._id },
      { sender: requesterId, type: 'connection_request' },
    ],
  });

  // 2. Broadcast realtime cancellation event to User B
  void broadcastFeedEvent('connection_cancelled', {
    connectionId: String(connection._id),
    senderId: String(requesterId),
    recipientId: String(connection.recipient),
  });

  return { success: true, status: 'cancelled' };
};

/**
 * Get map of all connection statuses for the current user against all other members.
 * Returns: { [peerUserId]: { status: 'accepted'|'pending_outgoing'|'pending_incoming'|'none', connectionId: string } }
 */
const getMyConnectionStatuses = async (userId) => {
  const connections = await Connection.find({
    $or: [{ requester: userId }, { recipient: userId }],
  }).lean();

  const statuses = {};
  for (const c of connections) {
    const isRequester = String(c.requester) === String(userId);
    const peerId = isRequester ? String(c.recipient) : String(c.requester);

    if (c.status === 'accepted') {
      statuses[peerId] = {
        status: 'accepted',
        connectionId: String(c._id),
      };
    } else if (c.status === 'pending') {
      statuses[peerId] = {
        status: isRequester ? 'pending_outgoing' : 'pending_incoming',
        connectionId: String(c._id),
      };
    } else {
      // If rejected or cancelled, user can send again
      if (!statuses[peerId]) {
        statuses[peerId] = {
          status: 'none',
          connectionId: String(c._id),
        };
      }
    }
  }

  return statuses;
};

/**
 * Get list of accepted connections for the current user.
 */
const getMyConnections = async (userId) => {
  const connections = await Connection.find({
    $or: [{ requester: userId }, { recipient: userId }],
    status: 'accepted',
  })
    .populate('requester', 'firstName lastName email phoneNumber countryCode')
    .populate('recipient', 'firstName lastName email phoneNumber countryCode')
    .sort({ updatedAt: -1 })
    .lean();

  const peerIds = connections.map((c) =>
    String(c.requester._id) === String(userId) ? c.recipient._id : c.requester._id
  );

  const profiles = await ProfileDetails.find({ userId: { $in: peerIds } }).lean();
  const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

  return connections.map((c) => {
    const isRequester = String(c.requester._id) === String(userId);
    const peerUser = isRequester ? c.recipient : c.requester;
    const peerProfile = profileMap.get(String(peerUser._id));

    return {
      connectionId: String(c._id),
      connectedAt: c.updatedAt,
      user: {
        id: String(peerUser._id),
        firstName: peerUser.firstName,
        lastName: peerUser.lastName,
        name: `${peerUser.firstName || ''} ${peerUser.lastName || ''}`.trim() || 'Member',
        email: peerUser.email,
        phone: peerUser.phoneNumber,
        designation: peerProfile?.designation || '',
        companyName: peerProfile?.companyName || '',
        avatar: peerProfile?.avatar || '',
        city: peerProfile?.city || '',
        state: peerProfile?.state || '',
      },
    };
  });
};

/**
 * Remove an existing connection between the authenticated user and target member.
 * No notifications are dispatched.
 */
const removeConnection = async ({ userId, targetUserId, connectionId }) => {
  let query = {};
  if (connectionId && mongoose.Types.ObjectId.isValid(connectionId)) {
    query._id = connectionId;
    query.$or = [{ requester: userId }, { recipient: userId }];
  } else if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
    query.$or = [
      { requester: userId, recipient: targetUserId },
      { requester: targetUserId, recipient: userId },
    ];
  } else {
    const error = new Error('Invalid target user or connection ID');
    error.statusCode = 400;
    throw error;
  }

  const connection = await Connection.findOneAndDelete(query);
  if (!connection) {
    const error = new Error('Connection not found');
    error.statusCode = 404;
    throw error;
  }

  const otherUserId = String(connection.requester) === String(userId) ? connection.recipient : connection.requester;

  // Clean up any remaining connection notifications between these users
  await Notification.deleteMany({
    $or: [
      { recipient: userId, sender: otherUserId, type: { $in: ['connection_request', 'connection_accepted'] } },
      { recipient: otherUserId, sender: userId, type: { $in: ['connection_request', 'connection_accepted'] } },
      { connectionId: connection._id },
    ],
  });

  // Broadcast silent realtime disconnection event (NO PUSH NOTIFICATION, NO IN-APP NOTIFICATION)
  void broadcastFeedEvent('connection_removed', {
    connectionId: String(connection._id),
    user1Id: String(userId),
    user2Id: String(otherUserId),
  });

  return { success: true, message: 'Connection removed successfully' };
};

module.exports = {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  removeConnection,
  getMyConnectionStatuses,
  getMyConnections,
};

