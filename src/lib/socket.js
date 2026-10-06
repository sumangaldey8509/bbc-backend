const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io = null;

/**
 * Initialize Socket.io with the HTTP server
 * @param {import('http').Server} server 
 * @returns {Server}
 */
const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust as needed for specific client origins
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.io initialized');
  return io;
};

/**
 * Get the initialized Socket.io instance
 * @returns {Server}
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet.');
  }
  return io;
};

module.exports = {
  initSocket,
  getIO,
};
