const express = require('express');
const router = express.Router();
const connectionController = require('../controllers/connection.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All connection routes require authentication
router.use(authenticate);

// Statuses & listing
router.get('/statuses', connectionController.getMyStatuses);
router.get('/', connectionController.getMyConnections);

// Send request
router.post('/request/:targetUserId', connectionController.sendRequest);

// Accept / Reject / Cancel / Remove by body or route param
router.post('/accept', connectionController.acceptRequest);
router.post('/reject', connectionController.rejectRequest);
router.post('/cancel', connectionController.cancelRequest);
router.post('/remove', connectionController.removeConnection);

router.post('/:connectionId/accept', connectionController.acceptRequest);
router.post('/:connectionId/reject', connectionController.rejectRequest);
router.post('/:connectionId/cancel', connectionController.cancelRequest);
router.post('/:connectionId/remove', connectionController.removeConnection);
router.delete('/:targetUserId', connectionController.removeConnection);

module.exports = router;

