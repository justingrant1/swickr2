const { createClient } = require('redis');
const logger = require('../utils/logger');

// Mock Redis client for development without Redis
class MockRedisClient {
  constructor() {
    this.store = new Map();
    logger.warn('Using mock Redis client - for development only');
  }

  async connect() {
    return true;
  }

  async set(key, value, options) {
    this.store.set(key, value);
    return 'OK';
  }

  async get(key) {
    return this.store.get(key);
  }

  async del(key) {
    this.store.delete(key);
    return 1;
  }

  async hSet(key, field, value) {
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    this.store.get(key).set(field, value);
    return 1;
  }

  async hGet(key, field) {
    if (!this.store.has(key)) {
      return null;
    }
    return this.store.get(key).get(field);
  }

  async hDel(key, field) {
    if (!this.store.has(key)) {
      return 0;
    }
    const map = this.store.get(key);
    const result = map.delete(field) ? 1 : 0;
    return result;
  }

  async lPush(key, value) {
    if (!this.store.has(key)) {
      this.store.set(key, []);
    }
    const list = this.store.get(key);
    list.unshift(value);
    return list.length;
  }

  on(event, callback) {
    // Mock event handling
    if (event === 'connect') {
      callback();
    }
    return this;
  }
}

// Determine if we should use real Redis or mock
const shouldUseMockRedis = process.env.NODE_ENV === 'development' && !process.env.REDIS_URL;

// Create Redis client
const createRedisClient = () => {
  if (shouldUseMockRedis) {
    return new MockRedisClient();
  }
  
  return createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => {
        // Exponential backoff with max delay of 10 seconds
        const delay = Math.min(Math.pow(2, retries) * 100, 10000);
        logger.info(`Redis reconnecting in ${delay}ms...`);
        return delay;
      }
    }
  });
};

const redisClient = createRedisClient();

// Handle Redis events (only for real Redis client)
if (!shouldUseMockRedis) {
  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('error', (err) => {
    logger.error('Redis client error:', err);
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
  });
}

/**
 * Initialize Redis connection
 */
const initRedis = async () => {
  try {
    if (shouldUseMockRedis) {
      logger.info('Using mock Redis client for development');
      return redisClient;
    }
    
    await redisClient.connect();
    logger.info('Redis initialized successfully');
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    // Continue without Redis in development, but fail in production
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    logger.warn('Falling back to mock Redis client');
    return new MockRedisClient();
  }
};

// User status management
const USER_STATUS_KEY = 'user:status';
const USER_SOCKET_KEY = 'user:socket';
const SOCKET_USER_KEY = 'socket:user';

/**
 * Set user status in Redis
 * @param {string} userId - User ID
 * @param {string} status - User status
 * @returns {Promise<boolean>} Success status
 */
const setUserStatus = async (userId, status) => {
  try {
    await redisClient.hSet(USER_STATUS_KEY, userId, status);
    return true;
  } catch (error) {
    logger.error('Error setting user status in Redis:', error);
    return false;
  }
};

/**
 * Get user status from Redis
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} User status
 */
const getUserStatus = async (userId) => {
  try {
    return await redisClient.hGet(USER_STATUS_KEY, userId);
  } catch (error) {
    logger.error('Error getting user status from Redis:', error);
    return null;
  }
};

/**
 * Remove user status from Redis
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
const removeUserStatus = async (userId) => {
  try {
    await redisClient.hDel(USER_STATUS_KEY, userId);
    return true;
  } catch (error) {
    logger.error('Error removing user status from Redis:', error);
    return false;
  }
};

/**
 * Associate user ID with socket ID
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 * @returns {Promise<boolean>} Success status
 */
const setUserSocket = async (userId, socketId) => {
  try {
    await redisClient.hSet(USER_SOCKET_KEY, userId, socketId);
    await redisClient.hSet(SOCKET_USER_KEY, socketId, userId);
    return true;
  } catch (error) {
    logger.error('Error setting user socket in Redis:', error);
    return false;
  }
};

/**
 * Get socket ID for user
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Socket ID
 */
const getUserSocket = async (userId) => {
  try {
    return await redisClient.hGet(USER_SOCKET_KEY, userId);
  } catch (error) {
    logger.error('Error getting user socket from Redis:', error);
    return null;
  }
};

/**
 * Get user ID for socket
 * @param {string} socketId - Socket ID
 * @returns {Promise<string|null>} User ID
 */
const getUserBySocket = async (socketId) => {
  try {
    return await redisClient.hGet(SOCKET_USER_KEY, socketId);
  } catch (error) {
    logger.error('Error getting user by socket from Redis:', error);
    return null;
  }
};

/**
 * Remove socket association
 * @param {string} socketId - Socket ID
 * @returns {Promise<boolean>} Success status
 */
const removeSocket = async (socketId) => {
  try {
    const userId = await getUserBySocket(socketId);
    if (userId) {
      await redisClient.hDel(USER_SOCKET_KEY, userId);
    }
    await redisClient.hDel(SOCKET_USER_KEY, socketId);
    return true;
  } catch (error) {
    logger.error('Error removing socket from Redis:', error);
    return false;
  }
};

module.exports = { 
  redisClient, 
  initRedis,
  setUserStatus,
  getUserStatus,
  removeUserStatus,
  setUserSocket,
  getUserSocket,
  getUserBySocket,
  removeSocket
};
