const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  try {
    if (!config.mongoUri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    if (cached.conn && mongoose.connection.readyState === 1) {
      return cached.conn;
    }

    if (!cached.promise) {
      const opts = {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      };

      cached.promise = mongoose.connect(config.mongoUri, opts).then((conn) => {
        logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
        return conn;
      });
    }

    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    logger.error(`MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  if (cached) {
    cached.conn = null;
    cached.promise = null;
  }
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB connection error: ${err}`);
});

module.exports = connectDB;
