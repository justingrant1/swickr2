/**
 * Authentication Configuration
 * 
 * Provides authentication settings and utilities
 */
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT Secret - should be loaded from environment in production
const JWT_SECRET = process.env.JWT_SECRET || 'swickr-development-secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

/**
 * Generate a JWT token
 * 
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  try {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  } catch (error) {
    logger.error(`Error generating token: ${error.message}`);
    throw error;
  }
};

/**
 * Generate a refresh token
 * 
 * @param {Object} payload - Token payload
 * @returns {string} Refresh token
 */
const generateRefreshToken = (payload) => {
  try {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  } catch (error) {
    logger.error(`Error generating refresh token: ${error.message}`);
    throw error;
  }
};

/**
 * Verify a JWT token
 * 
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    logger.error(`Error verifying token: ${error.message}`);
    return null;
  }
};

/**
 * Extract user from socket handshake auth
 * 
 * @param {Object} handshake - Socket handshake object
 * @returns {Object|null} User object or null if authentication fails
 */
const extractUserFromSocket = (handshake) => {
  try {
    // For development/demo, allow direct userId/username in auth
    if (process.env.USE_MOCK_DB === 'true' && handshake.auth) {
      if (handshake.auth.userId && handshake.auth.username) {
        return {
          id: handshake.auth.userId,
          username: handshake.auth.username
        };
      }
    }
    
    // Extract token from handshake
    const token = handshake.auth?.token || 
                  handshake.headers?.authorization?.split(' ')[1] || 
                  handshake.query?.token;
    
    if (!token) {
      logger.warn('No token provided in socket connection');
      return null;
    }
    
    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      logger.warn('Invalid token in socket connection');
      return null;
    }
    
    return {
      id: decoded.id,
      username: decoded.username
    };
  } catch (error) {
    logger.error(`Error extracting user from socket: ${error.message}`);
    return null;
  }
};

module.exports = {
  JWT_SECRET,
  JWT_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  generateToken,
  generateRefreshToken,
  verifyToken,
  extractUserFromSocket
};
