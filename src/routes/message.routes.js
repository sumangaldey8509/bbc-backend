const express = require('express');
const messageController = require('../controllers/message.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authenticate);
router.get('/realtime-token', messageController.getRealtimeToken);
router.get('/threads', messageController.listThreads);
router.post('/threads', messageController.createThread);
router.patch('/delivered', messageController.markMessagesDelivered);
router.get('/threads/:threadId', messageController.getMessages);
router.post('/threads/:threadId', messageController.sendMessage);
router.patch('/threads/:threadId/read', messageController.markThreadRead);

module.exports = router;
