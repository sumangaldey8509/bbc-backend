const http = require('http');
const app = require('./app');
const config = require('./config');
const connectDB = require('./config/db');
const { initSocket } = require('./lib/socket');
const { initRealtime } = require('./services/realtime.service');
const logger = require('./utils/logger');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Initialize Supabase Realtime broadcast channel
initRealtime();

// Start server after connecting to database
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start listening
    server.listen(config.port, () => {
      logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
      logger.info(`API Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

startServer();
