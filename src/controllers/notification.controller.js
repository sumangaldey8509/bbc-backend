const notificationService = require('../services/notification.service');
const pushNotificationService = require('../services/pushNotification.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');

/**
 * Get notifications for the authenticated user.
 * GET /api/notifications?page=1&limit=20
 */
const getNotifications = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await notificationService.getUserNotifications(req.user._id, { page, limit });
    return sendSuccess(res, result, 'Notifications retrieved successfully.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to retrieve notifications.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Mark a single notification as read.
 * PATCH /api/notifications/:id/read
 */
const markNotificationRead = async (req, res) => {
  try {
    const result = await notificationService.markNotificationRead(req.params.id, req.user._id);
    return sendSuccess(res, result, 'Notification marked as read.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to mark notification as read.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Mark all notifications as read.
 * PATCH /api/notifications/read-all
 */
const markAllRead = async (req, res) => {
  try {
    const result = await notificationService.markAllRead(req.user._id);
    return sendSuccess(res, result, 'All notifications marked as read.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to mark notifications as read.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Clear/delete all notifications.
 * DELETE /api/notifications
 */
const clearNotifications = async (req, res) => {
  try {
    const result = await notificationService.clearUserNotifications(req.user._id);
    return sendSuccess(res, result, 'Notifications cleared successfully.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to clear notifications.',
      error.statusCode || 500,
      error
    );
  }
};

const registerPushToken = async (req, res) => {
  try {
    const result = await pushNotificationService.registerToken(req.user._id, req.body);
    return sendSuccess(res, result, 'Push notification device registered.');
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 500, error);
  }
};

const unregisterPushToken = async (req, res) => {
  try {
    const result = await pushNotificationService.unregisterToken(req.user._id, req.body.token);
    return sendSuccess(res, result, 'Push notification device removed.');
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 500, error);
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllRead,
  clearNotifications,
  registerPushToken,
  unregisterPushToken,
};
