const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');
const { io } = require('../socket');

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations for the current user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await Conversation.getForUser(req.user.id);
    res.json(conversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/conversations/:id
 * @desc    Get a conversation by ID
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const conversation = await Conversation.getById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }
    
    // Check if user is a participant
    const isParticipant = await Conversation.isParticipant(conversation.id, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: { message: 'You are not a participant in this conversation' } });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/conversations
 * @desc    Create a new conversation (direct or group)
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const { isGroup, name, participantIds } = req.body;
    
    // Validate required fields
    if (!participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ error: { message: 'Participant IDs array is required' } });
    }
    
    // Ensure the current user is included in participants
    if (!participantIds.includes(req.user.id)) {
      participantIds.push(req.user.id);
    }
    
    // For group chats, name is required
    if (isGroup && !name) {
      return res.status(400).json({ error: { message: 'Group name is required' } });
    }
    
    // Create the conversation
    const conversation = await Conversation.create({
      isGroup,
      name,
      participantIds
    });
    
    // For group chats, make the creator an admin
    if (isGroup) {
      await Conversation.makeAdmin(conversation.id, req.user.id);
    }
    
    // Emit socket event for real-time updates
    participantIds.forEach(userId => {
      io.to(`user:${userId}`).emit('new_conversation', conversation);
    });
    
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/conversations/direct
 * @desc    Create or get a direct conversation with another user
 * @access  Private
 */
router.post('/direct', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: { message: 'User ID is required' } });
    }
    
    // Get or create direct conversation
    const conversation = await Conversation.getOrCreateDirectConversation(req.user.id, userId);
    
    res.json(conversation);
  } catch (error) {
    console.error('Error creating direct conversation:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   PUT /api/conversations/:id
 * @desc    Update a group conversation
 * @access  Private
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { name, avatarUrl } = req.body;
    
    // Check if user is a participant and admin
    const isParticipant = await Conversation.isParticipant(conversationId, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: { message: 'You are not a participant in this conversation' } });
    }
    
    const isAdmin = await Conversation.isAdmin(conversationId, req.user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: { message: 'Only admins can update group settings' } });
    }
    
    // Update the group
    const updatedConversation = await Conversation.updateGroup(conversationId, {
      name,
      avatarUrl
    });
    
    // Emit socket event for real-time updates
    updatedConversation.participants.forEach(participant => {
      io.to(`user:${participant.id}`).emit('conversation_updated', updatedConversation);
    });
    
    res.json(updatedConversation);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/conversations/:id/participants
 * @desc    Add participants to a group conversation
 * @access  Private
 */
