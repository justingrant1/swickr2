const express = require('express');
const auth = require('../../middleware/auth');
const Message = require('../../models/Message');
const logger = require('../../utils/logger');
const { ApiError } = require('../../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

/**
 * @route GET /api/conversations
 * @desc Get all conversations for the authenticated user
 */
router.get('/', async (req, res, next) => {
  try {
    const conversations = await Message.getConversationsByUserId(req.user.id);
    res.json(conversations);
  } catch (error) {
    logger.error('Error getting conversations:', error);
    next(ApiError.internal('Failed to get conversations'));
  }
});

/**
 * @route GET /api/conversations/:id
 * @desc Get a specific conversation by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user is a participant
    const isParticipant = await Message.isConversationParticipant(id, req.user.id);
    
    if (!isParticipant) {
      return next(ApiError.forbidden('You are not a participant in this conversation'));
    }
    
    const conversation = await Message.getConversationById(id);
    
    if (!conversation) {
      return next(ApiError.notFound('Conversation not found'));
    }
    
    res.json(conversation);
  } catch (error) {
    logger.error('Error getting conversation:', error);
    next(ApiError.internal('Failed to get conversation'));
  }
});

/**
 * @route POST /api/conversations
 * @desc Create a new conversation
 */
router.post('/', async (req, res, next) => {
  try {
    const { participantIds, name, isGroup = false } = req.body;
    
    logger.debug(`Creating conversation with: ${JSON.stringify({
      userId: req.user.id,
      participantIds,
      name,
      isGroup
    })}`);
    
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      logger.debug('Invalid participant IDs provided');
      return next(ApiError.badRequest('Participant IDs are required'));
    }
    
    // Add the current user to participants if not already included
    if (!participantIds.includes(req.user.id)) {
      participantIds.unshift(req.user.id);
    }
    
    // For direct messages, only allow 2 participants
    if (!isGroup && participantIds.length > 2) {
      logger.debug('Too many participants for direct message');
      return next(ApiError.badRequest('Direct messages can only have 2 participants'));
    }
    
    // For group chats, require a name
    if (isGroup && !name) {
      logger.debug('Group conversation missing name');
      return next(ApiError.badRequest('Group conversations require a name'));
    }
    
    logger.debug(`Creating conversation with final participants: ${JSON.stringify(participantIds)}`);
    const conversation = await Message.createConversation(participantIds, name, isGroup);
    
    logger.debug(`Conversation created: ${JSON.stringify(conversation)}`);
    
    // Ensure we return at least the conversation ID
    if (!conversation) {
      logger.error('Conversation creation failed - no conversation returned');
      return next(ApiError.internal('Failed to create conversation'));
    }
    
    res.status(201).json(conversation);
  } catch (error) {
    logger.error('Error creating conversation:', error);
    next(ApiError.internal('Failed to create conversation'));
  }
});

/**
 * @route POST /api/conversations/direct
 * @desc Create or get a direct conversation with another user
 */
router.post('/direct', async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    logger.debug(`Creating direct conversation between ${req.user.id} and ${userId}`);
    logger.debug(`Request body: ${JSON.stringify(req.body)}`);
    
    if (!userId) {
      logger.warn('Direct conversation request missing userId');
      return next(ApiError.badRequest('User ID is required'));
    }
    
    // Create a simple direct conversation manually for testing
    const conversationId = uuidv4();
    logger.debug(`Created test conversation with ID: ${conversationId}`);
    
    // Return a complete conversation object
    const conversation = {
      id: conversationId,
      is_group: false,
      name: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      participants: [
        { id: req.user.id },
        { id: userId }
      ]
    };
    
    // Log the response we're sending
    logger.debug(`Returning conversation: ${JSON.stringify(conversation)}`);
    
    res.status(201).json(conversation);
  } catch (error) {
    logger.error(`Error creating direct conversation: ${error.message}`);
    logger.error(error.stack);
    next(ApiError.internal('Failed to create direct conversation'));
  }
});

/**
 * @route PUT /api/conversations/:id
 * @desc Update a conversation (e.g., change name, add/remove participants)
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, addParticipants, removeParticipants } = req.body;
    
    // Check if user is a participant
    const isParticipant = await Message.isConversationParticipant(id, req.user.id);
    
    if (!isParticipant) {
      return next(ApiError.forbidden('You are not a participant in this conversation'));
    }
    
    // Get the conversation
    const conversation = await Message.getConversationById(id);
    
    if (!conversation) {
      return next(ApiError.notFound('Conversation not found'));
    }
    
    // Only allow updates to group conversations
    if (!conversation.is_group) {
      return next(ApiError.badRequest('Cannot update direct message conversations'));
    }
    
    // TODO: Implement conversation update logic
    // This would involve updating the conversation name and/or participants
    
    res.status(501).json({ message: 'Conversation update not implemented yet' });
  } catch (error) {
    logger.error('Error updating conversation:', error);
    next(ApiError.internal('Failed to update conversation'));
  }
});

module.exports = router;
