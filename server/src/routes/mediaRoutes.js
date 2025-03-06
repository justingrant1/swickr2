/**
 * Media Routes
 * 
 * API routes for media uploads, retrieval, and management.
 */

const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { authenticateJWT } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  }
});

// Upload media file
router.post('/upload', authenticateJWT, upload.single('file'), mediaController.uploadMedia);

// Get media file
router.get('/:userId/:mediaType/:filename', mediaController.getMedia);

// Delete media file
router.delete('/:mediaId', authenticateJWT, mediaController.deleteMedia);

module.exports = router;
