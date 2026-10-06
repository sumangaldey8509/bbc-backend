const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');

// --- Member (own profile) ---
router.get('/me', authenticate, profileController.getMyProfile);
router.put('/me', authenticate, profileController.upsertMyProfile);
router.delete('/me/photo', authenticate, profileController.removeMyPhoto);
router.post('/me/submit', authenticate, profileController.submitMyProfile);

// --- Admin review ---
router.get('/reviews', authenticate, requireAdmin, profileController.listReviews);
router.get('/:userId', authenticate, requireAdmin, profileController.getProfileForAdmin);
router.patch('/:userId/review', authenticate, requireAdmin, profileController.reviewProfile);

module.exports = router;
