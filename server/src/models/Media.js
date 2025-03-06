const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const performanceTracker = require('../utils/performanceTracker');
const cache = require('../utils/cache');

// Cache configuration
const CACHE_ENABLED = process.env.MEDIA_CACHE_ENABLED !== 'false';
const CACHE_TTL = parseInt(process.env.MEDIA_CACHE_TTL || '3600', 10); // Default 1 hour

/**
 * Media Model
 * 
 * Represents media files uploaded by users
 */
class Media {
  /**
   * Create a new media record
   * 
   * @param {Object} data - Media data
   * @param {string} data.userId - ID of the user who uploaded the media
   * @param {string} data.conversationId - ID of the conversation the media belongs to
   * @param {string} data.mediaType - Type of media (image, video, audio, document)
   * @param {string} data.filename - Filename of the media
   * @param {string} data.originalFilename - Original filename of the media
   * @param {string} data.mimeType - MIME type of the media
   * @param {number} data.size - Size of the media in bytes
   * @param {string} data.thumbnailPath - Path to the thumbnail (optional)
   * @param {string} data.webpThumbnailPath - Path to the WebP thumbnail (optional)
   * @param {Object} data.metadata - Additional metadata (optional)
   * @returns {Promise<Object>} Created media record
   */
  static async create(data) {
    const perfTracker = performanceTracker.start('media.dbCreate');
    
    const {
      userId,
      conversationId,
      mediaType,
      filename,
      originalFilename,
      mimeType,
      size,
      thumbnailPath = null,
      webpThumbnailPath = null,
      metadata = {}
    } = data;

    // Validate required fields
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!mediaType) {
      throw new Error('Media type is required');
    }

    if (!filename) {
      throw new Error('Filename is required');
    }

    if (!mimeType) {
      throw new Error('MIME type is required');
    }

    if (!size) {
      throw new Error('Size is required');
    }

    // Generate media ID
    const mediaId = path.parse(filename).name; // Use the unique filename (without extension) as the media ID
    const timestamp = new Date().toISOString();

    try {
      // Insert media record
      const result = await pool.query(
        `INSERT INTO media (
          id, user_id, conversation_id, media_type, filename, original_filename,
          mime_type, size, thumbnail_path, webp_thumbnail_path, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12) 
        RETURNING id`,
        [
          mediaId, 
          userId,
          conversationId,
          mediaType, 
          filename, 
          originalFilename,
          mimeType, 
          size, 
          thumbnailPath,
          webpThumbnailPath,
          JSON.stringify(metadata), 
          timestamp
        ]
      );

      // Create response object
      const mediaObject = {
        id: mediaId,
        userId,
        conversationId,
        mediaType,
        filename,
        originalFilename,
        mimeType,
        size,
        thumbnailPath,
        webpThumbnailPath,
        metadata,
        url: `/api/media/${mediaId}`,
        thumbnailUrl: thumbnailPath ? `/api/media/thumbnail/${mediaId}` : null,
        webpThumbnailUrl: webpThumbnailPath ? `/api/media/thumbnail/${mediaId}?format=webp` : null,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      // Cache the media object if caching is enabled
      if (CACHE_ENABLED) {
        cache.set(`media:${mediaId}`, mediaObject, CACHE_TTL);
      }
      
      perfTracker.end();
      
      // Return created media record
      return mediaObject;
    } catch (error) {
      logger.error(`Error creating media record: ${error.message}`);
      perfTracker.end();
      throw error;
    }
  }

