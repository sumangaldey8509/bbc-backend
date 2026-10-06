const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { sendError } = require('./helpers/response.helper');
const logger = require('./utils/logger');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.originalUrl}`);
    next();
  });
}

// API Routes
app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to BBC - Bengal Business Council API',
    docs: '/api/health',
  });
});

// 404 Handler
app.use((req, res) => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled Error: ${err.message}`, err.stack);
  return sendError(res, 'Internal Server Error', err.statusCode || 500, err);
});

module.exports = app;
