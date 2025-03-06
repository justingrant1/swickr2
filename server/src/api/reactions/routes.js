const express = require('express');
const router = express.Router();
const reactionsController = require('./controller');
const { authenticate } = require('../../middleware/auth');

/**
 * Reactions Routes
 * 
 * API endpoints for managing message reactions
 */

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/reactions/message/:messageId
 * @desc    Get all reactions for a message
 * @access  Private
 */
router.get('/message/:messageId', reactionsController.getReactions);

/**
 * @route   POST /api/reactions/message/:messageId
 * @desc    Add a reaction to a message
 * @access  Private
 */
router.post('/message/:messageId', reactionsController.addReaction);

/**
 * @route   POST /api/reactions/message/:messageId/batch
 * @desc    Add multiple reactions to a message in a single request
 * @access  Private
 */
router.post('/message/:messageId/batch', reactionsController.addReactionsBatch);

/**
 * @route   DELETE /api/reactions/message/:messageId/:emoji
 * @desc    Remove a reaction from a message
 * @access  Private
 */
router.delete('/message/:messageId/:emoji', reactionsController.removeReaction);

/**
 * @route   DELETE /api/reactions/message/:messageId/batch
 * @desc    Remove multiple reactions from a message in a single request
 * @access  Private
 */
router.delete('/message/:messageId/batch', reactionsController.removeReactionsBatch);

module.exports = router;
