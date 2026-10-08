const { Expo } = require('expo-server-sdk');
const PushToken = require('../models/pushToken.model');
const logger = require('../utils/logger');

const expo = new Expo(
  process.env.EXPO_PUSH_ACCESS_TOKEN
    ? { accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN }
    : undefined
);

const registerToken = async (userId, { token, platform, deviceName = '' }) => {
  if (!Expo.isExpoPushToken(token)) {
    const error = new Error('Invalid Expo push token.');
    error.statusCode = 400;
    throw error;
  }
  if (!['android', 'ios'].includes(platform)) {
    const error = new Error('Platform must be android or ios.');
    error.statusCode = 400;
    throw error;
  }

  const record = await PushToken.findOneAndUpdate(
    { token },
    {
      $set: {
        user: userId,
        platform,
        deviceName: String(deviceName || '').slice(0, 120),
        active: true,
        lastSeenAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { id: String(record._id), platform: record.platform, active: record.active };
};

const unregisterToken = async (userId, token) => {
  if (!token) return { removed: false };
  const result = await PushToken.updateOne(
    { user: userId, token },
    { $set: { active: false, lastSeenAt: new Date() } }
  );
  return { removed: result.modifiedCount > 0 };
};

const sendToUser = async (userId, { title, body, data = {} }) => {
  const records = await PushToken.find({ user: userId, platform: 'android', active: true }).lean();
  const validRecords = records.filter((record) => Expo.isExpoPushToken(record.token));
  if (!validRecords.length) return { queued: 0 };

  const messages = validRecords.map((record) => ({
    to: record.token,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    channelId: 'messages',
  }));

  let queued = 0;
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      queued += tickets.filter((ticket) => ticket.status === 'ok').length;
      const invalidTokens = tickets.flatMap((ticket, index) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? [chunk[index].to]
          : []
      );
      if (invalidTokens.length) {
        await PushToken.updateMany({ token: { $in: invalidTokens } }, { $set: { active: false } });
      }
      tickets
        .filter((ticket) => ticket.status === 'error')
        .forEach((ticket) => logger.warn(`[Push] Expo rejected notification: ${ticket.message}`));
    } catch (error) {
      logger.error(`[Push] Failed to queue notification: ${error.message}`);
    }
  }
  return { queued };
};

module.exports = { registerToken, unregisterToken, sendToUser };