  /**
   * Get a media record by ID
   * 
   * @param {string} mediaId - ID of the media to get
   * @returns {Promise<Object|null>} Media record or null if not found
   */
  static async getById(mediaId) {
    const perfTracker = performanceTracker.start('media.getById');
    
    if (!mediaId) {
      throw new Error('Media ID is required');
    }

    try {
      // Check cache first
      if (CACHE_ENABLED) {
        const cachedMedia = cache.get(`media:${mediaId}`);
        if (cachedMedia) {
          perfTracker.end({ source: 'cache' });
          return cachedMedia;
        }
      }
      
      const result = await pool.query(
        `SELECT 
          id, user_id, conversation_id, media_type, filename, original_filename,
          mime_type, size, thumbnail_path, webp_thumbnail_path, metadata, created_at, updated_at
        FROM media
        WHERE id = $1`,
        [mediaId]
      );

      if (result.rows.length === 0) {
        perfTracker.end({ found: false });
        return null;
      }

      const media = result.rows[0];
      
      // Create response object
      const mediaObject = {
        id: media.id,
        userId: media.user_id,
        conversationId: media.conversation_id,
        mediaType: media.media_type,
        filename: media.filename,
        originalFilename: media.original_filename,
        mimeType: media.mime_type,
        size: media.size,
        thumbnailPath: media.thumbnail_path,
        webpThumbnailPath: media.webp_thumbnail_path,
        metadata: media.metadata ? JSON.parse(media.metadata) : {},
        url: `/api/media/${media.id}`,
        thumbnailUrl: media.thumbnail_path ? `/api/media/thumbnail/${media.id}` : null,
        webpThumbnailUrl: media.webp_thumbnail_path ? `/api/media/thumbnail/${media.id}?format=webp` : null,
        createdAt: media.created_at,
        updatedAt: media.updated_at
      };
      
      // Cache the media object if caching is enabled
      if (CACHE_ENABLED) {
        cache.set(`media:${mediaId}`, mediaObject, CACHE_TTL);
      }
      
      perfTracker.end({ source: 'database' });
      
      return mediaObject;
    } catch (error) {
      logger.error(`Error getting media by ID: ${error.message}`);
      perfTracker.end({ error: true });
      throw error;
    }
  }

