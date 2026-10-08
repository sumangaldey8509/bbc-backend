const messageService = require('../services/message.service');
const { sendSuccess, sendError } = require('../helpers/response.helper');

const listThreads = async (req, res) => {
  try {
    const data = await messageService.listThreads(req.user._id);
    return sendSuccess(res, data, 'Conversations retrieved successfully.');
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 500, error);
  }
};

const getRealtimeToken = async (req, res) => {
  try {
    const data = messageService.createRealtimeToken(req.user._id);
    return sendSuccess(res, data, 'Realtime messaging session created.');
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 500, error);
  }
};

const createThread = async (req, res) => {
  try {
    const data = await messageService.getOrCreateThread(req.user._id, req.body.participantId);
    return sendSuccess(res, data, 'Conversation ready.', 201);
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 500, error);
  }
};

const getMessages = async (req, res) => {
  try {
    const data = await messageService.getMessages(req.params.threadId, req.user._id, req.query);
    return sendSuccess(res, data, 'Messages retrieved successfully.');
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 500, error);
  }
};

const sendMessage = async (req, res) => {
  try {
    const data = await messageService.sendMessage(
      req.params.threadId,
      req.user._id,
      req.body.text
    );
    return sendSuccess(res, data, 'Message sent.', 201);
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 500, error);
  }
};

const markMessagesDelivered = async (req, res) => {
  try {
    const data = await messageService.markMessagesDelivered(req.user._id);
    return sendSuccess(res, data, 'Messages marked as delivered.');
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 500, error);
  }
};

const markThreadRead = async (req, res) => {
  try {
    const data = await messageService.markThreadRead(req.params.threadId, req.user._id);
    return sendSuccess(res, data, 'Conversation marked as read.');
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 500, error);
  }
};

module.exports = {
  getRealtimeToken,
  listThreads,
  createThread,
  getMessages,
  sendMessage,
  markMessagesDelivered,
  markThreadRead,
};
