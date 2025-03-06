const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { 
  uploadMedia, 
  getMedia, 
  getMediaThumbnail,
  deleteMedia
} = require('./controller');
const { authenticate } = require('../../middleware/auth');

// Get upload directory from environment or use default
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer upload
const upload = multer({ 
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE || '50000000', 10) // Default 50MB
  }
});

// Handle multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: {
          message: 'File too large',
          code: 'FILE_TOO_LARGE'
        }
      });
    }
    return res.status(400).json({
      error: {
        message: err.message,
        code: err.code
      }
    });
  }
  next(err);
};

// Simple performance tracking middleware
const trackPerformance = (operationName) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Add response hook to track end time
    const originalSend = res.send;
    res.send = function(data) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`[PERFORMANCE] ${operationName}: ${duration}ms`);
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Simple cache middleware
const cacheMiddleware = (req, res, next) => {
  // For now, just pass through
  next();
};

/**
 * @route POST /api/media/upload
 * @desc Upload a media file
 * @access Private
 */
router.post('/upload', authenticate, upload.single('file'), handleMulterError, trackPerformance('upload'), uploadMedia);

/**
 * @route GET /api/media/thumbnail/:id
 * @desc Get media thumbnail by ID
 * @access Private (with authentication)
 */
router.get('/thumbnail/:id', authenticate, cacheMiddleware, trackPerformance('getThumbnail'), getMediaThumbnail);

/**
 * @route GET /api/media/:id
 * @desc Get media file by ID
 * @access Private (with authentication)
 */
router.get('/:id', authenticate, cacheMiddleware, trackPerformance('getMedia'), getMedia);

/**
 * @route DELETE /api/media/:id
 * @desc Delete media file
 * @access Private
 */
router.delete('/:id', authenticate, trackPerformance('deleteMedia'), deleteMedia);

module.exports = router;
