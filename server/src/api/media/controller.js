const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const Media = require('../../models/Media');
const { createErrorResponse } = require('../../utils/responseUtils');
const performanceTracker = require('../../utils/performanceTracker');
const cache = require('../../utils/cache');

// Get upload directory from environment or use default
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
const CACHE_ENABLED = process.env.MEDIA_CACHE_ENABLED !== 'false';
const CACHE_TTL = parseInt(process.env.MEDIA_CACHE_TTL || '3600', 10); // Default 1 hour
const THUMBNAIL_SIZE = parseInt(process.env.THUMBNAIL_SIZE || '300', 10); // Default 300px

/**
 * Upload a media file
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadMedia = async (req, res) => {
  const perfTracker = performanceTracker.start('media.upload');
  
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json(createErrorResponse('No file uploaded'));
    }

    const { conversationId } = req.body;
    
    // Validate required fields
    if (!conversationId) {
      return res.status(400).json(createErrorResponse('Conversation ID is required'));
    }
    
    // Check if user has access to this conversation
    const accessCheckTracker = performanceTracker.start('media.accessCheck');
    const hasAccess = await checkConversationAccess(req.user.id, conversationId);
    accessCheckTracker.end();
    
    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied to this conversation'));
    }

    // Get file information
    const { originalname, mimetype, size, path: tempPath } = req.file;
    
    // Validate file size (max 100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (size > MAX_FILE_SIZE) {
      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      return res.status(400).json(createErrorResponse(`File size exceeds the maximum limit of ${formatFileSize(MAX_FILE_SIZE)}`));
    }
    
    // Get media type from MIME type
    const mediaType = getMediaTypeFromMimeType(mimetype);
    if (!mediaType) {
      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      return res.status(400).json(createErrorResponse('Unsupported file type'));
    }
    
    // Generate unique filename to prevent collisions
    const fileExtension = path.extname(originalname);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    
    // Create directory structure if it doesn't exist
    const targetDir = path.join(UPLOAD_DIR, mediaType, req.user.id);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Set target path for the file
    const targetPath = path.join(targetDir, uniqueFilename);
    
    // Move file from temp location to target directory
    fs.copyFileSync(tempPath, targetPath);
    fs.unlinkSync(tempPath); // Clean up temp file
    
    // Process additional metadata based on media type
    let metadata = {};
    let thumbnailPath = null;
    
    // Extract dimensions and generate thumbnail for images
    if (mediaType === 'image') {
      const imageProcessingTracker = performanceTracker.start('media.imageProcessing');
      
      try {
        // Use Sharp for image processing
        const imageInfo = await sharp(targetPath).metadata();
        
        // Extract dimensions
        metadata.width = imageInfo.width;
        metadata.height = imageInfo.height;
        metadata.aspectRatio = metadata.width / metadata.height;
        metadata.format = imageInfo.format;
        
        // Generate thumbnail
        const thumbnailDir = path.join(UPLOAD_DIR, 'thumbnails', req.user.id);
        if (!fs.existsSync(thumbnailDir)) {
          fs.mkdirSync(thumbnailDir, { recursive: true });
        }
        
        thumbnailPath = path.join(thumbnailDir, `thumb_${uniqueFilename}`);
        
        // Generate optimized thumbnail with Sharp
        await sharp(targetPath)
          .resize({
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80, progressive: true })
          .toFile(thumbnailPath);
          
        // Generate WebP version for modern browsers
        const webpThumbnailPath = path.join(thumbnailDir, `thumb_${uuidv4()}.webp`);
        await sharp(targetPath)
          .resize({
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 80 })
          .toFile(webpThumbnailPath);
          
        metadata.webpThumbnailPath = webpThumbnailPath;
      } catch (error) {
        console.error('Error processing image:', error);
        // Continue without thumbnail if processing fails
      }
      
      imageProcessingTracker.end();
    }
    
    // Extract duration for videos and audio
    if ((mediaType === 'video' || mediaType === 'audio') && req.body.duration) {
      metadata.duration = parseFloat(req.body.duration);
      
      // Format duration for display
      const minutes = Math.floor(metadata.duration / 60);
      const seconds = Math.floor(metadata.duration % 60);
      metadata.formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Create media record in database
    const dbTracker = performanceTracker.start('media.dbCreate');
    
    const mediaData = {
      userId: req.user.id,
      conversationId,
      mediaType,
      filename: uniqueFilename,
      originalFilename: originalname,
      mimeType: mimetype,
      size,
      thumbnailPath,
      webpThumbnailPath: metadata.webpThumbnailPath,
      metadata
    };
    
    const media = await Media.create(mediaData);
    dbTracker.end();
    
    // Format response
    const responseData = formatMediaResponse(media);
    
    // Cache the media data
    if (CACHE_ENABLED) {
      cache.set(`media:${media.id}`, responseData, CACHE_TTL);
    }
    
    // End performance tracking
    perfTracker.end();
    
    // Return success response with media information
    return res.status(201).json({
      success: true,
      message: 'Media uploaded successfully',
      media: responseData,
      performance: perfTracker.getMetrics()
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    
    // Clean up temp file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    perfTracker.end();
    
    return res.status(500).json(createErrorResponse('Failed to upload media', error));
  }
};

/**
 * Upload multiple media files (batch upload)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadMediaBatch = async (req, res) => {
  const perfTracker = performanceTracker.start('media.batchUpload');
  
  try {
    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json(createErrorResponse('No files uploaded'));
    }

    const { conversationId } = req.body;
    
    // Validate required fields
    if (!conversationId) {
      return res.status(400).json(createErrorResponse('Conversation ID is required'));
    }
    
    // Check if user has access to this conversation
    const accessCheckTracker = performanceTracker.start('media.batchAccessCheck');
    const hasAccess = await checkConversationAccess(req.user.id, conversationId);
    accessCheckTracker.end();
    
    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied to this conversation'));
    }

    // Process each file
    const uploadResults = [];
    const errors = [];
    const processingPromises = [];

    for (const file of req.files) {
      processingPromises.push(
        processMediaFile(file, req.user.id, conversationId)
          .then(result => {
            if (result.success) {
              uploadResults.push(result.media);
            } else {
              errors.push({
                filename: file.originalname,
                error: result.error
              });
            }
          })
          .catch(error => {
            errors.push({
              filename: file.originalname,
              error: error.message
            });
          })
      );
    }

    // Wait for all files to be processed
    await Promise.all(processingPromises);
    
    perfTracker.end();
    
    // Return results
    return res.status(200).json({
      success: true,
      message: `Processed ${req.files.length} files: ${uploadResults.length} uploaded, ${errors.length} failed`,
      media: uploadResults,
      errors: errors.length > 0 ? errors : undefined,
      performance: perfTracker.getMetrics()
    });
  } catch (error) {
    console.error('Error in batch upload:', error);
    
    // Clean up temp files if they exist
    if (req.files) {
      for (const file of req.files) {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }
    
    perfTracker.end();
    
    return res.status(500).json(createErrorResponse('Failed to process batch upload', error));
  }
};

/**
 * Process a single media file
 * 
 * @param {Object} file - File object from multer
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} Processing result
 */
