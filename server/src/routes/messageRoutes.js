const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');
const { io } = require('../socket');

/**
 * @route   POST /api/messages
 * @desc    Send a new message
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const { conversationId, content, mediaId, parentMessageId } = req.body;
    
    // Validate required fields
    if (!conversationId) {
      return res.status(400).json({ error: { message: 'Conversation ID is required' } });
    }
    
    if (!content && !mediaId) {
      return res.status(400).json({ error: { message: 'Message content or media is required' } });
    }
    
    // Check if user is a participant in the conversation
    const isParticipant = await Conversation.isParticipant(conversationId, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: { message: 'You are not a participant in this conversation' } });
    }
    
    // Create the message
    const message = await Message.create({
      conversationId,
      senderId: req.user.id,
      content,
      mediaId,
      parentMessageId
    });
    
    // Emit socket event for real-time updates
    io.to(`conversation:${conversationId}`).emit('new_message', message);
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/messages/:id/replies
 * @desc    Get replies to a message
 * @access  Private
 */
router.get('/:id/replies', auth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;
    
    // Get the message to check if user has access
    const message = await Message.getById(messageId);
    if (!message) {
      return res.status(404).json({ error: { message: 'Message not found' } });
    }
    
    // Check if user is a participant in the conversation
    const isParticipant = await Conversation.isParticipant(message.conversationId, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: { message: 'You are not a participant in this conversation' } });
    }
    
    // Get replies
    const replies = await Message.getReplies(messageId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json(replies);
  } catch (error) {
    console.error('Error getting message replies:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/messages/offline-queue
 * @desc    Store messages in offline queue for later delivery
 * @access  Private
 */
router.post('/offline-queue', auth, async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: { message: 'Messages array is required' } });
    }
    
    // Store messages in the offline queue
    const queuedMessages = await Message.queueOfflineMessages(req.user.id, messages);
    
    res.status(201).json({
      success: true,
      message: `${queuedMessages.length} messages queued for delivery`,
      queuedMessages
    });
  } catch (error) {
    console.error('Error queuing offline messages:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/messages/offline-queue
 * @desc    Get messages from offline queue
 * @access  Private
 */
router.get('/offline-queue', auth, async (req, res) => {
  try {
    // Get messages from the offline queue
    const queuedMessages = await Message.getOfflineMessages(req.user.id);
    
    res.json(queuedMessages);
  } catch (error) {
    console.error('Error getting offline messages:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   DELETE /api/messages/offline-queue/:id
 * @desc    Remove a message from offline queue after successful delivery
 * @access  Private
 */
router.delete('/offline-queue/:id', auth, async (req, res) => {
  try {
    const messageId = req.params.id;
    
    // Remove message from the offline queue
    await Message.removeFromOfflineQueue(req.user.id, messageId);
    
    res.json({
      success: true,
      message: 'Message removed from offline queue'
    });
  } catch (error) {
    console.error('Error removing offline message:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   PUT /api/messages/:id/read-receipt
 * @desc    Update read receipt status for a message
 * @access  Private
 */
router.put('/:id/read-receipt', auth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { enabled = true } = req.body;
    
    // Get the message to check if user has access
    const message = await Message.getById(messageId);
    if (!message) {
      return res.status(404).json({ error: { message: 'Message not found' } });
    }
    
    // Only the sender can control read receipts
    if (message.senderId !== req.user.id) {
      return res.status(403).json({ error: { message: 'Only the sender can control read receipts' } });
    }
    
    // Update read receipt status
    await Message.updateReadReceiptStatus(messageId, enabled);
    
    res.json({
      success: true,
      message: `Read receipts ${enabled ? 'enabled' : 'disabled'} for this message`
    });
  } catch (error) {
    console.error('Error updating read receipt status:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

module.exports = router;