router.post('/:id/participants', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: { message: 'User IDs array is required' } });
    }
    
    // Check if user is a participant and admin
    const isParticipant = await Conversation.isParticipant(conversationId, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: { message: 'You are not a participant in this conversation' } });
    }
    
    const isAdmin = await Conversation.isAdmin(conversationId, req.user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: { message: 'Only admins can add participants' } });
    }
    
    // Add participants
    const updatedConversation = await Conversation.addParticipants(conversationId, userIds);
    
    // Emit socket event for real-time updates
    updatedConversation.participants.forEach(participant => {
      io.to(`user:${participant.id}`).emit('conversation_updated', updatedConversation);
    });
    
    // Notify new participants
    userIds.forEach(userId => {
      io.to(`user:${userId}`).emit('added_to_group', updatedConversation);
    });
    
    res.json(updatedConversation);
  } catch (error) {
    console.error('Error adding participants:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   DELETE /api/conversations/:id/participants/:userId
 * @desc    Remove a participant from a group conversation
 * @access  Private
 */
router.delete('/:id/participants/:userId', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userIdToRemove = req.params.userId;
    
    // Check if user is a participant and admin (unless removing self)
    const isParticipant = await Conversation.isParticipant(conversationId, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: { message: 'You are not a participant in this conversation' } });
    }
    
    // Users can remove themselves, but only admins can remove others
    if (userIdToRemove !== req.user.id) {
      const isAdmin = await Conversation.isAdmin(conversationId, req.user.id);
      if (!isAdmin) {
        return res.status(403).json({ error: { message: 'Only admins can remove participants' } });
      }
    }
    
    // Get conversation before removing participant
    const conversation = await Conversation.getById(conversationId);
    
    // Remove participant
    await Conversation.removeParticipant(conversationId, userIdToRemove);
    
    // Get updated conversation
    const updatedConversation = await Conversation.getById(conversationId);
    
    // Emit socket event for real-time updates
    updatedConversation.participants.forEach(participant => {
      io.to(`user:${participant.id}`).emit('conversation_updated', updatedConversation);
    });
    
    // Notify removed participant
    io.to(`user:${userIdToRemove}`).emit('removed_from_group', {
      conversationId,
      conversationName: conversation.name
    });
    
    res.json({ success: true, message: 'Participant removed', conversation: updatedConversation });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/conversations/:id/admins/:userId
 * @desc    Make a user an admin of a group conversation
 * @access  Private
 */
router.post('/:id/admins/:userId', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userIdToPromote = req.params.userId;
    
    // Check if user is a participant and admin
    const isParticipant = await Conversation.isParticipant(conversationId, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: { message: 'You are not a participant in this conversation' } });
    }
    
    const isAdmin = await Conversation.isAdmin(conversationId, req.user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: { message: 'Only admins can promote other users' } });
    }
    
    // Make user an admin
    await Conversation.makeAdmin(conversationId, userIdToPromote);
    
    // Get updated conversation
    const updatedConversation = await Conversation.getById(conversationId);
    
    // Emit socket event for real-time updates
    updatedConversation.participants.forEach(participant => {
      io.to(`user:${participant.id}`).emit('conversation_updated', updatedConversation);
    });
    
    res.json({ success: true, message: 'User is now an admin', conversation: updatedConversation });
  } catch (error) {
    console.error('Error making user admin:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   DELETE /api/conversations/:id/admins/:userId
 * @desc    Remove admin status from a user in a group conversation
 * @access  Private
 */
router.delete('/:id/admins/:userId', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userIdToDemote = req.params.userId;
    
    // Check if user is a participant and admin
    const isParticipant = await Conversation.isParticipant(conversationId, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: { message: 'You are not a participant in this conversation' } });
    }
    
    const isAdmin = await Conversation.isAdmin(conversationId, req.user.id);
    if (!isAdmin) {
      return res.status(403).json({ error: { message: 'Only admins can demote other users' } });
    }
    
    // Remove admin status
    await Conversation.removeAdmin(conversationId, userIdToDemote);
    
    // Get updated conversation
    const updatedConversation = await Conversation.getById(conversationId);
    
    // Emit socket event for real-time updates
    updatedConversation.participants.forEach(participant => {
      io.to(`user:${participant.id}`).emit('conversation_updated', updatedConversation);
    });
    
    res.json({ success: true, message: 'User is no longer an admin', conversation: updatedConversation });
  } catch (error) {
    console.error('Error removing admin status:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   DELETE /api/conversations/:id/leave
 * @desc    Leave a group conversation
 * @access  Private
 */
router.delete('/:id/leave', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    
    // Check if user is a participant
    const isParticipant = await Conversation.isParticipant(conversationId, req.user.id);
    if (!isParticipant) {
      return res.status(403).json({ error: { message: 'You are not a participant in this conversation' } });
    }
    
    // Get conversation before leaving
    const conversation = await Conversation.getById(conversationId);
    
    // Leave the group
    await Conversation.leaveGroup(conversationId, req.user.id);
    
    // Get updated conversation
    const updatedConversation = await Conversation.getById(conversationId);
    
    // Emit socket event for real-time updates
    updatedConversation.participants.forEach(participant => {
      io.to(`user:${participant.id}`).emit('conversation_updated', updatedConversation);
    });
    
    res.json({ success: true, message: 'Left the group conversation' });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

module.exports = router;
