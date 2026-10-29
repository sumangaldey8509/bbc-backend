const express = require('express');
const router = express.Router();

// Mobile app resource routes
const userRoutes = require('./user.routes');
const authRoutes = require('./auth.routes');
const roleRoutes = require('./role.routes');
const profileRoutes = require('./profile.routes');
const uploadRoutes = require('./upload.routes');
const industryRoutes = require('./industry.routes');
const locationRoutes = require('./location.routes');
const postRoutes = require('./post.routes');
const notificationRoutes = require('./notification.routes');
const messageRoutes = require('./message.routes');

// CRM portal resource routes
const dashboardRoutes = require('./dashboard.routes');
const memberRoutes = require('./member.routes');
const verifyRoutes = require('./verify.routes');
const dataRoutes = require('./data.routes');
const approvalRoutes = require('./approval.routes');
const reportRoutes = require('./report.routes');
const accessRoutes = require('./access.routes');
const settingsRoutes = require('./settings.routes');
const trackRoutes = require('./track.routes');
const socialRoutes = require('./social.routes');

const { sendSuccess } = require('../helpers/response.helper');

// Health check endpoint
router.get('/health', (req, res) => {
  return sendSuccess(res, {
    status: 'OK',
    service: 'bbc-unified-backend',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }, 'API is healthy');
});

// Mount Mobile endpoints
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/profile', profileRoutes);
router.use('/uploads', uploadRoutes);
router.use('/industries', industryRoutes);
router.use('/states', locationRoutes);
router.use('/posts', postRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);

// Mount CRM endpoints
router.use('/dashboard', dashboardRoutes);
router.use('/members', memberRoutes);
router.use('/verify', verifyRoutes);
router.use('/data', dataRoutes);
router.use('/approvals', approvalRoutes);
router.use('/reports', reportRoutes);
router.use('/access', accessRoutes);
router.use('/settings', settingsRoutes);
router.use('/track', trackRoutes);
router.use('/social', socialRoutes);

module.exports = router;
