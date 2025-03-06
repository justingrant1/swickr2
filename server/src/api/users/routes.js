const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const User = require('../../models/User');
const { ApiError } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');

/**
 * @route GET /api/users/profile
 * @desc Get the current user's profile
 * @access Private
 */
router.get('/profile', auth, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    logger.debug('Fetching profile for user ID:', userId);
    
    // Get user profile from database
    const user = await User.getById(userId);
    
    if (!user) {
      logger.warn(`User profile not found for ID: ${userId}`);
      return next(ApiError.notFound('User not found'));
    }
    
    logger.debug('User profile retrieved:', JSON.stringify(user, null, 2));
    
    // Remove sensitive information
    delete user.password_hash;
    
    res.status(200).json(user);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    next(ApiError.internal('Failed to fetch user profile'));
  }
});

/**
 * @route PUT /api/users/profile
 * @desc Update the current user's profile
 * @access Private
 */
router.put('/profile', auth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, profilePicture, status } = req.body;
    
    // Update user profile
    const updatedUser = await User.update(userId, {
      fullName,
      profilePicture,
      status
    });
    
    if (!updatedUser) {
      return next(ApiError.notFound('User not found'));
    }
    
    // Remove sensitive information
    delete updatedUser.password_hash;
    
    res.status(200).json(updatedUser);
  } catch (error) {
    logger.error('Error updating user profile:', error);
    next(ApiError.internal('Failed to update user profile'));
  }
});

/**
 * @route GET /api/users/status
 * @desc Get online status for a list of users
 * @access Private
 */
router.get('/status', auth, async (req, res, next) => {
  try {
    const userIds = req.query.ids;
    
    if (!userIds) {
      return next(ApiError.badRequest('User IDs are required'));
    }
    
    // Parse user IDs
    const ids = userIds.split(',');
    
    // Get online status for users
    const statuses = await User.getOnlineStatus(ids);
    
    res.status(200).json(statuses);
  } catch (error) {
    logger.error('Error fetching user statuses:', error);
    next(ApiError.internal('Failed to fetch user statuses'));
  }
});

/**
 * @route GET /api/users/search
 * @desc Search for users by username or full name
 * @access Private
 */
router.get('/search', auth, async (req, res, next) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return next(ApiError.badRequest('Search query is required'));
    }
    
    // Get current user ID to exclude from results
    const currentUserId = req.user.userId || req.user.id;
    
    // Search users by username or full name
    const users = await User.search(query, currentUserId);
    
    res.status(200).json(users);
  } catch (error) {
    logger.error('Error searching users:', error);
    next(ApiError.internal('Failed to search users'));
  }
});

/**
 * @route GET /api/users/:id
 * @desc Get a user's public profile
 * @access Private
 */
router.get('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get user profile from database
    const user = await User.getById(id);
    
    if (!user) {
      return next(ApiError.notFound('User not found'));
    }
    
    // Remove sensitive information
    delete user.password_hash;
    
    res.status(200).json(user);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    next(ApiError.internal('Failed to fetch user profile'));
  }
});

module.exports = router;
