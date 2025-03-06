const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const Conversation = require('./Conversation');

/**
 * Message Model
 * 
 * Represents a message in a conversation
 */
class Message {
  /**
   * Create a new message
   * 
   * @param {Object} data - Message data
   * @param {string} data.conversationId - ID of the conversation
   * @param {string} data.senderId - ID of the message sender
   * @param {string} data.content - Message content (optional if encrypted)
   * @param {string} data.encryptedContent - Encrypted message content (optional)
   * @param {string} data.iv - Initialization vector for decryption (optional)
   * @param {Object} data.recipientKeys - Encrypted keys for recipients (optional)
   * @param {boolean} data.isEncrypted - Whether the message is encrypted
   * @param {string} data.mediaId - ID of attached media (optional)
   * @param {string} data.mediaType - Type of attached media (optional)
   * @param {string} data.mediaUrl - URL of attached media (optional)
   * @param {string} data.mediaCaption - Caption for attached media (optional)
   * @param {number} data.mediaSize - Size of attached media in bytes (optional)
   * @param {string} data.mediaMimeType - MIME type of attached media (optional)
   * @param {string} data.status - Message status (default: 'sent')
   * @param {string} data.parentMessageId - ID of the parent message if this is a reply (optional)
   * @returns {Promise<Object>} Created message
   */
  static async create(data) {
    const {
      conversationId,
      senderId,
      content = '',
      encryptedContent = null,
      iv = null,
      recipientKeys = null,
      isEncrypted = false,
      mediaId = null,
      mediaType = null,
      mediaUrl = null,
      mediaCaption = null,
      mediaSize = null,
      mediaMimeType = null,
      status = 'sent',
      parentMessageId = null
    } = data;

    // Validate required fields
    if (!senderId) {
      throw new Error('Sender ID is required');
    }

    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    // For encrypted messages, we need the encrypted content and IV
    if (isEncrypted) {
      if (!encryptedContent) {
        throw new Error('Encrypted content is required for encrypted messages');
      }
      if (!iv) {
        throw new Error('Initialization vector is required for encrypted messages');
      }
      if (!recipientKeys || Object.keys(recipientKeys).length === 0) {
        throw new Error('Recipient keys are required for encrypted messages');
      }
    } else if (!content && !mediaId) {
      // For unencrypted messages, we need either content or media
      throw new Error('Message content or media is required');
    }

    // Validate media fields
    if (mediaId && (!mediaType || !mediaUrl)) {
      throw new Error('Media type and URL are required when media ID is provided');
    }

    // Validate parent message if this is a reply
    if (parentMessageId) {
      const parentExists = await this.exists(parentMessageId);
      if (!parentExists) {
        throw new Error('Parent message does not exist');
      }
      
      // Verify parent message is in the same conversation
      const parentMessage = await this.getById(parentMessageId);
      if (parentMessage.conversationId !== conversationId) {
        throw new Error('Parent message must be in the same conversation');
      }
    }

    // Generate message ID
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert message
      const result = await client.query(
        `INSERT INTO messages (
          id, conversation_id, sender_id, content, 
          encrypted_content, iv, recipient_keys, is_encrypted,
          media_id, media_type, media_url, media_caption, media_size, media_mime_type,
          status, timestamp, parent_message_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
        RETURNING id`,
        [messageId, conversationId, senderId, content, 
         encryptedContent, iv, JSON.stringify(recipientKeys || {}), isEncrypted,
         mediaId, mediaType, mediaUrl, mediaCaption, mediaSize, mediaMimeType, 
         status, timestamp, parentMessageId]
      );

      // Update conversation last_message and last_activity
      await client.query(
        `UPDATE conversations 
        SET last_message = $1, last_activity = $2
        WHERE id = $3`,
        [content || `Sent a ${mediaType || 'file'}`, timestamp, conversationId]
      );

      await client.query('COMMIT');

      // Return created message
      return {
        id: messageId,
        conversationId,
        senderId,
        content,
        isEncrypted,
        encryptedContent: isEncrypted ? encryptedContent : null,
        iv: isEncrypted ? iv : null,
        recipientKeys: isEncrypted ? recipientKeys : null,
        media: mediaId ? {
          id: mediaId,
          type: mediaType,
          url: mediaUrl,
          caption: mediaCaption,
          size: mediaSize,
          mimeType: mediaMimeType
        } : null,
        status,
        timestamp,
        parentMessageId
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating message: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new message with media attachment
   * 
   * @param {Object} data - Message data
   * @param {string} data.conversationId - ID of the conversation
   * @param {string} data.senderId - ID of the message sender
   * @param {string} data.content - Message content (optional if media is provided)
   * @param {Object} data.media - Media object (optional if content is provided)
   * @param {string} data.media.id - ID of the media
   * @param {string} data.media.type - Type of the media (image, video, audio, document)
   * @param {string} data.media.filename - Filename of the media
   * @param {string} data.media.mimeType - MIME type of the media
   * @param {number} data.media.size - Size of the media in bytes
   * @param {string} data.media.caption - Caption for the media (optional)
   * @param {string} data.status - Message status (default: 'sent')
   * @param {string} data.parentMessageId - ID of the parent message if this is a reply (optional)
   * @returns {Promise<Object>} Created message
   */
  static async createWithMedia(data) {
    const {
      conversationId,
      senderId,
      content = '',
      media = null,
      status = 'sent',
      parentMessageId = null
    } = data;

    // Validate required fields
    if (!senderId) {
      throw new Error('Sender ID is required');
    }

    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    // Validate that either content or media is provided
    if (!content && !media) {
      throw new Error('Message must have either content or media');
    }

    // Validate media object if provided
    if (media && (!media.id || !media.type || !media.filename || !media.mimeType)) {
      throw new Error('Media object must include id, type, filename, and mimeType');
    }

    // Validate parent message if this is a reply
    if (parentMessageId) {
      const parentExists = await this.exists(parentMessageId);
      if (!parentExists) {
        throw new Error('Parent message does not exist');
      }
      
      // Verify parent message is in the same conversation
      const parentMessage = await this.getById(parentMessageId);
      if (parentMessage.conversationId !== conversationId) {
        throw new Error('Parent message must be in the same conversation');
      }
    }

    // Generate message ID
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert message
      const result = await client.query(
        `INSERT INTO messages (
          id, conversation_id, sender_id, content, 
          media_id, media_type, media_url, media_caption, media_size, media_mime_type,
          status, created_at, parent_message_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
        RETURNING id`,
        [
          messageId, 
          conversationId, 
          senderId, 
          content, 
          media ? media.id : null, 
          media ? media.type : null, 
          media ? `/api/media/${media.id}` : null, 
          media && media.caption ? media.caption : null, 
          media ? media.size : null, 
          media ? media.mimeType : null, 
          status, 
          timestamp,
          parentMessageId
        ]
      );

      // Update conversation last_message and last_activity
      const lastMessageText = content || (media ? `Sent a ${media.type}` : 'Sent a message');
      await client.query(
        `UPDATE conversations 
        SET last_message = $1, updated_at = $2
        WHERE id = $3`,
        [lastMessageText, timestamp, conversationId]
      );

      await client.query('COMMIT');

      // Return created message
      return {
        id: messageId,
        conversationId,
        senderId,
        content,
        media: media ? {
          id: media.id,
          type: media.type,
          url: `/api/media/${media.id}`,
          filename: media.filename,
          caption: media.caption || null,
          size: media.size,
          mimeType: media.mimeType
        } : null,
        status,
        timestamp,
        parentMessageId,
        isRead: false
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating message with media: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a message by ID
   * 
   * @param {string} messageId - ID of the message to get
   * @returns {Promise<Object|null>} Message or null if not found
   */
  static async getById(messageId) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    try {
      const result = await pool.query(
        `SELECT 
          m.id, m.conversation_id as "conversationId", m.sender_id as "senderId", m.content, 
          m.media_id as "mediaId", m.media_type as "mediaType", m.media_url as "mediaUrl", m.media_caption as "mediaCaption",
          m.media_size as "mediaSize", m.media_mime_type as "mediaMimeType",
          m.status, m.read, m.timestamp,
          u.username as "senderUsername", u.full_name as "senderName"
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.id = $1`,
        [messageId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const message = result.rows[0];

      return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderUsername: message.senderUsername,
        content: message.content,
        media: message.mediaId ? {
          id: message.mediaId,
          type: message.mediaType,
          url: message.mediaUrl,
          caption: message.mediaCaption,
          size: message.mediaSize,
          mimeType: message.mediaMimeType
        } : null,
        status: message.status,
        timestamp: message.timestamp,
        parentMessageId: message.parentMessageId
      };
    } catch (error) {
      logger.error(`Error getting message by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   * 
   * @param {string} conversationId - ID of the conversation
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of messages to return
   * @param {number} options.offset - Number of messages to skip
   * @returns {Promise<Array<Object>>} Array of messages
   */
  static async getByConversation(conversationId, options = {}) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const { limit = 50, offset = 0 } = options;

    try {
      const result = await pool.query(
        `SELECT 
          m.id, m.conversation_id as "conversationId", m.sender_id as "senderId", m.content, 
          m.media_id as "mediaId", m.media_type as "mediaType", m.media_url as "mediaUrl", m.media_caption as "mediaCaption",
          m.media_size as "mediaSize", m.media_mime_type as "mediaMimeType",
          m.status, m.read, m.timestamp,
          u.username as "senderUsername", u.full_name as "senderName"
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1
        ORDER BY m.timestamp DESC
        LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      return result.rows.map(message => ({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderUsername: message.senderUsername,
        content: message.content,
        media: message.mediaId ? {
          id: message.mediaId,
          type: message.mediaType,
          url: message.mediaUrl,
          caption: message.mediaCaption,
          size: message.mediaSize,
          mimeType: message.mediaMimeType
        } : null,
        status: message.status,
        timestamp: message.timestamp,
        parentMessageId: message.parentMessageId
      }));
    } catch (error) {
      logger.error(`Error getting messages by conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update message status
   * 
   * @param {string} messageId - ID of the message to update
   * @param {string} status - New status
   * @returns {Promise<boolean>} Success indicator
   */
  static async updateStatus(messageId, status) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    // Validate status
    const validStatuses = ['sending', 'sent', 'delivered', 'read', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    try {
      const result = await pool.query(
        `UPDATE messages SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
        [status, messageId]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error updating message status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a message
   * 
   * @param {string} messageId - ID of the message to delete
   * @param {string} userId - ID of the user performing the deletion
   * @returns {Promise<boolean>} Success indicator
   */
  static async delete(messageId, userId) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user has permission to delete the message
      const checkResult = await client.query(
        'SELECT sender_id, media_id FROM messages WHERE id = $1',
        [messageId]
      );

      if (checkResult.rows.length === 0) {
        return false;
      }

      const { sender_id, media_id } = checkResult.rows[0];

      // Only allow sender to delete their own messages
      if (sender_id !== userId) {
        return false;
      }

      // Delete message
      const deleteResult = await client.query(
        'DELETE FROM messages WHERE id = $1 RETURNING id',
        [messageId]
      );

      // If message had media and no other messages reference it, mark media for cleanup
      if (media_id) {
        const mediaCheckResult = await client.query(
          'SELECT COUNT(*) as count FROM messages WHERE media_id = $1 AND id != $2',
          [media_id, messageId]
        );

        if (mediaCheckResult.rows[0].count === '0') {
          // No other messages reference this media, mark for cleanup
          // Note: Actual media deletion should be handled by a separate cleanup process
          await client.query(
            'UPDATE media SET marked_for_deletion = true WHERE id = $1',
            [media_id]
          );
        }
      }

      await client.query('COMMIT');
      return deleteResult.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error deleting message: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark all messages in a conversation as read for a user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (recipient)
   * @returns {number} Number of messages marked as read
   */
  static async markConversationAsRead(conversationId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `UPDATE messages 
         SET read = TRUE 
         WHERE conversation_id = $1 AND sender_id != $2 AND read = FALSE 
         RETURNING id`,
        [conversationId, userId]
      );
      
      // Update last_read_at in conversation_participants
      await client.query(
        `UPDATE conversation_participants 
         SET last_read_at = CURRENT_TIMESTAMP 
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
      );
      
      await client.query('COMMIT');
      
      return result.rowCount;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error marking conversation as read: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Mark a specific message as read
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID (recipient)
   * @returns {boolean} True if message was marked as read
   */
  static async markAsRead(messageId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // First check if the user is a participant in the conversation
      const messageResult = await client.query(
        `SELECT conversation_id FROM messages WHERE id = $1`,
        [messageId]
      );
      
      if (messageResult.rows.length === 0) {
        return false;
      }
      
      const conversationId = messageResult.rows[0].conversation_id;
      
      // Check if user is participant
      const participantResult = await client.query(
        `SELECT 1 FROM conversation_participants 
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
      );
      
      if (participantResult.rows.length === 0) {
        return false;
      }
      
      // Mark message as read
      const result = await client.query(
        `UPDATE messages 
         SET read = TRUE 
         WHERE id = $1 AND sender_id != $2 AND read = FALSE 
         RETURNING id`,
        [messageId, userId]
      );
      
      // Update last_read_at in conversation_participants
      if (result.rows.length > 0) {
        await client.query(
          `UPDATE conversation_participants 
           SET last_read_at = CURRENT_TIMESTAMP 
           WHERE conversation_id = $1 AND user_id = $2`,
          [conversationId, userId]
        );
      }
      
      await client.query('COMMIT');
      
      return result.rows.length > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error marking message as read: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get or create a conversation between two users
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Object} Conversation
   */
  static async getOrCreateConversation(userId1, userId2) {
    try {
      return await Conversation.getOrCreateDirectConversation(userId1, userId2);
    } catch (error) {
      logger.error(`Error getting or creating conversation: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get unread message counts by user ID
   * @param {string} userId - User ID
   * @returns {Object} Object with conversation IDs as keys and unread counts as values
   */
  static async getUnreadCountsByUserId(userId) {
    try {
      const result = await pool.query(
        `SELECT c.id as conversation_id, COUNT(m.id) as unread_count
         FROM conversations c
         JOIN conversation_participants cp ON c.id = cp.conversation_id
         JOIN messages m ON c.id = m.conversation_id
         WHERE cp.user_id = $1 
         AND m.sender_id != $1 
         AND m.read = FALSE
         GROUP BY c.id`,
        [userId]
      );
      
      // Convert to object with conversation IDs as keys
      const unreadCounts = {};
      result.rows.forEach(row => {
        unreadCounts[row.conversation_id] = parseInt(row.unread_count);
      });
      
      return unreadCounts;
    } catch (error) {
      logger.error('Error getting unread counts:', error);
      throw error;
    }
  }
  
  /**
   * Get conversations for a user
   * @param {string} userId - User ID
   * @returns {Array} Array of conversations with last message
   */
  static async getConversationsByUserId(userId) {
    try {
      const result = await pool.query(
        `WITH last_messages AS (
          SELECT DISTINCT ON (m.conversation_id)
            m.conversation_id,
            m.id as message_id,
            m.sender_id,
            m.content,
            m.created_at,
            m.read
          FROM messages m
          ORDER BY m.conversation_id, m.created_at DESC
        )
        SELECT 
          c.id, 
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at,
          lm.message_id,
          lm.sender_id,
          lm.content as last_message,
          lm.created_at as last_message_time,
          lm.read as last_message_read,
          cp.last_read_at,
          (
            SELECT json_agg(json_build_object(
              'id', u.id,
              'username', u.username,
              'fullName', u.full_name,
              'profilePicture', u.profile_picture,
              'status', u.status
            ))
            FROM conversation_participants cp2
            JOIN users u ON cp2.user_id = u.id
            WHERE cp2.conversation_id = c.id AND cp2.user_id != $1
          ) as participants,
          (
            SELECT COUNT(*)
            FROM messages m2
            WHERE m2.conversation_id = c.id
            AND m2.sender_id != $1
            AND m2.read = FALSE
          ) as unread_count
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        LEFT JOIN last_messages lm ON c.id = lm.conversation_id
        WHERE cp.user_id = $1
        ORDER BY c.updated_at DESC`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting conversations:', error);
      throw error;
    }
  }
  
  /**
   * Get a conversation by ID with participants
   * @param {string} conversationId - Conversation ID
   * @returns {Object} Conversation with participants
   */
  static async getConversationById(conversationId) {
    try {
      logger.debug(`Getting conversation by ID: ${conversationId}`);
      
      const result = await pool.query(
        `SELECT 
          c.id, 
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at,
          (
            SELECT json_agg(json_build_object(
              'id', u.id,
              'username', u.username,
              'fullName', u.full_name,
              'profilePicture', u.profile_picture,
              'status', u.status,
              'lastReadAt', cp2.last_read_at
            ))
            FROM conversation_participants cp2
            JOIN users u ON cp2.user_id = u.id
            WHERE cp2.conversation_id = c.id
          ) as participants
        FROM conversations c
        WHERE c.id = $1`,
        [conversationId]
      );
      
      if (result.rows.length === 0) {
        logger.warn(`No conversation found with ID: ${conversationId}`);
        return { id: conversationId, participants: [] };
      }
      
      logger.debug(`Retrieved conversation: ${JSON.stringify(result.rows[0])}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error getting conversation ${conversationId}:`, error);
      // Return a minimal object with the ID to avoid null reference errors
      return { id: conversationId, participants: [] };
    }
  }
  
  /**
   * Check if a user is a participant in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {boolean} True if user is a participant
   */
  static async isConversationParticipant(conversationId, userId) {
    try {
      const result = await pool.query(
        `SELECT 1
         FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, userId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking conversation participant:', error);
      throw error;
    }
  }
  
  /**
   * Create a new conversation
   * @param {Array} participantIds - Array of user IDs to include in the conversation
   * @param {string} name - Conversation name (required for group chats)
   * @param {boolean} isGroup - Whether this is a group conversation
   * @returns {Object} Created conversation
   */
  static async createConversation(participantIds, name = null, isGroup = false) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      logger.debug(`Creating conversation with participants: ${JSON.stringify(participantIds)}, name: ${name}, isGroup: ${isGroup}`);
      
      // If it's a direct message (not a group), check if conversation already exists
      if (!isGroup && participantIds.length === 2) {
        logger.debug(`Checking for existing direct conversation between ${participantIds[0]} and ${participantIds[1]}`);
        const existingConversation = await client.query(
          `SELECT c.id
           FROM conversations c
           JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
           JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
           WHERE c.is_group = FALSE
           AND cp1.user_id = $1 AND cp2.user_id = $2
           AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
           LIMIT 1`,
          [participantIds[0], participantIds[1]]
        );
        
        if (existingConversation.rows.length > 0) {
          // Return existing conversation
          const conversationId = existingConversation.rows[0].id;
          logger.debug(`Found existing conversation: ${conversationId}`);
          const conversation = await this.getConversationById(conversationId);
          await client.query('COMMIT');
          return conversation;
        }
      }
      
      // Create new conversation
      const conversationId = uuidv4();
      logger.debug(`Creating new conversation with ID: ${conversationId}`);
      
      const newConversation = await client.query(
        `INSERT INTO conversations (id, is_group, name) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at`,
        [conversationId, isGroup, name]
      );
      
      logger.debug(`New conversation created: ${JSON.stringify(newConversation.rows[0])}`);
      
      // Add participants
      for (const participantId of participantIds) {
        logger.debug(`Adding participant ${participantId} to conversation ${conversationId}`);
        await client.query(
          `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)`,
          [conversationId, participantId]
        );
      }
      
      await client.query('COMMIT');
      
      // Get the full conversation with participants
      const fullConversation = await this.getConversationById(conversationId);
      logger.debug(`Full conversation: ${JSON.stringify(fullConversation)}`);
      
      // If fullConversation is null or doesn't have an id, return a minimal object with the ID
      if (!fullConversation || !fullConversation.id) {
        logger.warn(`Could not retrieve full conversation details for ${conversationId}, returning minimal object`);
        return { 
          id: conversationId,
          is_group: isGroup,
          name: name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          participants: participantIds.map(id => ({ id }))
        };
      }
      
      return fullConversation;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating conversation:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Find a message by media ID
   * @param {string} mediaId - Media ID
   * @returns {Promise<Object|null>} Message or null if not found
   */
  static async findByMediaId(mediaId) {
    try {
      const result = await pool.query(
        `SELECT m.id, m.conversation_id as "conversationId", m.sender_id as "senderId", 
                m.content, m.media_id as "mediaId", m.media_type as "mediaType", 
                m.media_url as "mediaUrl", m.media_caption as "mediaCaption",
                m.media_size as "mediaSize", m.media_mime_type as "mediaMimeType",
                m.status, m.read, m.timestamp,
                u.username as "senderUsername", u.full_name as "senderName"
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.media_id = $1 
         LIMIT 1`,
        [mediaId]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error(`Error finding message by media ID: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update media information for a message
   * @param {string} messageId - Message ID
   * @param {Object} mediaData - Media data to update
   * @param {string} [mediaData.mediaId] - Media ID
   * @param {string} [mediaData.mediaType] - Media type
   * @param {string} [mediaData.mediaUrl] - Media URL
   * @param {string} [mediaData.mediaCaption] - Media caption
   * @param {number} [mediaData.mediaSize] - Media size in bytes
   * @param {string} [mediaData.mediaMimeType] - Media MIME type
   * @returns {Promise<Object|null>} Updated message or null if not found
   */
  static async updateMediaInfo(messageId, mediaData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const { 
        mediaId, 
        mediaType, 
        mediaUrl, 
        mediaCaption,
        mediaSize,
        mediaMimeType
      } = mediaData;
      
      const result = await client.query(
        `UPDATE messages 
         SET media_id = COALESCE($1, media_id),
             media_type = COALESCE($2, media_type),
             media_url = COALESCE($3, media_url),
             media_caption = COALESCE($4, media_caption),
             media_size = COALESCE($5, media_size),
             media_mime_type = COALESCE($6, media_mime_type)
         WHERE id = $7
         RETURNING id, conversation_id as "conversationId", sender_id as "senderId", 
                  content, media_id as "mediaId", media_type as "mediaType", 
                  media_url as "mediaUrl", media_caption as "mediaCaption",
                  media_size as "mediaSize", media_mime_type as "mediaMimeType",
                  status, read, timestamp`,
        [mediaId, mediaType, mediaUrl, mediaCaption, mediaSize, mediaMimeType, messageId]
      );
      
      await client.query('COMMIT');
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error updating message media info: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Create a message with media attachment
   * @param {Object} messageData - Message data
   * @param {string} messageData.conversationId - Conversation ID
   * @param {string} messageData.senderId - Sender user ID
   * @param {string} [messageData.content] - Message content (optional)
   * @param {Object} mediaData - Media data
   * @param {string} mediaData.mediaId - Media ID
   * @param {string} mediaData.mediaType - Media type
   * @param {string} mediaData.mediaUrl - Media URL
   * @param {string} [mediaData.mediaCaption] - Media caption
   * @param {number} [mediaData.mediaSize] - Media size in bytes
   * @param {string} [mediaData.mediaMimeType] - Media MIME type
   * @returns {Promise<Object>} Created message
   */
  static async createMediaMessage(messageData, mediaData) {
    return this.create({
      ...messageData,
      ...mediaData
    });
  }
  
  /**
   * Get messages with media for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} [mediaType] - Filter by media type (optional)
   * @param {number} limit - Maximum number of messages to return
   * @param {number} offset - Number of messages to skip
   * @returns {Promise<Array>} Array of messages with media
   */
  static async getMediaMessages(conversationId, mediaType = null, limit = 50, offset = 0) {
    try {
      let query = `
        SELECT m.id, m.conversation_id as "conversationId", m.sender_id as "senderId", 
               m.content, m.media_id as "mediaId", m.media_type as "mediaType", 
               m.media_url as "mediaUrl", m.media_caption as "mediaCaption",
               m.media_size as "mediaSize", m.media_mime_type as "mediaMimeType",
               m.status, m.read, m.timestamp,
               u.username as "senderUsername", u.full_name as "senderName"
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1 AND m.media_id IS NOT NULL
      `;
      
      const params = [conversationId];
      
      if (mediaType) {
        query += ` AND m.media_type = $2`;
        params.push(mediaType);
      }
      
      query += ` ORDER BY m.timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting media messages: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update message status
   * 
   * @param {string} messageId - ID of the message
   * @param {string} status - New status (sent, delivered, read, failed)
   * @returns {Promise<boolean>} Success
   */
  static async updateStatus(messageId, status) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    // Validate status
    const validStatuses = ['sending', 'sent', 'delivered', 'read', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    try {
      const result = await pool.query(
        `UPDATE messages SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
        [status, messageId]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error updating message status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark all messages in a conversation as read for a specific user
   * 
   * @param {string} conversationId - ID of the conversation
   * @param {string} userId - ID of the user who read the messages
   * @returns {Promise<number>} Number of messages marked as read
   */
  static async markAsRead(conversationId, userId) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      // Only mark messages as read if:
      // 1. They are in the specified conversation
      // 2. They were not sent by the current user
      // 3. They are not already marked as read
      const result = await pool.query(
        `UPDATE messages 
         SET status = 'read', updated_at = NOW() 
         WHERE conversation_id = $1 
         AND sender_id != $2 
         AND status != 'read'
         RETURNING id`,
        [conversationId, userId]
      );

      return result.rowCount;
    } catch (error) {
      logger.error(`Error marking messages as read: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get unread message count for a user
   * 
   * @param {string} userId - ID of the user
   * @returns {Promise<Object>} Object with conversation IDs as keys and unread counts as values
   */
  static async getUnreadCounts(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      // Get conversations where the user is a participant
      const conversations = await Conversation.getByParticipant(userId);
      
      if (!conversations || conversations.length === 0) {
        return {};
      }

      const conversationIds = conversations.map(conv => conv.id);
      
      // Get unread message counts for each conversation
      const result = await pool.query(
        `SELECT conversation_id, COUNT(*) as unread_count
         FROM messages
         WHERE conversation_id = ANY($1)
         AND sender_id != $2
         AND status != 'read'
         GROUP BY conversation_id`,
        [conversationIds, userId]
      );

      // Convert to object with conversation IDs as keys
      const unreadCounts = {};
      result.rows.forEach(row => {
        unreadCounts[row.conversation_id] = parseInt(row.unread_count, 10);
      });

      return unreadCounts;
    } catch (error) {
      logger.error(`Error getting unread message counts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get message delivery status
   * 
   * @param {string} messageId - ID of the message
   * @returns {Promise<Object>} Message status object
   */
  static async getDeliveryStatus(messageId) {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    try {
      const result = await pool.query(
        `SELECT id, status, updated_at
         FROM messages
         WHERE id = $1`,
        [messageId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Message not found: ${messageId}`);
      }

      return {
        messageId: result.rows[0].id,
        status: result.rows[0].status,
        timestamp: result.rows[0].updated_at
      };
    } catch (error) {
      logger.error(`Error getting message delivery status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get replies to a message
   * 
   * @param {string} messageId - ID of the parent message
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of messages to return
   * @param {number} options.offset - Number of messages to skip
   * @returns {Promise<Array<Object>>} Array of reply messages
   */
  static async getReplies(messageId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    try {
      const result = await pool.query(
        `SELECT 
          m.id, m.conversation_id, m.sender_id, m.content, 
          m.is_encrypted, m.media_id, m.media_type, m.media_url, 
          m.media_caption, m.status, m.timestamp, m.parent_message_id,
          u.username as sender_username
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.parent_message_id = $1
        ORDER BY m.timestamp ASC
        LIMIT $2 OFFSET $3`,
        [messageId, limit, offset]
      );

      return result.rows.map(message => ({
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        senderUsername: message.sender_username,
        content: message.content,
        isEncrypted: message.is_encrypted,
        media: message.media_id ? {
          id: message.media_id,
          type: message.media_type,
          url: message.media_url,
          caption: message.media_caption
        } : null,
        status: message.status,
        timestamp: message.timestamp,
        parentMessageId: message.parent_message_id
      }));
    } catch (error) {
      logger.error(`Error getting message replies: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a message exists
   * 
   * @param {string} id - Message ID
   * @returns {Promise<boolean>} True if message exists
   */
  static async exists(id) {
    try {
      const result = await pool.query(
        'SELECT 1 FROM messages WHERE id = $1',
        [id]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error checking message existence: ${error.message}`);
      throw error;
    }
  }

  /**
   * Queue messages for offline delivery
   * 
   * @param {string} userId - ID of the user who is offline
   * @param {Array<Object>} messages - Array of messages to queue
   * @returns {Promise<Array<Object>>} Array of queued messages
   */
  static async queueOfflineMessages(userId, messages) {
    try {
      const client = await pool.connect();
      const queuedMessages = [];
      
      await client.query('BEGIN');
      
      for (const message of messages) {
        const {
          conversationId,
          content,
          mediaId = null,
          parentMessageId = null
        } = message;
        
        // Validate required fields
        if (!conversationId) {
          throw new Error('Conversation ID is required for all messages');
        }
        
        if (!content && !mediaId) {
          throw new Error('Message content or media is required for all messages');
        }
        
        // Generate message ID and timestamp
        const messageId = uuidv4();
        const timestamp = new Date().toISOString();
        
        // Insert into offline queue
        await client.query(
          `INSERT INTO offline_message_queue (
            id, user_id, conversation_id, content, 
            media_id, parent_message_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [messageId, userId, conversationId, content, mediaId, parentMessageId, timestamp]
        );
        
        queuedMessages.push({
          id: messageId,
          userId,
          conversationId,
          content,
          mediaId,
          parentMessageId,
          timestamp
        });
      }
      
      await client.query('COMMIT');
      return queuedMessages;
    } catch (error) {
      logger.error(`Error queuing offline messages: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get offline messages for a user
   * 
   * @param {string} userId - ID of the user
   * @returns {Promise<Array<Object>>} Array of queued messages
   */
  static async getOfflineMessages(userId) {
    try {
      const result = await pool.query(
        `SELECT 
          id, user_id, conversation_id, content, 
          media_id, parent_message_id, created_at
        FROM offline_message_queue
        WHERE user_id = $1
        ORDER BY created_at ASC`,
        [userId]
      );
      
      return result.rows.map(message => ({
        id: message.id,
        userId: message.user_id,
        conversationId: message.conversation_id,
        content: message.content,
        mediaId: message.media_id,
        parentMessageId: message.parent_message_id,
        timestamp: message.created_at
      }));
    } catch (error) {
      logger.error(`Error getting offline messages: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Remove a message from the offline queue
   * 
   * @param {string} userId - ID of the user
   * @param {string} messageId - ID of the message to remove
   * @returns {Promise<void>}
   */
  static async removeFromOfflineQueue(userId, messageId) {
    try {
      await pool.query(
        `DELETE FROM offline_message_queue
        WHERE id = $1 AND user_id = $2`,
        [messageId, userId]
      );
    } catch (error) {
      logger.error(`Error removing message from offline queue: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Process offline messages for a user who has come online
   * 
   * @param {string} userId - ID of the user who is now online
   * @returns {Promise<Array<Object>>} Array of processed messages
   */
  static async processOfflineMessages(userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get all offline messages for the user
      const offlineMessages = await this.getOfflineMessages(userId);
      const processedMessages = [];
      
      // Process each message
      for (const message of offlineMessages) {
        // Create the actual message
        const createdMessage = await this.create({
          conversationId: message.conversationId,
          senderId: userId,
          content: message.content,
          mediaId: message.mediaId,
          parentMessageId: message.parentMessageId,
          status: 'sent'
        });
        
        // Remove from offline queue
        await this.removeFromOfflineQueue(userId, message.id);
        
        processedMessages.push(createdMessage);
      }
      
      await client.query('COMMIT');
      return processedMessages;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error processing offline messages: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Update read receipt status for a message
   * 
   * @param {string} messageId - ID of the message
   * @param {boolean} enabled - Whether read receipts are enabled
   * @returns {Promise<void>}
   */
  static async updateReadReceiptStatus(messageId, enabled) {
    try {
      await pool.query(
        `UPDATE messages
        SET read_receipts_enabled = $1
        WHERE id = $2`,
        [enabled, messageId]
      );
    } catch (error) {
      logger.error(`Error updating read receipt status: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Mark a message as read by a user
   * 
   * @param {string} messageId - ID of the message
   * @param {string} userId - ID of the user who read the message
   * @returns {Promise<void>}
   */
  static async markAsRead(messageId, userId) {
    try {
      // Check if read receipts are enabled for this message
      const message = await this.getById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }
      
      // If read receipts are disabled, don't record the read status
      if (message.readReceiptsEnabled === false) {
        return;
      }
      
      // Record the read status
      await pool.query(
        `INSERT INTO message_read_status (message_id, user_id, read_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (message_id, user_id) DO UPDATE
        SET read_at = $3`,
        [messageId, userId, new Date().toISOString()]
      );
    } catch (error) {
      logger.error(`Error marking message as read: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get read status for a message
   * 
   * @param {string} messageId - ID of the message
   * @returns {Promise<Array<Object>>} Array of read statuses
   */
  static async getReadStatus(messageId) {
    try {
      // Check if read receipts are enabled for this message
      const message = await this.getById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }
      
      // If read receipts are disabled, return empty array
      if (message.readReceiptsEnabled === false) {
        return [];
      }
      
      const result = await pool.query(
        `SELECT mrs.user_id, mrs.read_at, u.username
        FROM message_read_status mrs
        JOIN users u ON mrs.user_id = u.id
        WHERE mrs.message_id = $1
        ORDER BY mrs.read_at ASC`,
        [messageId]
      );
      
      return result.rows.map(status => ({
        userId: status.user_id,
        username: status.username,
        readAt: status.read_at
      }));
    } catch (error) {
      logger.error(`Error getting message read status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send a message
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} - Sent message
   */
  static async send(messageData) {
    const message = await this.create(messageData);
    
    // Check if recipient is online
    const recipientIsOnline = await this.checkRecipientOnline(message.conversationId, message.senderId);
    
    if (!recipientIsOnline) {
      // Queue message for offline delivery
      await this.queueOfflineMessage(message.id, message.conversationId);
      
      // Send push notification for new message
      await this.sendNewMessageNotification(message);
    }
    
    return message;
  }

  /**
   * Send push notification for new message
   * @param {Object} message - Message object
   * @returns {Promise<void>}
   */
  static async sendNewMessageNotification(message) {
    try {
      const notificationService = require('../services/NotificationService');
      const User = require('./User');
      
      // Get conversation details
      const conversation = await pool.query(
        `SELECT c.id, c.is_group, c.name, u.username, u.full_name
         FROM conversations c
         LEFT JOIN users u ON u.id = $1
         WHERE c.id = $2`,
        [message.senderId, message.conversationId]
      );
      
      if (conversation.rows.length === 0) {
        logger.error(`Conversation ${message.conversationId} not found for notification`);
        return;
      }
      
      const conversationData = conversation.rows[0];
      
      // Get recipients (excluding sender)
      const recipients = await pool.query(
        `SELECT user_id 
         FROM conversation_participants 
         WHERE conversation_id = $1 AND user_id != $2`,
        [message.conversationId, message.senderId]
      );
      
      if (recipients.rows.length === 0) {
        logger.debug('No recipients found for notification');
        return;
      }
      
      // Prepare notification content
      const senderName = conversationData.full_name || conversationData.username || 'Someone';
      let title, body;
      
      if (conversationData.is_group) {
        const groupName = conversationData.name || 'Group chat';
        title = `New message in ${groupName}`;
        body = `${senderName}: ${this.getMessagePreview(message)}`;
      } else {
        title = `Message from ${senderName}`;
        body = this.getMessagePreview(message);
      }
      
      // Send notification to each recipient
      for (const recipient of recipients.rows) {
        await notificationService.sendNotification(recipient.user_id, {
          type: 'new_message',
          title,
          body,
          data: {
            conversationId: message.conversationId,
            messageId: message.id,
            senderId: message.senderId,
            isGroup: conversationData.is_group
          }
        });
      }
    } catch (error) {
      logger.error('Error sending push notification for new message:', error);
      // Don't throw, just log the error to prevent disrupting the message flow
    }
  }
  
  /**
   * Get a preview of the message content for notifications
   * @param {Object} message - Message object
   * @returns {string} - Message preview
   */
  static getMessagePreview(message) {
    // For encrypted messages, just show a generic message
    if (message.isEncrypted) {
      return 'New encrypted message';
    }
    
    // If it's a media message, show the media type
    if (message.mediaType) {
      const mediaTypeMap = {
        'image': 'Sent an image',
        'video': 'Sent a video',
        'audio': 'Sent an audio message',
        'document': 'Sent a document',
        'location': 'Shared a location'
      };
      
      return mediaTypeMap[message.mediaType] || 'Sent an attachment';
    }
    
    // For text messages, truncate if needed
    if (message.content) {
      return message.content.length > 50 
        ? `${message.content.substring(0, 47)}...` 
        : message.content;
    }
    
    return 'New message';
  }

  /**
   * Process offline messages for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of delivered messages
   */
  static async processOfflineMessages(userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get all offline messages for the user
      const messages = await this.getOfflineMessages(userId);
      
      if (messages.length === 0) {
        await client.query('COMMIT');
        return [];
      }
      
      // Get message IDs
      const messageIds = messages.map(message => message.id);
      
      // Remove messages from offline queue
      await this.removeFromOfflineQueue(messageIds);
      
      // Cancel any pending push notifications for these messages
      await this.cancelPendingNotifications(userId, messageIds);
      
      await client.query('COMMIT');
      return messages;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing offline messages:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Cancel pending push notifications for delivered messages
   * @param {string} userId - User ID
   * @param {Array<string>} messageIds - Array of message IDs
   * @returns {Promise<void>}
   */
  static async cancelPendingNotifications(userId, messageIds) {
    try {
      // This is a placeholder for future implementation
      // In a production system, you might want to cancel scheduled notifications
      // or mark them as delivered in your notification system
      logger.debug(`Cancelled pending notifications for user ${userId} for ${messageIds.length} messages`);
    } catch (error) {
      logger.error('Error cancelling pending notifications:', error);
      // Don't throw, just log the error
    }
  }
}

module.exports = Message;