const processMediaFile = async (file, userId, conversationId) => {
  const fileTracker = performanceTracker.start('media.processFile');
  
  try {
    // Get file information
    const { originalname, mimetype, size, path: tempPath } = file;
    
    // Validate file size (max 100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (size > MAX_FILE_SIZE) {
      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      return {
        success: false,
        error: `File size exceeds the maximum limit of ${formatFileSize(MAX_FILE_SIZE)}`
      };
    }
    
    // Get media type from MIME type
    const mediaType = getMediaTypeFromMimeType(mimetype);
    if (!mediaType) {
      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      return {
        success: false,
        error: 'Unsupported file type'
      };
    }
    
    // Generate unique filename to prevent collisions
    const fileExtension = path.extname(originalname);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    
    // Create directory structure if it doesn't exist
    const targetDir = path.join(UPLOAD_DIR, mediaType, userId);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Set target path for the file
    const targetPath = path.join(targetDir, uniqueFilename);
    
    // Move file from temp location to target directory
    fs.copyFileSync(tempPath, targetPath);
    fs.unlinkSync(tempPath); // Clean up temp file
    
    // Process additional metadata based on media type
    let metadata = {};
    let thumbnailPath = null;
    let webpThumbnailPath = null;
    
    // Extract dimensions and generate thumbnail for images
    if (mediaType === 'image') {
      const imageProcessingTracker = performanceTracker.start('media.imageProcessing');
      
      try {
        // Use Sharp for image processing
        const imageInfo = await sharp(targetPath).metadata();
        
        // Extract dimensions
        metadata.width = imageInfo.width;
        metadata.height = imageInfo.height;
        metadata.aspectRatio = metadata.width / metadata.height;
        metadata.format = imageInfo.format;
        
        // Generate thumbnail
        const thumbnailDir = path.join(UPLOAD_DIR, 'thumbnails', userId);
        if (!fs.existsSync(thumbnailDir)) {
          fs.mkdirSync(thumbnailDir, { recursive: true });
        }
        
        thumbnailPath = path.join(thumbnailDir, `thumb_${uniqueFilename}`);
        
        // Generate optimized thumbnail with Sharp
        await sharp(targetPath)
          .resize({
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80, progressive: true })
          .toFile(thumbnailPath);
          
        // Generate WebP version for modern browsers
        webpThumbnailPath = path.join(thumbnailDir, `thumb_${uuidv4()}.webp`);
        await sharp(targetPath)
          .resize({
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 80 })
          .toFile(webpThumbnailPath);
          
        metadata.webpThumbnailPath = webpThumbnailPath;
      } catch (error) {
        console.error('Error processing image:', error);
        // Continue without thumbnail if processing fails
      }
      
      imageProcessingTracker.end();
    }
    
    // Create media record in database
    const dbTracker = performanceTracker.start('media.dbCreate');
    
    const mediaData = {
      userId,
      conversationId,
      mediaType,
      filename: uniqueFilename,
      originalFilename: originalname,
      mimeType: mimetype,
      size,
      thumbnailPath,
      webpThumbnailPath,
      metadata
    };
    
    const media = await Media.create(mediaData);
    dbTracker.end();
    
    // Format response
    const responseData = formatMediaResponse(media);
    
    // Cache the media data
    if (CACHE_ENABLED) {
      cache.set(`media:${media.id}`, responseData, CACHE_TTL);
    }
    
    fileTracker.end();
    
    return {
      success: true,
      media: responseData
    };
  } catch (error) {
    console.error('Error processing media file:', error);
    
    // Clean up temp file if it exists
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    fileTracker.end();
    
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Format media response object
 * 
 * @param {Object} media - Media database object
 * @returns {Object} Formatted media response
 */
const formatMediaResponse = (media) => {
  return {
    id: media.id,
    userId: media.userId,
    mediaType: media.mediaType,
    filename: media.filename,
    originalFilename: media.originalFilename,
    mimeType: media.mimeType,
    size: media.size,
    url: `/api/media/${media.id}`,
    thumbnailUrl: media.thumbnailPath ? `/api/media/thumbnail/${media.id}` : null,
    webpThumbnailUrl: media.webpThumbnailPath ? `/api/media/thumbnail/${media.id}?format=webp` : null,
    metadata: media.metadata || {},
    createdAt: media.createdAt,
    updatedAt: media.updatedAt
  };
};

/**
 * Get media by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMediaById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get media record from database
    const media = await Media.findById(id);
    
    if (!media) {
      return res.status(404).json(createErrorResponse('Media not found'));
    }
    
    // Check if user has access to this media
    const hasAccess = await checkMediaAccess(req.user.id, media);
    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied'));
    }
    
    // Construct file path
    const filePath = path.join(UPLOAD_DIR, media.mediaType, media.userId, media.filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json(createErrorResponse('Media file not found'));
    }
    
    // Set appropriate content type
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${media.originalFilename}"`);
    
    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error retrieving media:', error);
    return res.status(500).json(createErrorResponse('Failed to retrieve media', error));
  }
};

/**
 * Delete media by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get media record from database
    const media = await Media.findById(id);
    
    if (!media) {
      return res.status(404).json(createErrorResponse('Media not found'));
    }
    
    // Check if user has permission to delete this media
    if (media.userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json(createErrorResponse('Permission denied'));
    }
    
    // Construct file path
    const filePath = path.join(UPLOAD_DIR, media.mediaType, media.userId, media.filename);
    
    // Delete file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete media record from database
    await Media.delete(id);
    
    return res.status(200).json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting media:', error);
    return res.status(500).json(createErrorResponse('Failed to delete media', error));
  }
};

/**
 * Get media for conversation
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMediaForConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { mediaType, limit = 50, offset = 0 } = req.query;
    
    // Check if user has access to this conversation
    const hasAccess = await checkConversationAccess(req.user.id, conversationId);
    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied'));
    }
    
    // Get media records for conversation with filtering and pagination
    const options = {
      mediaType: mediaType || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    };
    
    // Get media records for conversation
    const mediaList = await Media.findByConversationId(conversationId, options);
    
    // Get total count for pagination
    const totalCount = await Media.countByConversationId(conversationId, { mediaType: options.mediaType });
    
    // Format response
    const formattedMedia = mediaList.map(media => ({
      id: media.id,
      userId: media.userId,
      mediaType: media.mediaType,
      filename: media.filename,
      originalFilename: media.originalFilename,
      mimeType: media.mimeType,
      size: media.size,
      url: `/api/media/${media.id}`,
      thumbnailUrl: media.thumbnailPath ? `/api/media/thumbnail/${media.id}` : null,
      webpThumbnailUrl: media.webpThumbnailPath ? `/api/media/thumbnail/${media.id}?format=webp` : null,
      metadata: media.metadata || {},
      createdAt: media.createdAt,
      updatedAt: media.updatedAt
    }));
    
    return res.status(200).json({
      success: true,
      media: formattedMedia,
      pagination: {
        total: totalCount,
        limit: options.limit,
        offset: options.offset,
        hasMore: totalCount > (options.offset + options.limit)
      }
    });
  } catch (error) {
    console.error('Error retrieving conversation media:', error);
    return res.status(500).json(createErrorResponse('Failed to retrieve media for conversation', error));
  }
};

/**
 * Get media thumbnail by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMediaThumbnail = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get media record from database
    const media = await Media.findById(id);
    
    if (!media) {
      return res.status(404).json(createErrorResponse('Media not found'));
    }
    
    // Check if user has access to this media
    const hasAccess = await checkMediaAccess(req.user.id, media);
    if (!hasAccess) {
      return res.status(403).json(createErrorResponse('Access denied'));
    }
    
    // If no thumbnail exists, return the original media for images
    // or a default thumbnail for other types
    if (!media.thumbnailPath) {
      if (media.mediaType === 'image') {
        // For images, serve the original image
        const filePath = path.join(UPLOAD_DIR, media.mediaType, media.userId, media.filename);
        
        if (!fs.existsSync(filePath)) {
          return res.status(404).json(createErrorResponse('Media file not found'));
        }
        
        res.setHeader('Content-Type', media.mimeType);
        return fs.createReadStream(filePath).pipe(res);
      } else {
        // For other types, serve a default thumbnail based on type
        const defaultThumbnailPath = path.join(__dirname, '../../assets', `${media.mediaType}-thumbnail.png`);
        
        if (fs.existsSync(defaultThumbnailPath)) {
          res.setHeader('Content-Type', 'image/png');
          return fs.createReadStream(defaultThumbnailPath).pipe(res);
        } else {
          // If no default thumbnail exists, serve a generic one
          const genericThumbnailPath = path.join(__dirname, '../../assets', 'generic-thumbnail.png');
          
          if (fs.existsSync(genericThumbnailPath)) {
            res.setHeader('Content-Type', 'image/png');
            return fs.createReadStream(genericThumbnailPath).pipe(res);
          }
          
          return res.status(404).json(createErrorResponse('Thumbnail not found'));
        }
      }
    }
    
    // Check if thumbnail file exists
    if (!fs.existsSync(media.thumbnailPath)) {
      return res.status(404).json(createErrorResponse('Thumbnail file not found'));
    }
    
    // Determine content type based on thumbnail file extension
    const thumbnailExt = path.extname(media.thumbnailPath).toLowerCase();
    let contentType = 'image/jpeg'; // Default
    
    if (thumbnailExt === '.png') {
      contentType = 'image/png';
    } else if (thumbnailExt === '.gif') {
      contentType = 'image/gif';
    } else if (thumbnailExt === '.webp') {
      contentType = 'image/webp';
    }
    
    // Set appropriate content type
    res.setHeader('Content-Type', contentType);
    
    // Stream file to response
    const fileStream = fs.createReadStream(media.thumbnailPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error retrieving media thumbnail:', error);
    return res.status(500).json(createErrorResponse('Failed to retrieve thumbnail', error));
  }
};

/**
 * Check if user has access to media
 * 
 * @param {string} userId - User ID
 * @param {Object} media - Media object
 * @returns {Promise<boolean>} Whether user has access
 */
async function checkMediaAccess(userId, media) {
  // If user is the owner, they have access
  if (media.userId === userId) {
    return true;
  }
  
  // Check if user is part of the conversation
  return await checkConversationAccess(userId, media.conversationId);
}

/**
 * Check if user has access to conversation
 * 
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<boolean>} Whether user has access
 */
async function checkConversationAccess(userId, conversationId) {
  try {
    // This would typically query the database to check if user is part of conversation
    // For now, we'll implement a simple check
    const { pool } = require('../../db/connection');
    
    const result = await pool.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error checking conversation access:', error);
    return false;
  }
}

/**
 * Get media type from MIME type
 * 
 * @param {string} mimeType - MIME type
 * @returns {string|null} Media type or null if not supported
 */
function getMediaTypeFromMimeType(mimeType) {
  if (!mimeType) return null;
  
  const lowerMimeType = mimeType.toLowerCase();
  
  if (lowerMimeType.startsWith('image/')) {
    return 'image';
  } else if (lowerMimeType.startsWith('video/')) {
    return 'video';
  } else if (lowerMimeType.startsWith('audio/')) {
    return 'audio';
  } else if (
    lowerMimeType === 'application/pdf' ||
    lowerMimeType.includes('word') ||
    lowerMimeType.includes('excel') ||
    lowerMimeType.includes('powerpoint') ||
    lowerMimeType.includes('openxmlformats') ||
    lowerMimeType.startsWith('text/') ||
    lowerMimeType === 'application/rtf'
  ) {
    return 'document';
  }
  
  return null;
}

/**
 * Format file size in human-readable format
 * 
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get media performance statistics
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMediaStats = async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access. Admin privileges required.'
      });
    }

    // Get cache statistics
    const cacheStats = cache.getStats();
    
    // Get performance metrics
    const performanceMetrics = performanceTracker.getMetrics([
      'media.upload',
      'media.uploadBatch',
      'media.getById',
      'media.getByUserId',
      'media.getThumbnail',
      'media.dbCreate',
      'media.imageProcessing'
    ]);
    
    // Get database statistics
    const dbStats = await pool.query(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN thumbnail_path IS NOT NULL THEN 1 ELSE 0 END) as thumbnail_count,
        SUM(CASE WHEN webp_thumbnail_path IS NOT NULL THEN 1 ELSE 0 END) as webp_count,
        SUM(size) as total_size,
        AVG(size) as avg_size,
        COUNT(DISTINCT user_id) as user_count,
        MAX(created_at) as latest_upload
      FROM media
    `);
    
    // Get media type distribution
    const mediaTypeDistribution = await pool.query(`
      SELECT 
        media_type, 
        COUNT(*) as count,
        SUM(size) as total_size
      FROM media
      GROUP BY media_type
      ORDER BY count DESC
    `);
    
    // Format the response
    const stats = {
      cache: cacheStats,
      performance: performanceMetrics,
      database: {
        totalCount: parseInt(dbStats.rows[0].total_count),
        thumbnailCount: parseInt(dbStats.rows[0].thumbnail_count),
        webpCount: parseInt(dbStats.rows[0].webp_count),
        totalSize: parseInt(dbStats.rows[0].total_size),
        averageSize: parseInt(dbStats.rows[0].avg_size),
        userCount: parseInt(dbStats.rows[0].user_count),
        latestUpload: dbStats.rows[0].latest_upload,
        mediaTypeDistribution: mediaTypeDistribution.rows.map(row => ({
          type: row.media_type,
          count: parseInt(row.count),
          totalSize: parseInt(row.total_size),
          percentage: (parseInt(row.count) / parseInt(dbStats.rows[0].total_count) * 100).toFixed(2) + '%'
        }))
      },
      config: {
        cacheEnabled: process.env.MEDIA_CACHE_ENABLED !== 'false',
        cacheTTL: parseInt(process.env.MEDIA_CACHE_TTL || '3600', 10),
        thumbnailSize: parseInt(process.env.THUMBNAIL_SIZE || '300', 10),
        webpQuality: parseInt(process.env.WEBP_QUALITY || '80', 10),
        uploadDir: UPLOAD_DIR
      }
    };
    
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error(`Error getting media stats: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to get media statistics'
    });
  }
};

/**
 * Regenerate thumbnails for existing media
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const regenerateThumbnails = async (req, res) => {
  try {
    // Check if user has admin privileges
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access. Admin privileges required.'
      });
    }
    
    const { mediaType, limit = 100, webpOnly = false } = req.body;
    
    // Build query to get media that needs thumbnail regeneration
    let query = `
      SELECT id, filename, media_type, mime_type
      FROM media
      WHERE 
    `;
    
    const queryParams = [];
    
    if (webpOnly) {
      // Only regenerate WebP thumbnails for items that have regular thumbnails but no WebP
      query += `thumbnail_path IS NOT NULL AND webp_thumbnail_path IS NULL`;
    } else {
      // Regenerate all thumbnails
      query += `1=1`; // Always true condition
    }
    
    // Filter by media type if specified
    if (mediaType) {
      query += ` AND media_type = $1`;
      queryParams.push(mediaType);
    }
    
    // Only process image types
    query += ` AND mime_type LIKE 'image/%'`;
    
    // Add limit
    query += ` LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);
    
    // Get media items that need thumbnail regeneration
    const result = await pool.query(query, queryParams);
    
    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No media items found that need thumbnail regeneration',
        count: 0
      });
    }
    
    // Start a background job to regenerate thumbnails
    const totalItems = result.rows.length;
    let processedItems = 0;
    let successItems = 0;
    let failedItems = 0;
    
    // Process each media item
    const processMedia = async () => {
      // Get performance tracker for the entire operation
      const batchTracker = performanceTracker.start('media.regenerateThumbnails');
      
      for (const media of result.rows) {
        try {
          // Get the media file path
          const mediaPath = path.join(UPLOAD_DIR, media.media_type, media.id);
          
          // Check if the file exists
          if (!fs.existsSync(mediaPath)) {
            logger.error(`Media file not found: ${mediaPath}`);
            failedItems++;
            continue;
          }
          
          // Read the file
          const fileBuffer = fs.readFileSync(mediaPath);
          
          // Generate thumbnail directory if it doesn't exist
          const thumbnailDir = path.join(UPLOAD_DIR, 'thumbnails');
          if (!fs.existsSync(thumbnailDir)) {
            fs.mkdirSync(thumbnailDir, { recursive: true });
          }
          
          // Generate WebP directory if it doesn't exist
          const webpDir = path.join(UPLOAD_DIR, 'webp');
          if (!fs.existsSync(webpDir)) {
            fs.mkdirSync(webpDir, { recursive: true });
          }
          
          // Set thumbnail size
          const thumbnailSize = parseInt(process.env.THUMBNAIL_SIZE || '300', 10);
          
          // Set WebP quality
          const webpQuality = parseInt(process.env.WEBP_QUALITY || '80', 10);
          
          // Get item-specific performance tracker
          const itemTracker = performanceTracker.start('media.regenerateThumbnail');
          
          // Process the image with sharp
          const image = sharp(fileBuffer);
          
          // Get image metadata
          const metadata = await image.metadata();
          
          // Generate paths for thumbnails
          const thumbnailPath = path.join(thumbnailDir, `${media.id}_thumb.jpg`);
          const webpThumbnailPath = path.join(webpDir, `${media.id}_thumb.webp`);
          
          // Generate regular thumbnail if needed
          if (!webpOnly) {
            await image
              .resize(thumbnailSize, thumbnailSize, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toFile(thumbnailPath);
          }
          
          // Generate WebP thumbnail
          await image
            .resize(thumbnailSize, thumbnailSize, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: webpQuality })
            .toFile(webpThumbnailPath);
          
          // Update the media record in the database
          const updateQuery = webpOnly
            ? `UPDATE media SET webp_thumbnail_path = $1, updated_at = NOW() WHERE id = $2`
            : `UPDATE media SET thumbnail_path = $1, webp_thumbnail_path = $2, updated_at = NOW() WHERE id = $3`;
          
          const updateParams = webpOnly
            ? [webpThumbnailPath, media.id]
            : [thumbnailPath, webpThumbnailPath, media.id];
          
          await pool.query(updateQuery, updateParams);
          
          // End performance tracking for this item
          itemTracker.end({
            mediaId: media.id,
            mediaType: media.media_type,
            mimeType: media.mime_type,
            width: metadata.width,
            height: metadata.height
          });
          
          // Increment success counter
          successItems++;
        } catch (error) {
          logger.error(`Error regenerating thumbnail for media ${media.id}: ${error.message}`);
          failedItems++;
        }
        
        // Increment processed counter
        processedItems++;
      }
      
      // End batch performance tracking
      batchTracker.end({
        totalItems,
        successItems,
        failedItems
      });
      
      logger.info(`Thumbnail regeneration complete: ${successItems} succeeded, ${failedItems} failed`);
    };
    
    // Start the background process
    processMedia();
    
    // Return immediate response
    return res.status(200).json({
      success: true,
      message: `Started thumbnail regeneration for ${totalItems} media items`,
      count: totalItems
    });
  } catch (error) {
    logger.error(`Error regenerating thumbnails: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to regenerate thumbnails'
    });
  }
};

module.exports = {
  uploadMedia,
  uploadMediaBatch,
  getMediaById,
  deleteMedia,
  getMediaForConversation,
  getMediaThumbnail,
  getMediaStats,
  regenerateThumbnails
};
