const express = require('express');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { redisClient } = require('../config/redis');

const router = express.Router();

/**
 * @route GET /debug/env
 * @desc Get environment variables (safe ones only)
 * @access Public
 */
router.get('/env', (req, res) => {
  // Only return safe environment variables
  const safeEnv = {
    NODE_ENV: process.env.NODE_ENV,
    CLIENT_URL: process.env.CLIENT_URL,
    USE_MOCK_DB: process.env.USE_MOCK_DB,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
    REDIS_URL: process.env.REDIS_URL ? 'Set' : 'Not set',
    JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY,
    JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,
    JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set',
  };

  res.json({
    env: safeEnv,
    time: new Date().toISOString()
  });
});

/**
 * @route GET /debug/database
 * @desc Check database connection
 * @access Public
 */
router.get('/database', async (req, res) => {
  try {
    // Check if using mock database
    const useMockDatabase = process.env.USE_MOCK_DB === 'true' || process.env.NODE_ENV === 'development';
    
    if (useMockDatabase) {
      return res.json({
        status: 'ok',
        database: 'mock',
        message: 'Using mock database'
      });
    }
    
    // Try to connect to the real database
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    res.json({
      status: 'ok',
      database: 'postgresql',
      time: result.rows[0].now,
      connectionString: process.env.DATABASE_URL ? 'Set' : 'Not set'
    });
  } catch (error) {
    logger.error('Database connection error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route GET /debug/redis
 * @desc Check Redis connection
 * @access Public
 */
router.get('/redis', async (req, res) => {
  try {
    // Check if Redis is connected
    const isConnected = redisClient && redisClient.isReady;
    
    if (isConnected) {
      // Try a simple Redis operation
      await redisClient.set('debug-test', 'ok');
      const value = await redisClient.get('debug-test');
      
      res.json({
        status: 'ok',
        connected: true,
        test: value === 'ok' ? 'passed' : 'failed',
        redisUrl: process.env.REDIS_URL ? 'Set' : 'Not set'
      });
    } else {
      res.json({
        status: 'error',
        connected: false,
        message: 'Redis client not connected'
      });
    }
  } catch (error) {
    logger.error('Redis connection error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
