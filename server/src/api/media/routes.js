const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { 
  uploadMedia, 
  uploadMediaBatch,
  getMediaById, 
  deleteMedia, 
  getMediaForConversation,
  getMediaThumbnail,
  getMediaStats,
  regenerateThumbnails
} = require('./controller');
const { authenticate } = require('../../middleware/auth');
const cache = require('../../utils/cache');
const performanceTracker = require('../../utils/performanceTracker');

// Get upload directory from environment or use default
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');

// Create temp directory if it doesn't exist
const tempDir = path.join(UPLOAD_DIR, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for disk storage in temp directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter function to validate file types before upload
const fileFilter = (req, file, cb) => {
  // Check if the file type is allowed
  const allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif', 'image/heic',
    // Videos
    'video/mp4', 'video/webm', 'video/quicktime',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// Configure multer with storage, limits, and file filter
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter
});

// Error handling middleware for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        success: false, 
        error: 'File is too large. Maximum file size is 100MB.' 
      });
    }
    return res.status(400).json({ 
      success: false, 
      error: `Upload error: ${err.message}` 
    });
  } else if (err) {
    // An unknown error occurred
    return res.status(400).json({ 
      success: false, 
      error: err.message 
    });
  }
  // No error occurred, continue
  next();
};

// Cache middleware for media endpoints
const cacheMiddleware = (req, res, next) => {
  // Skip cache if explicitly requested
  if (req.query.noCache === 'true') {
    return next();
  }
  
  // Generate cache key based on URL and query parameters
  const cacheKey = `media:route:${req.originalUrl}`;
  
  // Check if response is in cache
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    // For binary data (images, etc.), set the appropriate headers
    if (cachedResponse.headers) {
      Object.keys(cachedResponse.headers).forEach(header => {
        res.setHeader(header, cachedResponse.headers[header]);
      });
    }
    
    // Send the cached response
    return res.status(cachedResponse.status).send(cachedResponse.data);
  }
  
  // Store the original res.send method
  const originalSend = res.send;
  
  // Override res.send to cache the response before sending
  res.send = function(body) {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Store headers for content type, etc.
      const headers = {};
      const headersToCache = ['content-type', 'content-length', 'last-modified', 'etag'];
      headersToCache.forEach(header => {
        if (res.getHeader(header)) {
          headers[header] = res.getHeader(header);
        }
      });
      
      // Cache the response
      cache.set(cacheKey, {
        status: res.statusCode,
        data: body,
        headers
      }, 3600); // Cache for 1 hour
    }
    
    // Call the original send method
    return originalSend.call(this, body);
  };
  
  next();
};

// Performance tracking middleware
const trackPerformance = (operationName) => {
  return (req, res, next) => {
    const tracker = performanceTracker.start(`media.${operationName}`);
    
    // Store the original end method
    const originalEnd = res.end;
    
    // Override res.end to track performance before ending
    res.end = function(chunk, encoding) {
      // End performance tracking
      tracker.end({
        status: res.statusCode,
        mediaId: req.params.id,
        format: req.query.format,
        size: req.query.size
      });
      
      // Call the original end method
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

/**
 * @route POST /api/media/upload
 * @desc Upload a single media file
 * @access Private
 */
router.post('/upload', authenticate, upload.single('file'), handleMulterError, trackPerformance('upload'), uploadMedia);

/**
 * @route POST /api/media/upload/batch
 * @desc Upload multiple media files
 * @access Private
 */
router.post('/upload/batch', authenticate, upload.array('files', 10), handleMulterError, trackPerformance('uploadBatch'), uploadMediaBatch);

/**
 * @route GET /api/media/thumbnail/:id
 * @desc Get media thumbnail by ID
 * @access Private (with authentication)
 */
router.get('/thumbnail/:id', authenticate, cacheMiddleware, trackPerformance('getThumbnail'), getMediaThumbnail);

/**
 * @route GET /api/media/conversation/:conversationId
 * @desc Get all media for a conversation
 * @access Private
 */
router.get('/conversation/:conversationId', authenticate, cacheMiddleware, trackPerformance('getConversationMedia'), getMediaForConversation);

/**
 * @route GET /api/media/:id
 * @desc Get media file by ID
 * @access Private (with authentication)
 */
router.get('/:id', authenticate, cacheMiddleware, trackPerformance('getMedia'), getMediaById);

/**
 * @route DELETE /api/media/:id
 * @desc Delete media file
 * @access Private
 */
router.delete('/:id', authenticate, trackPerformance('deleteMedia'), deleteMedia);

/**
 * @route GET /api/media/stats
 * @desc Get media performance statistics
 * @access Private (admin only)
 */
router.get('/stats', authenticate, getMediaStats);

/**
 * @route POST /api/media/regenerate-thumbnails
 * @desc Regenerate thumbnails for existing media
 * @access Private (admin only)
 */
router.post('/regenerate-thumbnails', authenticate, trackPerformance('regenerateThumbnails'), regenerateThumbnails);

module.exports = router;