  /**
   * Get media records by user ID
   * 
   * @param {string} userId - ID of the user
   * @param {Object} options - Query options
   * @param {string} options.mediaType - Type of media to filter by
   * @param {number} options.limit - Maximum number of records to return
   * @param {number} options.offset - Number of records to skip
   * @returns {Promise<Array<Object>>} Array of media records
   */
  static async getByUserId(userId, options = {}) {
    const perfTracker = performanceTracker.start('media.getByUserId');
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { mediaType, limit = 50, offset = 0 } = options;
    
    // Generate cache key based on query parameters
    const cacheKey = `media:user:${userId}:${mediaType || 'all'}:${limit}:${offset}`;

    try {
      // Check cache first
      if (CACHE_ENABLED) {
        const cachedMedia = cache.get(cacheKey);
        if (cachedMedia) {
          perfTracker.end({ source: 'cache' });
          return cachedMedia;
        }
      }
      
      let query = `
        SELECT 
          id, user_id, conversation_id, media_type, filename, original_filename,
          mime_type, size, thumbnail_path, webp_thumbnail_path, metadata, created_at, updated_at
        FROM media
        WHERE user_id = $1
      `;
      
      const params = [userId];
      
      if (mediaType) {
        query += ` AND media_type = $2`;
        params.push(mediaType);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      const mediaList = result.rows.map(media => ({
        id: media.id,
        userId: media.user_id,
        conversationId: media.conversation_id,
        mediaType: media.media_type,
        filename: media.filename,
        originalFilename: media.original_filename,
        mimeType: media.mime_type,
        size: media.size,
        thumbnailPath: media.thumbnail_path,
        webpThumbnailPath: media.webp_thumbnail_path,
        metadata: media.metadata ? JSON.parse(media.metadata) : {},
        url: `/api/media/${media.id}`,
        thumbnailUrl: media.thumbnail_path ? `/api/media/thumbnail/${media.id}` : null,
        webpThumbnailUrl: media.webp_thumbnail_path ? `/api/media/thumbnail/${media.id}?format=webp` : null,
        createdAt: media.created_at,
        updatedAt: media.updated_at
      }));
      
      // Cache the media list if caching is enabled
      if (CACHE_ENABLED) {
        cache.set(cacheKey, mediaList, CACHE_TTL);
      }
      
      perfTracker.end({ count: mediaList.length, source: 'database' });
      
      return mediaList;
    } catch (error) {
      logger.error(`Error getting media by user ID: ${error.message}`);
      perfTracker.end({ error: true });
      throw error;
    }
  }

  /**
   * Update a media record
   * 
   * @param {string} mediaId - ID of the media to update
   * @param {Object} data - Data to update
   * @param {string} data.thumbnailPath - Path to the thumbnail
   * @param {string} data.webpThumbnailPath - Path to the WebP thumbnail
   * @param {Object} data.metadata - Additional metadata
   * @returns {Promise<Object|null>} Updated media record or null if not found
   */
  static async update(mediaId, data) {
    if (!mediaId) {
      throw new Error('Media ID is required');
    }

    const { thumbnailPath, webpThumbnailPath, metadata } = data;
    const timestamp = new Date().toISOString();

    try {
      let query = 'UPDATE media SET updated_at = $1';
      const params = [timestamp];
      let paramIndex = 2;

      if (thumbnailPath !== undefined) {
        query += `, thumbnail_path = $${paramIndex}`;
        params.push(thumbnailPath);
        paramIndex++;
      }

      if (webpThumbnailPath !== undefined) {
        query += `, webp_thumbnail_path = $${paramIndex}`;
        params.push(webpThumbnailPath);
        paramIndex++;
      }

      if (metadata !== undefined) {
        query += `, metadata = $${paramIndex}`;
        params.push(JSON.stringify(metadata));
        paramIndex++;
      }

      query += ` WHERE id = $${paramIndex} RETURNING id`;
      params.push(mediaId);

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return null;
      }

      // Get updated media record
      return await Media.getById(mediaId);
    } catch (error) {
      logger.error(`Error updating media: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a media record and its associated files
   * 
   * @param {string} mediaId - ID of the media to delete
   * @param {string} userId - ID of the user performing the deletion
   * @returns {Promise<boolean>} Success indicator
   */
  static async delete(mediaId, userId) {
    if (!mediaId) {
      throw new Error('Media ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      // Get media record
      const media = await Media.getById(mediaId);

      if (!media) {
        return false;
      }

      // Check if user has permission to delete the media
      if (media.userId !== userId) {
        return false;
      }

      // Check if media is referenced by any messages
      const messageCheckResult = await pool.query(
        'SELECT COUNT(*) as count FROM messages WHERE media_id = $1',
        [mediaId]
      );

      if (messageCheckResult.rows[0].count > 0) {
        // Media is still referenced by messages, mark for deletion but don't delete files yet
        await pool.query(
          'UPDATE media SET marked_for_deletion = true WHERE id = $1',
          [mediaId]
        );
        return true;
      }

      // Delete media files
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      const mediaPath = path.join(uploadDir, userId, media.mediaType, media.filename);
      
      if (fs.existsSync(mediaPath)) {
        fs.unlinkSync(mediaPath);
      }

      // Delete thumbnail if it exists
      if (media.thumbnailPath && fs.existsSync(media.thumbnailPath)) {
        fs.unlinkSync(media.thumbnailPath);
      }

      // Delete WebP thumbnail if it exists
      if (media.webpThumbnailPath && fs.existsSync(media.webpThumbnailPath)) {
        fs.unlinkSync(media.webpThumbnailPath);
      }

      // Delete media record
      const result = await pool.query(
        'DELETE FROM media WHERE id = $1 RETURNING id',
        [mediaId]
      );

      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting media: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up media marked for deletion
   * 
   * This method should be called by a scheduled job
   * @returns {Promise<number>} Number of media records cleaned up
   */
  static async cleanupMarkedForDeletion() {
    try {
      // Get media marked for deletion
      const result = await pool.query(
        `SELECT 
          id, user_id, media_type, filename, thumbnail_path, webp_thumbnail_path
        FROM media
        WHERE marked_for_deletion = true`
      );

      let cleanedCount = 0;

      // Process each media record
      for (const media of result.rows) {
        // Check if media is still referenced by any messages
        const messageCheckResult = await pool.query(
          'SELECT COUNT(*) as count FROM messages WHERE media_id = $1',
          [media.id]
        );

        if (messageCheckResult.rows[0].count > 0) {
          // Media is still referenced by messages, skip it
          continue;
        }

        // Delete media files
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        const mediaPath = path.join(uploadDir, media.user_id, media.media_type, media.filename);
        
        if (fs.existsSync(mediaPath)) {
          fs.unlinkSync(mediaPath);
        }

        // Delete thumbnail if it exists
        if (media.thumbnail_path && fs.existsSync(media.thumbnail_path)) {
          fs.unlinkSync(media.thumbnail_path);
        }

        // Delete WebP thumbnail if it exists
        if (media.webp_thumbnail_path && fs.existsSync(media.webp_thumbnail_path)) {
          fs.unlinkSync(media.webp_thumbnail_path);
        }

        // Delete media record
        await pool.query(
          'DELETE FROM media WHERE id = $1',
          [media.id]
        );

        cleanedCount++;
      }

      return cleanedCount;
    } catch (error) {
      logger.error(`Error cleaning up media: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find a media record by ID
   * 
   * @param {string} id - ID of the media to find
   * @returns {Promise<Object|null>} Media record or null if not found
   */
  static async findById(id) {
    if (!id) {
      throw new Error('Media ID is required');
    }

    try {
      const result = await pool.query(
        `SELECT 
          id, user_id, conversation_id, media_type, filename, original_filename,
          mime_type, size, thumbnail_path, webp_thumbnail_path, metadata, created_at, updated_at
        FROM media
        WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const media = result.rows[0];

      return {
        id: media.id,
        userId: media.user_id,
        conversationId: media.conversation_id,
        mediaType: media.media_type,
        filename: media.filename,
        originalFilename: media.original_filename,
        mimeType: media.mime_type,
        size: media.size,
        thumbnailPath: media.thumbnail_path,
        webpThumbnailPath: media.webp_thumbnail_path,
        metadata: media.metadata ? JSON.parse(media.metadata) : {},
        url: `/api/media/${media.id}`,
        thumbnailUrl: media.thumbnail_path ? `/api/media/thumbnail/${media.id}` : null,
        webpThumbnailUrl: media.webp_thumbnail_path ? `/api/media/thumbnail/${media.id}?format=webp` : null,
        createdAt: media.created_at,
        updatedAt: media.updated_at
      };
    } catch (error) {
      logger.error(`Error finding media by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find media records by conversation ID
   * 
   * @param {string} conversationId - ID of the conversation
   * @param {Object} options - Query options
   * @param {string} options.mediaType - Type of media to filter by
   * @param {number} options.limit - Maximum number of records to return
   * @param {number} options.offset - Number of records to skip
   * @returns {Promise<Array<Object>>} Array of media records
   */
  static async findByConversationId(conversationId, options = {}) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const { mediaType, limit = 50, offset = 0 } = options;

    try {
      let query = `
        SELECT m.id, m.user_id, m.conversation_id, m.media_type, m.filename, m.original_filename,
               m.mime_type, m.size, m.thumbnail_path, m.webp_thumbnail_path, m.metadata, m.created_at, m.updated_at
        FROM media m
        JOIN messages msg ON m.id = msg.media_id
        WHERE msg.conversation_id = $1
      `;
      
      const params = [conversationId];
      
      if (mediaType) {
        query += ` AND m.media_type = $2`;
        params.push(mediaType);
      }
      
      query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      return result.rows.map(media => ({
        id: media.id,
        userId: media.user_id,
        conversationId: media.conversation_id,
        mediaType: media.media_type,
        filename: media.filename,
        originalFilename: media.original_filename,
        mimeType: media.mime_type,
        size: media.size,
        thumbnailPath: media.thumbnail_path,
        webpThumbnailPath: media.webp_thumbnail_path,
        metadata: media.metadata ? JSON.parse(media.metadata) : {},
        url: `/api/media/${media.id}`,
        thumbnailUrl: media.thumbnail_path ? `/api/media/thumbnail/${media.id}` : null,
        webpThumbnailUrl: media.webp_thumbnail_path ? `/api/media/thumbnail/${media.id}?format=webp` : null,
        createdAt: media.created_at,
        updatedAt: media.updated_at
      }));
    } catch (error) {
      logger.error(`Error finding media by conversation ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Count media records by conversation ID
   * 
   * @param {string} conversationId - ID of the conversation
   * @param {Object} options - Query options
   * @param {string} options.mediaType - Type of media to filter by
   * @returns {Promise<number>} Count of media records
   */
  static async countByConversationId(conversationId, options = {}) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }

    const { mediaType } = options;

    try {
      let query = `
        SELECT COUNT(*) as count
        FROM media m
        JOIN messages msg ON m.id = msg.media_id
        WHERE msg.conversation_id = $1
      `;
      
      const params = [conversationId];
      
      if (mediaType) {
        query += ` AND m.media_type = $2`;
        params.push(mediaType);
      }

      const result = await pool.query(query, params);

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error(`Error counting media by conversation ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a media record by ID
   * 
   * @param {string} id - ID of the media to delete
   * @returns {Promise<boolean>} Whether the deletion was successful
   */
  static async delete(id) {
    if (!id) {
      throw new Error('Media ID is required');
    }

    try {
      // First get the media record to get file information
      const media = await this.findById(id);
      
      if (!media) {
        return false;
      }
      
      // Delete the record from the database
      const result = await pool.query('DELETE FROM media WHERE id = $1', [id]);
      
      if (result.rowCount === 0) {
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error deleting media: ${error.message}`);
      throw error;
    }
  }
}

module.exports = Media;
