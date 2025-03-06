const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { ApiError } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');
const { redisClient } = require('../../config/redis');
const Message = require('../../models/Message');
const User = require('../../models/User');

// Apply authentication middleware to all message routes
router.use(auth);

/**
 * Get user conversations
 * GET /api/messages/conversations
 */
router.get('/conversations', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    // Get conversations from database
    const conversations = await Message.getConversationsForUser(userId);
    
    res.status(200).json(conversations);
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    next(ApiError.internal('Failed to fetch conversations'));
  }
});

/**
 * Search messages
 * GET /api/messages/search
 */
router.get('/search', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = req.query.query;
    
    if (!query) {
      return next(ApiError.badRequest('Search query is required'));
    }
    
    // For now, return empty results
    // In a real implementation, this would search messages in a database
    res.status(200).json([]);
  } catch (error) {
    logger.error('Error searching messages:', error);
    next(ApiError.internal('Failed to search messages'));
  }
});

/**
 * Get messages for a conversation
 * GET /api/messages/:conversationId
 */
router.get('/:conversationId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const conversationId = req.params.conversationId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Validate conversation ID
    if (!conversationId) {
      return next(ApiError.badRequest('Conversation ID is required'));
    }
    
    // Get messages from database
    const messages = await Message.getByConversationId(conversationId, limit, offset);
    
    // Mark messages as read
    await Message.markAsRead(conversationId, userId);
    
    // Format messages for client
    const formattedMessages = messages.map(message => ({
      id: message.id,
      senderId: message.sender_id,
      conversationId: message.conversation_id,
      content: message.content,
      mediaId: message.media_id,
      mediaType: message.media_type,
      mediaUrl: message.media_url,
      timestamp: message.created_at,
      status: 'delivered',
      read: message.is_read
    }));
    
    res.status(200).json(formattedMessages);
  } catch (error) {
    logger.error('Error fetching messages:', error);
    next(ApiError.internal('Failed to fetch messages'));
  }
});

/**
 * Create or get a conversation between two users
 * POST /api/messages/conversation
 */
router.post('/conversation', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { contactId } = req.body;
    
    if (!contactId) {
      return next(ApiError.badRequest('Contact ID is required'));
    }
    
    // Check if contact exists
    const contact = await User.findById(contactId);
    if (!contact) {
      return next(ApiError.notFound('Contact not found'));
    }
    
    // Create or get conversation
    const conversation = await Message.getOrCreateConversation(userId, contactId);
    
    res.status(200).json({ conversationId: conversation.id });
  } catch (error) {
    logger.error('Error creating conversation:', error);
    next(ApiError.internal('Failed to create conversation'));
  }
});

/**
 * Get unread message counts
 * GET /api/messages/unread
 */
router.get('/unread', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get unread counts from database
    const unreadCounts = await Message.getUnreadCounts(userId);
    
    res.status(200).json(unreadCounts);
  } catch (error) {
    logger.error('Error getting unread counts:', error);
    next(ApiError.internal('Failed to get unread counts'));
  }
});

/**
 * Delete a message
 * DELETE /api/messages/:messageId
 */
router.delete('/:messageId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.messageId;
    
    if (!messageId) {
      return next(ApiError.badRequest('Message ID is required'));
    }
    
    // Not implemented yet
    res.status(501).json({ message: 'Message deletion not implemented yet' });
  } catch (error) {
    logger.error('Error deleting message:', error);
    next(ApiError.internal('Failed to delete message'));
  }
});

/**
 * Send a message
 * POST /api/messages
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId, content, contentType, mediaId, mediaType, mediaUrl } = req.body;
    
    // Validate required fields
    if (!conversationId) {
      return next(ApiError.badRequest('Conversation ID is required'));
    }
    
    if (!content && !mediaId) {
      return next(ApiError.badRequest('Message content or media is required'));
    }
    
    logger.debug(`Creating message in conversation ${conversationId} from user ${userId}`);
    
    // Create message
    const message = await Message.create({
      conversationId,
      senderId: userId,
      content: content || '',
      mediaId: mediaId || null,
      mediaType: mediaType || null,
      mediaUrl: mediaUrl || null
    });
    
    // Format message for client
    const formattedMessage = {
      id: message.id,
      senderId: message.sender_id,
      conversationId: message.conversation_id,
      content: message.content,
      mediaId: message.media_id,
      mediaType: message.media_type,
      mediaUrl: message.media_url,
      timestamp: message.created_at,
      status: 'sent',
      read: message.is_read
    };
    
    // In a real implementation, we would emit a WebSocket event here
    // to notify other participants of the new message
    
    res.status(201).json(formattedMessage);
  } catch (error) {
    logger.error('Error sending message:', error);
    next(ApiError.internal('Failed to send message'));
  }
});

module.exports = router;
