const express = require('express');
const router = express.Router();
const userRoutes = require('./user.routes');
const authRoutes = require('./auth.routes');
const roleRoutes = require('./role.routes');
const profileRoutes = require('./profile.routes');
const uploadRoutes = require('./upload.routes');
const industryRoutes = require('./industry.routes');
const locationRoutes = require('./location.routes');
const postRoutes = require('./post.routes');
const { sendSuccess } = require('../helpers/response.helper');

// Health check endpoint
router.get('/health', (req, res) => {
  return sendSuccess(res, {
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }, 'API is healthy');
});

// Mount resource routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/profile', profileRoutes);
router.use('/uploads', uploadRoutes);
router.use('/industries', industryRoutes);
router.use('/states', locationRoutes);
router.use('/posts', postRoutes);

module.exports = router;
