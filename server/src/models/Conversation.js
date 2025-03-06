const db = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class Conversation {
  /**
   * Create a new conversation
   * @param {Object} data - Conversation data
   * @param {boolean} data.isGroup - Whether this is a group conversation
   * @param {string} data.name - Name of the group conversation (null for direct)
   * @param {Array<string>} data.participantIds - Array of participant user IDs
   * @returns {Promise<Object>} Created conversation
   */
  static async create({ isGroup = false, name = null, participantIds }) {
    try {
      if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 2) {
        throw new Error('At least two participants are required');
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      // Insert conversation
      const query = `
        INSERT INTO conversations (id, is_group, name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, is_group, name, created_at, updated_at
      `;
      
      const result = await db.query(query, [id, isGroup, name, now, now]);
      const conversation = result.rows[0];

      // Add participants
      await Promise.all(participantIds.map(userId => 
        this.addParticipant(conversation.id, userId)
      ));

      // Get full conversation with participants
      return this.getById(conversation.id);
    } catch (error) {
      logger.error(`Error creating conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   * @param {string} id - Conversation ID
   * @returns {Promise<Object>} Conversation with participants
   */
  static async getById(id) {
    try {
      // Get conversation
      const conversationQuery = `
        SELECT id, is_group, name, created_at, updated_at
        FROM conversations
        WHERE id = $1
      `;
      
      const conversationResult = await db.query(conversationQuery, [id]);
      
      if (conversationResult.rows.length === 0) {
        return null;
      }
      
      const conversation = conversationResult.rows[0];
      
      // Get participants
      const participantsQuery = `
        SELECT u.id
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = $1
      `;
      
      const participantsResult = await db.query(participantsQuery, [id]);
      conversation.participants = participantsResult.rows;
      
      return conversation;
    } catch (error) {
      logger.error(`Error getting conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get direct conversation between two users
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Promise<Object>} Conversation or null if not found
   */
  static async getDirectConversation(userId1, userId2) {
    try {
      const query = `
        SELECT c.id
        FROM conversations c
        JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
        JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
        WHERE c.is_group = false
        AND cp1.user_id = $1
        AND cp2.user_id = $2
        AND (
          SELECT COUNT(*) FROM conversation_participants
          WHERE conversation_id = c.id
        ) = 2
      `;
      
      const result = await db.query(query, [userId1, userId2]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.getById(result.rows[0].id);
    } catch (error) {
      logger.error(`Error getting direct conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create or get direct conversation between two users
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Promise<Object>} Conversation
   */
  static async getOrCreateDirectConversation(userId1, userId2) {
    try {
      // Check if conversation already exists
      const existingConversation = await this.getDirectConversation(userId1, userId2);
      
      if (existingConversation) {
        return existingConversation;
      }
      
      // Create new direct conversation
      return this.create({
        isGroup: false,
        participantIds: [userId1, userId2]
      });
    } catch (error) {
      logger.error(`Error getting or creating direct conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add participant to conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async addParticipant(conversationId, userId) {
    try {
      const query = `
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (conversation_id, user_id) DO NOTHING
      `;
      
      await db.query(query, [conversationId, userId]);
    } catch (error) {
      logger.error(`Error adding participant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove participant from conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async removeParticipant(conversationId, userId) {
    try {
      const query = `
        DELETE FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2
      `;
      
      await db.query(query, [conversationId, userId]);
    } catch (error) {
      logger.error(`Error removing participant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user is a participant in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user is a participant
   */
  static async isParticipant(conversationId, userId) {
    try {
      const query = `
        SELECT 1 FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2
      `;
      
      const result = await db.query(query, [conversationId, userId]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error checking if user is participant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get conversations for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} Array of conversations
   */
  static async getByUserId(userId) {
    try {
      const query = `
        SELECT c.id
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = $1
        ORDER BY c.updated_at DESC
      `;
      
      const result = await db.query(query, [userId]);
      
      // Get full conversation details for each ID
      const conversations = await Promise.all(
        result.rows.map(row => this.getById(row.id))
      );
      
      return conversations;
    } catch (error) {
      logger.error(`Error getting user conversations: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update conversation last activity timestamp
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<void>}
   */
  static async updateLastActivity(conversationId) {
    try {
      const query = `
        UPDATE conversations
        SET updated_at = $1
        WHERE id = $2
      `;
      
      await db.query(query, [new Date().toISOString(), conversationId]);
    } catch (error) {
      logger.error(`Error updating conversation last activity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all conversations for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} Array of conversations
   */
  static async getForUser(userId) {
    try {
      const query = `
        SELECT c.id, c.is_group, c.name, c.created_at, c.updated_at
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = $1
        ORDER BY c.updated_at DESC
      `;
      
      const result = await db.query(query, [userId]);
      
      // Get participants for each conversation
      const conversations = await Promise.all(
        result.rows.map(async (conversation) => {
          const participantsQuery = `
            SELECT u.id, u.username, u.display_name, u.avatar_url
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = $1
          `;
          
          const participantsResult = await db.query(participantsQuery, [conversation.id]);
          
          return {
            id: conversation.id,
            isGroup: conversation.is_group,
            name: conversation.name,
            participants: participantsResult.rows,
            createdAt: conversation.created_at,
            updatedAt: conversation.updated_at
          };
        })
      );
      
      return conversations;
    } catch (error) {
      logger.error(`Error getting conversations for user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a group conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} updates - Updates to apply
   * @param {string} updates.name - New group name
   * @param {string} updates.avatarUrl - New group avatar URL
   * @returns {Promise<Object>} Updated conversation
   */
  static async updateGroup(conversationId, updates) {
    try {
      // Check if conversation exists and is a group
      const conversation = await this.getById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      if (!conversation.is_group) {
        throw new Error('Cannot update a non-group conversation');
      }
      
      const { name, avatarUrl } = updates;
      const updateFields = [];
      const values = [conversationId];
      let valueIndex = 2;
      
      if (name !== undefined) {
        updateFields.push(`name = $${valueIndex}`);
        values.push(name);
        valueIndex++;
      }
      
      if (avatarUrl !== undefined) {
        updateFields.push(`avatar_url = $${valueIndex}`);
        values.push(avatarUrl);
        valueIndex++;
      }
      
      if (updateFields.length === 0) {
        return conversation;
      }
      
      // Update the conversation
      const now = new Date().toISOString();
      updateFields.push(`updated_at = $${valueIndex}`);
      values.push(now);
      
      const query = `
        UPDATE conversations
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING id, is_group, name, avatar_url, created_at, updated_at
      `;
      
      const result = await db.query(query, values);
      
      // Get updated conversation with participants
      return this.getById(conversationId);
    } catch (error) {
      logger.error(`Error updating group conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add multiple participants to a group conversation
   * @param {string} conversationId - Conversation ID
   * @param {Array<string>} userIds - Array of user IDs to add
   * @returns {Promise<Object>} Updated conversation
   */
  static async addParticipants(conversationId, userIds) {
    try {
      // Check if conversation exists and is a group
      const conversation = await this.getById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      if (!conversation.is_group) {
        throw new Error('Cannot add participants to a non-group conversation');
      }
      
      // Add each participant
      await Promise.all(userIds.map(userId => 
        this.addParticipant(conversationId, userId)
      ));
      
      // Update the conversation's updated_at timestamp
      const now = new Date().toISOString();
      await db.query(
        `UPDATE conversations SET updated_at = $1 WHERE id = $2`,
        [now, conversationId]
      );
      
      // Get updated conversation with participants
      return this.getById(conversationId);
    } catch (error) {
      logger.error(`Error adding participants to group: ${error.message}`);
      throw error;
    }
  }

  /**
   * Make a user an admin of a group conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async makeAdmin(conversationId, userId) {
    try {
      // Check if conversation exists and is a group
      const conversation = await this.getById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      if (!conversation.is_group) {
        throw new Error('Cannot set admin for a non-group conversation');
      }
      
      // Check if user is a participant
      const isParticipant = await this.isParticipant(conversationId, userId);
      if (!isParticipant) {
        throw new Error('User is not a participant in this conversation');
      }
      
      // Make user an admin
      const query = `
        UPDATE conversation_participants
        SET is_admin = true
        WHERE conversation_id = $1 AND user_id = $2
      `;
      
      await db.query(query, [conversationId, userId]);
    } catch (error) {
      logger.error(`Error making user an admin: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove admin status from a user in a group conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async removeAdmin(conversationId, userId) {
    try {
      // Check if conversation exists and is a group
      const conversation = await this.getById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      if (!conversation.is_group) {
        throw new Error('Cannot remove admin for a non-group conversation');
      }
      
      // Remove admin status
      const query = `
        UPDATE conversation_participants
        SET is_admin = false
        WHERE conversation_id = $1 AND user_id = $2
      `;
      
      await db.query(query, [conversationId, userId]);
    } catch (error) {
      logger.error(`Error removing admin status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user is an admin of a group conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user is an admin
   */
  static async isAdmin(conversationId, userId) {
    try {
      const query = `
        SELECT is_admin FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2
      `;
      
      const result = await db.query(query, [conversationId, userId]);
      
      if (result.rows.length === 0) {
        return false;
      }
      
      return result.rows[0].is_admin === true;
    } catch (error) {
      logger.error(`Error checking if user is admin: ${error.message}`);
      throw error;
    }
  }

  /**
   * Leave a group conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async leaveGroup(conversationId, userId) {
    try {
      // Check if conversation exists and is a group
      const conversation = await this.getById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      if (!conversation.is_group) {
        throw new Error('Cannot leave a non-group conversation');
      }
      
      // Remove participant
      await this.removeParticipant(conversationId, userId);
      
      // Update the conversation's updated_at timestamp
      const now = new Date().toISOString();
      await db.query(
        `UPDATE conversations SET updated_at = $1 WHERE id = $2`,
        [now, conversationId]
      );
    } catch (error) {
      logger.error(`Error leaving group: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Conversation;
