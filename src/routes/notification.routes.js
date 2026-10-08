const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All notification routes require authentication
router.use(authenticate);

router.get('/', notificationController.getNotifications);
router.post('/push-token', notificationController.registerPushToken);
router.delete('/push-token', notificationController.unregisterPushToken);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markNotificationRead);
router.delete('/', notificationController.clearNotifications);

module.exports = router;
