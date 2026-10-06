const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Public Auth Endpoints
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOtp);
router.post('/complete-verification', authController.completeVerification);
router.post('/resend-otp', authController.resendOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);

// Protected Auth Endpoints
router.get('/me', authenticate, authController.getMe);

module.exports = router;
