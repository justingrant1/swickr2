const MessageReaction = require('../../models/MessageReaction');
const Message = require('../../models/Message');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const { io } = require('../../websocket/socket');

/**
 * Reactions Controller
 * 
 * Handles API requests related to message reactions
 */
const reactionsController = {
  /**
   * Add a reaction to a message
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  addReaction: async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const userId = req.user.id;

      // Validate emoji
      if (!emoji) {
        return res.status(400).json({ error: 'Emoji is required' });
      }

      // Check if message exists
      const message = await Message.getById(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Check if user has access to the conversation
      const hasAccess = await Message.userHasAccessToMessage(userId, messageId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this message' });
      }

      // Add the reaction
      const reaction = await MessageReaction.create({
        messageId,
        userId,
        emoji
      });

      // Get user info
      const user = await User.getById(userId);

      // Format the reaction response
      const formattedReaction = {
        id: reaction.id,
        messageId,
        emoji,
        timestamp: reaction.timestamp,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl
        }
      };

      // Emit socket event to notify other users
      io.to(`conversation:${message.conversationId}`).emit('message:reaction:add', formattedReaction);

      // Return the reaction
      res.status(201).json(formattedReaction);
    } catch (error) {
      logger.error(`Error adding reaction: ${error.message}`);
      res.status(500).json({ error: 'Failed to add reaction' });
    }
  },

  /**
   * Add multiple reactions to a message in a single request
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  addReactionsBatch: async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emojis } = req.body;
      const userId = req.user.id;

      // Validate emojis
      if (!emojis || !Array.isArray(emojis) || emojis.length === 0) {
        return res.status(400).json({ error: 'Emojis array is required' });
      }

      // Check if message exists
      const message = await Message.getById(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Check if user has access to the conversation
      const hasAccess = await Message.userHasAccessToMessage(userId, messageId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this message' });
      }

      // Get user info
      const user = await User.getById(userId);

      // Process each emoji in batch
      const results = [];
      const startTime = Date.now();

      for (const emoji of emojis) {
        try {
          // Add the reaction
          const reaction = await MessageReaction.create({
            messageId,
            userId,
            emoji
          });

          // Format the reaction response
          const formattedReaction = {
            id: reaction.id,
            messageId,
            emoji,
            timestamp: reaction.timestamp,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl
            }
          };

          // Emit socket event to notify other users
          io.to(`conversation:${message.conversationId}`).emit('message:reaction:add', formattedReaction);

          results.push(formattedReaction);
        } catch (err) {
          // Log error but continue processing other emojis
          logger.error(`Error adding reaction for emoji ${emoji}: ${err.message}`);
          results.push({
            emoji,
            error: 'Failed to add reaction'
          });
        }
      }

      const endTime = Date.now();
      logger.info(`Batch adding ${emojis.length} reactions took ${endTime - startTime}ms`);

      // Return the reactions
      res.status(201).json({
        success: true,
        results,
        processingTime: endTime - startTime
      });
    } catch (error) {
      logger.error(`Error batch adding reactions: ${error.message}`);
      res.status(500).json({ error: 'Failed to add reactions' });
    }
  },

  /**
   * Remove a reaction from a message
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  removeReaction: async (req, res) => {
    try {
      const { messageId, emoji } = req.params;
      const userId = req.user.id;

      // Check if message exists
      const message = await Message.getById(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Check if user has access to the conversation
      const hasAccess = await Message.userHasAccessToMessage(userId, messageId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this message' });
      }

      // Remove the reaction
      const deleted = await MessageReaction.deleteByEmoji(messageId, userId, emoji);

      if (!deleted) {
        return res.status(404).json({ error: 'Reaction not found' });
      }

      // Emit socket event to notify other users
      io.to(`conversation:${message.conversationId}`).emit('message:reaction:remove', {
        messageId,
        userId,
        emoji
      });

      // Return success
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error(`Error removing reaction: ${error.message}`);
      res.status(500).json({ error: 'Failed to remove reaction' });
    }
  },

  /**
   * Remove multiple reactions from a message in a single request
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  removeReactionsBatch: async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emojis } = req.body;
      const userId = req.user.id;

      // Validate emojis
      if (!emojis || !Array.isArray(emojis) || emojis.length === 0) {
        return res.status(400).json({ error: 'Emojis array is required' });
      }

      // Check if message exists
      const message = await Message.getById(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Check if user has access to the conversation
      const hasAccess = await Message.userHasAccessToMessage(userId, messageId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this message' });
      }

      // Process each emoji in batch
      const results = [];
      const startTime = Date.now();

      for (const emoji of emojis) {
        try {
          // Remove the reaction
          const deleted = await MessageReaction.deleteByEmoji(messageId, userId, emoji);

          if (deleted) {
            // Emit socket event to notify other users
            io.to(`conversation:${message.conversationId}`).emit('message:reaction:remove', {
              messageId,
              userId,
              emoji
            });

            results.push({
              emoji,
              success: true
            });
          } else {
            results.push({
              emoji,
              success: false,
              error: 'Reaction not found'
            });
          }
        } catch (err) {
          // Log error but continue processing other emojis
          logger.error(`Error removing reaction for emoji ${emoji}: ${err.message}`);
          results.push({
            emoji,
            success: false,
            error: 'Failed to remove reaction'
          });
        }
      }

      const endTime = Date.now();
      logger.info(`Batch removing ${emojis.length} reactions took ${endTime - startTime}ms`);

      // Return success
      res.status(200).json({
        success: true,
        results,
        processingTime: endTime - startTime
      });
    } catch (error) {
      logger.error(`Error batch removing reactions: ${error.message}`);
      res.status(500).json({ error: 'Failed to remove reactions' });
    }
  },

  /**
   * Get all reactions for a message
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getReactions: async (req, res) => {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;

      // Check if message exists
      const message = await Message.getById(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Check if user has access to the conversation
      const hasAccess = await Message.userHasAccessToMessage(userId, messageId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to this message' });
      }

      // Get the reactions
      const reactions = await MessageReaction.getByMessageId(messageId);

      // Get the reaction counts
      const reactionCounts = await MessageReaction.getCountsByMessageId(messageId);

      // Get the user's reactions
      const userReactions = await MessageReaction.getByMessageAndUser(messageId, userId);
      const userReactionEmojis = userReactions.map(r => r.emoji);

      // Return the reactions
      res.status(200).json({
        reactions,
        reactionCounts,
        userReactions: userReactionEmojis
      });
    } catch (error) {
      logger.error(`Error getting reactions: ${error.message}`);
      res.status(500).json({ error: 'Failed to get reactions' });
    }
  }
};

module.exports = reactionsController;
