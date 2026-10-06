const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/user.model');
const { sendError } = require('../helpers/response.helper');

/**
 * JWT Authentication Middleware
 * Protects private routes and populates req.user
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 'Access denied. No authentication token provided.', 401);
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Authentication token has expired. Please log in again.', 401);
      }
      return sendError(res, 'Invalid authentication token.', 401);
    }

    // Fetch user
    const user = await User.findById(decoded.id).populate('roles');

    if (!user) {
      return sendError(res, 'User belonging to this token no longer exists.', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'This user account has been deactivated.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    return sendError(res, 'Authentication failed.', 500, error);
  }
};

/**
 * Optional Authentication Middleware
 * If a valid token is present, populates req.user; otherwise proceeds with req.user = null.
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id).populate('roles');
      if (user && user.isActive) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch {
      req.user = null;
    }

    next();
  } catch {
    req.user = null;
    next();
  }
};

/**
 * Authorization middleware — requires the authenticated user to hold the `admin`
 * role. Must run after `authenticate`.
 */
const requireAdmin = (req, res, next) => {
  const roles = (req.user && req.user.roles) || [];
  const isAdmin = roles.some((role) => (role && role.name ? role.name : role) === 'admin');
  if (!isAdmin) {
    return sendError(res, 'Administrator access is required for this action.', 403);
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
};
