const userService = require('../services/user.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');

/**
 * Create (register) a new user.
 * Body: { firstName, lastName, email, password, countryCode?, phoneNumber?, roles?: [roleId] }
 */
const createUser = async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    return sendSuccess(
      res,
      user,
      'User created successfully. A 6-digit verification code has been sent to their email.',
      201
    );
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 'An account with this email address already exists.', 409, error);
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendError(res, messages.join(', '), 400, error);
    }
    return sendError(
      res,
      error.statusCode ? error.message : 'Failed to create user',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Get all users
 */
const getUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    return sendSuccess(res, users, 'Users retrieved successfully');
  } catch (error) {
    return sendError(res, 'Failed to retrieve users', 500, error);
  }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }
    return sendSuccess(res, user, 'User retrieved successfully');
  } catch (error) {
    return sendError(res, 'Failed to retrieve user', 500, error);
  }
};

/**
 * Update user by ID
 */
const updateUser = async (req, res) => {
  try {
    const user = await userService.updateUserById(req.params.id, req.body);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }
    return sendSuccess(res, user, 'User updated successfully');
  } catch (error) {
    return sendError(res, 'Failed to update user', 500, error);
  }
};

/**
 * Delete user by ID
 */
const deleteUser = async (req, res) => {
  try {
    const user = await userService.deleteUserById(req.params.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }
    return sendSuccess(res, null, 'User deleted successfully');
  } catch (error) {
    return sendError(res, 'Failed to delete user', 500, error);
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
};
