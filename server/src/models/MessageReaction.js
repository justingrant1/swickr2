const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * MessageReaction Model
 * 
 * Represents a reaction to a message
 */
class MessageReaction {
  /**
   * Create a new message reaction
   * 
   * @param {Object} data - Reaction data
   * @param {string} data.messageId - ID of the message
   * @param {string} data.userId - ID of the user who reacted
   * @param {string} data.emoji - Emoji reaction
   * @returns {Promise<Object>} Created reaction
   */
  static async create(data) {
    const { messageId, userId, emoji } = data;

    // Validate required fields
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!emoji) {
      throw new Error('Emoji is required');
    }

    // Generate reaction ID
    const reactionId = uuidv4();
    const timestamp = new Date().toISOString();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if the user already reacted with this emoji
      const existingReaction = await client.query(
        `SELECT id FROM message_reactions 
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [messageId, userId, emoji]
      );

      // If the reaction already exists, return it
      if (existingReaction.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          id: existingReaction.rows[0].id,
          messageId,
          userId,
          emoji,
          timestamp
        };
      }

      // Insert reaction
      const result = await client.query(
        `INSERT INTO message_reactions (
          id, message_id, user_id, emoji, timestamp
        ) VALUES ($1, $2, $3, $4, $5) 
        RETURNING id`,
        [reactionId, messageId, userId, emoji, timestamp]
      );

      await client.query('COMMIT');

      // Return created reaction
      return {
        id: reactionId,
        messageId,
        userId,
        emoji,
        timestamp
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating message reaction: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a message reaction
   * 
   * @param {string} reactionId - ID of the reaction to delete
   * @param {string} userId - ID of the user who is deleting the reaction
   * @returns {Promise<boolean>} Whether the reaction was deleted
   */
  static async delete(reactionId, userId) {
    if (!reactionId) {
      throw new Error('Reaction ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    const client = await pool.connect();
    try {
      // Delete reaction (only if it belongs to the user)
      const result = await client.query(
        `DELETE FROM message_reactions 
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [reactionId, userId]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting message reaction: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a specific reaction from a message
   * 
   * @param {string} messageId - ID of the message
   * @param {string} userId - ID of the user who is deleting the reaction
   * @param {string} emoji - Emoji to delete
   * @returns {Promise<boolean>} Whether the reaction was deleted
   */
  static async deleteByEmoji(messageId, userId, emoji) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!emoji) {
      throw new Error('Emoji is required');
    }

