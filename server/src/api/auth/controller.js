const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');
const { redisClient } = require('../../config/redis');
const User = require('../../models/User');

// Temporary in-memory user store (replace with database in production)
// const users = [];

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, fullName } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return next(ApiError.badRequest('Please provide username, email, and password'));
    }

    // Create user
    const userData = {
      username,
      email,
      password,
      fullName
    };

    try {
      const newUser = await User.create(userData);

      // Generate tokens
      const tokens = await generateTokens(newUser);

      // Return user data and tokens
      res.status(201).json({
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.full_name,
          profilePicture: newUser.profile_picture
        },
        tokens
      });
    } catch (error) {
      if (error.message.includes('already taken') || error.message.includes('already registered')) {
        return next(ApiError.conflict(error.message));
      }
      throw error;
    }
  } catch (error) {
    logger.error('Registration error:', error);
    next(ApiError.internal('Registration failed'));
  }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return next(ApiError.badRequest('Please provide username and password'));
    }

    try {
      // Authenticate user
      const authResult = await User.authenticate(username, password);
      logger.debug('Auth result:', JSON.stringify(authResult, null, 2));
      
      if (!authResult || !authResult.user) {
        return next(ApiError.unauthorized('Authentication failed'));
      }
      
      // Generate access token directly here
      const accessToken = jwt.sign(
        { 
          userId: authResult.user.id, 
          username: authResult.user.username,
          email: authResult.user.email
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
      );
      
      // Generate refresh token
      const refreshToken = jwt.sign(
        { userId: authResult.user.id },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
      );
      
      // Store refresh token in Redis if available
      if (redisClient.isReady) {
        await redisClient.set(
          `refresh_token:${authResult.user.id}`,
          refreshToken,
          'EX',
          60 * 60 * 24 * 7 // 7 days
        );
      }
      
      // Return user data and tokens
      const response = {
        user: {
          id: authResult.user.id,
          username: authResult.user.username,
          email: authResult.user.email,
          fullName: authResult.user.fullName || authResult.user.full_name,
          profilePicture: authResult.user.profilePicture || authResult.user.profile_picture,
          status: authResult.user.status
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };
      
      logger.debug('Login response:', JSON.stringify(response, null, 2));
      return res.status(200).json(response);
    } catch (error) {
      logger.error('Authentication error:', error.message);
      if (error.message.includes('Invalid username') || error.message.includes('Invalid password')) {
        return next(ApiError.unauthorized('Invalid credentials'));
      }
      throw error;
    }
  } catch (error) {
    logger.error('Login error:', error);
    next(ApiError.internal('Login failed'));
  }
};

/**
 * Refresh access token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(ApiError.badRequest('Refresh token is required'));
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      return next(ApiError.unauthorized('Invalid refresh token'));
    }

    const userId = decoded.userId;

    // Check if refresh token exists in Redis
    const storedRefreshToken = await redisClient.get(`refresh_token:${userId}`);
    if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
      return next(ApiError.unauthorized('Invalid refresh token'));
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return next(ApiError.unauthorized('User not found'));
    }

    // Generate new tokens
    const tokens = await generateTokens(user);

    // Return new tokens
    res.status(200).json({
      tokens
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    next(ApiError.internal('Failed to refresh token'));
  }
};

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(ApiError.badRequest('Refresh token is required'));
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      // If token is invalid, just return success as user is effectively logged out
      return res.status(200).json({ success: true });
    }

    const userId = decoded.userId;

    // Remove refresh token from Redis
    await redisClient.del(`refresh_token:${userId}`);

    // Update user status to offline
    await User.updateStatus(userId, 'offline');

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    next(ApiError.internal('Logout failed'));
  }
};

/**
 * Generate access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Access and refresh tokens
 */
const generateTokens = async (user) => {
  // Generate access token
  const accessToken = jwt.sign(
    { 
      userId: user.id, 
      username: user.username,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );

  // Store refresh token in Redis
  await storeRefreshToken(user.id, refreshToken);

  return {
    accessToken,
    refreshToken
  };
};

/**
 * Store refresh token in Redis
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token
 */
const storeRefreshToken = async (userId, refreshToken) => {
  // Store token with expiry matching JWT expiry
  const expirySeconds = parseInt(process.env.JWT_REFRESH_EXPIRY_SECONDS) || 60 * 60 * 24 * 7; // Default 7 days
  await redisClient.set(`refresh_token:${userId}`, refreshToken, 'EX', expirySeconds);
};

module.exports = {
  register,
  login,
  refreshToken,
  logout
};
