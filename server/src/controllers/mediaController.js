/**
 * Media Controller
 * 
 * Handles API endpoints for media uploads, retrieval, and management.
 */

const mediaService = require('../services/mediaService');
const Message = require('../models/Message');
const logger = require('../utils/logger');
const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);

/**
 * Upload a media file
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const uploadMedia = async (req, res) => {
  try {
    // Check if file exists in request
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const { conversationId } = req.body;

    // Save file to disk
    const mediaInfo = await mediaService.saveFileToDisk(req.file, userId);

    // Create a message with the media
    if (conversationId) {
      const message = await Message.create({
        conversationId,
        senderId: userId,
        content: req.body.content || '',
        mediaId: mediaInfo.id,
        mediaType: mediaInfo.mediaType,
        mediaUrl: mediaInfo.url
      });

      // Include the message in the response
      mediaInfo.message = message;
    }

    logger.info(`Media uploaded by user ${userId}: ${mediaInfo.filename}`);
    return res.status(201).json(mediaInfo);
  } catch (error) {
    logger.error(`Media upload error: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Get a media file
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMedia = async (req, res) => {
  try {
    const { userId, mediaType, filename } = req.params;

    // Check if file exists
    const fileExists = await mediaService.fileExists(userId, mediaType, filename);
    if (!fileExists) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file path
    const filePath = mediaService.getFilePath(userId, mediaType, filename);

    // Read file
    const fileBuffer = await readFile(filePath);

    // Set appropriate content type
    const ext = filename.split('.').pop().toLowerCase();
    let contentType = 'application/octet-stream';

    if (['jpg', 'jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'gif') contentType = 'image/gif';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'mp4') contentType = 'video/mp4';
    else if (ext === 'webm') contentType = 'video/webm';
    else if (ext === 'mov') contentType = 'video/quicktime';
    else if (ext === 'pdf') contentType = 'application/pdf';
    else if (['doc', 'docx'].includes(ext)) contentType = 'application/msword';
    else if (['xls', 'xlsx'].includes(ext)) contentType = 'application/vnd.ms-excel';
    else if (['ppt', 'pptx'].includes(ext)) contentType = 'application/vnd.ms-powerpoint';
    else if (ext === 'txt') contentType = 'text/plain';
    else if (ext === 'mp3') contentType = 'audio/mpeg';
    else if (ext === 'wav') contentType = 'audio/wav';
    else if (ext === 'ogg') contentType = 'audio/ogg';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    // Send file
    return res.send(fileBuffer);
  } catch (error) {
    logger.error(`Media retrieval error: ${error.message}`);
    return res.status(500).json({ error: 'Failed to retrieve media file' });
  }
};

/**
 * Delete a media file
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = req.user.id;

    // Get message by mediaId
    const message = await Message.findByMediaId(mediaId);

    // Check if message exists and belongs to the user
    if (!message) {
      return res.status(404).json({ error: 'Media not found' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this media' });
    }

    // Delete file
    await mediaService.deleteFile(userId, message.mediaType, message.mediaUrl.split('/').pop());

    // Update message to remove media reference
    await Message.update(message.id, {
      mediaId: null,
      mediaType: null,
      mediaUrl: null
    });

    logger.info(`Media deleted by user ${userId}: ${mediaId}`);
    return res.status(200).json({ message: 'Media deleted successfully' });
  } catch (error) {
    logger.error(`Media deletion error: ${error.message}`);
    return res.status(500).json({ error: 'Failed to delete media file' });
  }
};

module.exports = {
  uploadMedia,
  getMedia,
  deleteMedia
};