    const client = await pool.connect();
    try {
      // Delete reaction (only if it belongs to the user)
      const result = await client.query(
        `DELETE FROM message_reactions 
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3
         RETURNING id`,
        [messageId, userId, emoji]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting message reaction: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all reactions for a message
   * 
   * @param {string} messageId - ID of the message
   * @returns {Promise<Array>} Array of reactions
   */
  static async getByMessageId(messageId) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    const client = await pool.connect();
    try {
      // Get all reactions for the message
      const result = await client.query(
        `SELECT r.id, r.message_id, r.user_id, r.emoji, r.timestamp,
                u.username, u.display_name, u.avatar_url
         FROM message_reactions r
         JOIN users u ON r.user_id = u.id
         WHERE r.message_id = $1
         ORDER BY r.timestamp ASC`,
        [messageId]
      );

      // Format the reactions
      return result.rows.map(row => ({
        id: row.id,
        messageId: row.message_id,
        userId: row.user_id,
        emoji: row.emoji,
        timestamp: row.timestamp,
        user: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url
        }
      }));
    } catch (error) {
      logger.error(`Error getting message reactions: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get reaction counts for a message grouped by emoji
   * 
   * @param {string} messageId - ID of the message
   * @returns {Promise<Array>} Array of reaction counts by emoji
   */
  static async getCountsByMessageId(messageId) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    const client = await pool.connect();
    try {
      // Get reaction counts grouped by emoji
      const result = await client.query(
        `SELECT emoji, COUNT(*) as count,
                ARRAY_AGG(user_id) as user_ids
         FROM message_reactions
         WHERE message_id = $1
         GROUP BY emoji
         ORDER BY count DESC`,
        [messageId]
      );

      // Format the reaction counts
      return result.rows.map(row => ({
        emoji: row.emoji,
        count: parseInt(row.count),
        userIds: row.user_ids
      }));
    } catch (error) {
      logger.error(`Error getting message reaction counts: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all reactions by a user for a message
   * 
   * @param {string} messageId - ID of the message
   * @param {string} userId - ID of the user
   * @returns {Promise<Array>} Array of reactions
   */
  static async getByMessageAndUser(messageId, userId) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    const client = await pool.connect();
    try {
      // Get all reactions by the user for the message
      const result = await client.query(
        `SELECT id, message_id, user_id, emoji, timestamp
         FROM message_reactions
         WHERE message_id = $1 AND user_id = $2
         ORDER BY timestamp ASC`,
        [messageId, userId]
      );

      // Format the reactions
      return result.rows.map(row => ({
        id: row.id,
        messageId: row.message_id,
        userId: row.user_id,
        emoji: row.emoji,
        timestamp: row.timestamp
      }));
    } catch (error) {
      logger.error(`Error getting user message reactions: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a user has reacted to a message with a specific emoji
   * 
   * @param {string} messageId - ID of the message
   * @param {string} userId - ID of the user
   * @param {string} emoji - Emoji to check
   * @returns {Promise<boolean>} Whether the user has reacted with the emoji
   */
  static async hasReacted(messageId, userId, emoji) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!emoji) {
      throw new Error('Emoji is required');
    }

    const client = await pool.connect();
    try {
      // Check if the user has reacted with the emoji
      const result = await client.query(
        `SELECT id FROM message_reactions
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3
         LIMIT 1`,
        [messageId, userId, emoji]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error checking message reaction: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Add a reaction to a message
   * 
   * @param {string} messageId - ID of the message
   * @param {string} userId - ID of the user who is reacting
   * @param {string} emoji - Emoji to add
   * @returns {Promise<Object>} Created reaction
   */
  static async addReaction(messageId, userId, emoji) {
    return this.create({ messageId, userId, emoji });
  }

  /**
   * Remove a reaction from a message
   * 
   * @param {string} messageId - ID of the message
   * @param {string} userId - ID of the user who is removing the reaction
   * @param {string} emoji - Emoji to remove
   * @returns {Promise<boolean>} Whether the reaction was removed
   */
  static async removeReaction(messageId, userId, emoji) {
    return this.deleteByEmoji(messageId, userId, emoji);
  }

  /**
   * Get all reactions for a message with user details
   * 
   * @param {string} messageId - ID of the message
   * @returns {Promise<Object>} Reactions, counts, and user reactions
   */
  static async getReactionsForMessage(messageId) {
    return this.getByMessageId(messageId);
  }

  /**
   * Get reaction counts for a message
   * 
   * @param {string} messageId - ID of the message
   * @returns {Promise<Array>} Array of reaction counts by emoji
   */
  static async getReactionCounts(messageId) {
    return this.getCountsByMessageId(messageId);
  }

  /**
   * Get all reactions by a user for a message
   * 
   * @param {string} messageId - ID of the message
   * @param {string} userId - ID of the user
   * @returns {Promise<Array>} Array of reactions
   */
  static async getUserReactionsForMessage(messageId, userId) {
    return this.getByMessageAndUser(messageId, userId);
  }

  /**
   * Check if a user has reacted to a message with a specific emoji
   * 
   * @param {string} messageId - ID of the message
   * @param {string} userId - ID of the user
   * @param {string} emoji - Emoji to check
   * @returns {Promise<boolean>} Whether the user has reacted with the emoji
   */
  static async hasUserReacted(messageId, userId, emoji) {
    return this.hasReacted(messageId, userId, emoji);
  }
}

module.exports = MessageReaction;
