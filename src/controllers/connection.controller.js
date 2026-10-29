const connectionService = require('../services/connection.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');

/**
 * Send a connection request to a member.
 * POST /api/connections/request/:targetUserId
 */
const sendRequest = async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const { note } = req.body || {};
    const result = await connectionService.sendConnectionRequest({
      requesterId: req.user._id,
      targetUserId,
      note,
    });
    return sendSuccess(res, result, 'Connection request sent successfully.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to send connection request.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Accept a connection request.
 * POST /api/connections/:connectionId/accept
 * or POST /api/connections/accept (body: { senderId, connectionId })
 */
const acceptRequest = async (req, res) => {
  try {
    const connectionId = req.params.connectionId || req.body?.connectionId;
    const senderId = req.body?.senderId;
    const result = await connectionService.acceptConnectionRequest({
      connectionId,
      recipientId: req.user._id,
      senderId,
    });
    return sendSuccess(res, result, 'Connection accepted successfully.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to accept connection request.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Reject / Ignore a connection request.
 * POST /api/connections/:connectionId/reject
 * or POST /api/connections/reject (body: { senderId, connectionId })
 */
const rejectRequest = async (req, res) => {
  try {
    const connectionId = req.params.connectionId || req.body?.connectionId;
    const senderId = req.body?.senderId;
    const result = await connectionService.rejectConnectionRequest({
      connectionId,
      recipientId: req.user._id,
      senderId,
    });
    return sendSuccess(res, result, 'Connection request ignored.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to reject connection request.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Cancel an outgoing connection request.
 * POST /api/connections/:connectionId/cancel
 * or POST /api/connections/cancel (body: { targetUserId, connectionId })
 */
const cancelRequest = async (req, res) => {
  try {
    const connectionId = req.params.connectionId || req.body?.connectionId;
    const targetUserId = req.body?.targetUserId;
    const result = await connectionService.cancelConnectionRequest({
      connectionId,
      requesterId: req.user._id,
      targetUserId,
    });
    return sendSuccess(res, result, 'Connection request cancelled.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to cancel connection request.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Get connection status lookup for all members.
 * GET /api/connections/statuses
 */
const getMyStatuses = async (req, res) => {
  try {
    const result = await connectionService.getMyConnectionStatuses(req.user._id);
    return sendSuccess(res, result, 'Connection statuses retrieved successfully.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to retrieve connection statuses.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Get all accepted connections for the current user.
 * GET /api/connections
 */
const getMyConnections = async (req, res) => {
  try {
    const result = await connectionService.getMyConnections(req.user._id);
    return sendSuccess(res, result, 'Connections retrieved successfully.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to retrieve connections.',
      error.statusCode || 500,
      error
    );
  }
};

/**
 * Remove an existing connection.
 * POST /api/connections/remove
 * or POST /api/connections/:connectionId/remove
 * or DELETE /api/connections/:targetUserId
 */
const removeConnection = async (req, res) => {
  try {
    const connectionId = req.params.connectionId || req.body?.connectionId;
    const targetUserId = req.body?.targetUserId || req.params.targetUserId;
    const result = await connectionService.removeConnection({
      userId: req.user._id,
      targetUserId,
      connectionId,
    });
    return sendSuccess(res, result, 'Connection removed successfully.');
  } catch (error) {
    return sendError(
      res,
      error.message || 'Failed to remove connection.',
      error.statusCode || 500,
      error
    );
  }
};

module.exports = {
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeConnection,
  getMyStatuses,
  getMyConnections,
};

