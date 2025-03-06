/**
 * Media Service
 * 
 * Handles file uploads, storage, and retrieval for the Swickr messaging application.
 * Supports images, videos, and documents with proper validation and security checks.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { promisify } = require('util');
const logger = require('../utils/logger');

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

// Media types
const MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  AUDIO: 'audio'
};

// Allowed file extensions by media type
const ALLOWED_EXTENSIONS = {
  [MEDIA_TYPES.IMAGE]: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  [MEDIA_TYPES.VIDEO]: ['.mp4', '.webm', '.mov', '.avi'],
  [MEDIA_TYPES.DOCUMENT]: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'],
  [MEDIA_TYPES.AUDIO]: ['.mp3', '.wav', '.ogg']
};

// Maximum file sizes in bytes
const MAX_FILE_SIZES = {
  [MEDIA_TYPES.IMAGE]: 5 * 1024 * 1024, // 5MB
  [MEDIA_TYPES.VIDEO]: 50 * 1024 * 1024, // 50MB
  [MEDIA_TYPES.DOCUMENT]: 10 * 1024 * 1024, // 10MB
  [MEDIA_TYPES.AUDIO]: 10 * 1024 * 1024 // 10MB
};

// Base upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Create upload directory if it doesn't exist
const ensureUploadDirExists = async () => {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    logger.info(`Upload directory ensured at ${UPLOAD_DIR}`);
  } catch (error) {
    logger.error(`Failed to create upload directory: ${error.message}`);
    throw new Error('Failed to create upload directory');
  }
};

// Initialize media service
const initialize = async () => {
  await ensureUploadDirExists();
};

// Get media type from file extension
const getMediaTypeFromExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return type;
    }
  }
  
  return null;
};

// Validate file
const validateFile = (file, allowedTypes = Object.values(MEDIA_TYPES)) => {
  const { originalname, size } = file;
  const mediaType = getMediaTypeFromExtension(originalname);
  
  if (!mediaType) {
    throw new Error('File type not allowed');
  }
  
  if (!allowedTypes.includes(mediaType)) {
    throw new Error(`File type ${mediaType} not allowed for this upload`);
  }
  
  if (size > MAX_FILE_SIZES[mediaType]) {
    throw new Error(`File size exceeds maximum allowed size for ${mediaType}`);
  }
  
  return mediaType;
};

// Generate a unique filename
const generateUniqueFilename = (originalname) => {
  const ext = path.extname(originalname);
  const uuid = uuidv4();
  const timestamp = Date.now();
  return `${uuid}-${timestamp}${ext}`;
};

// Save file to disk
const saveFileToDisk = async (file, userId) => {
  try {
    const mediaType = validateFile(file);
    const uniqueFilename = generateUniqueFilename(file.originalname);
    
    // Create user directory if it doesn't exist
    const userDir = path.join(UPLOAD_DIR, userId);
    await mkdir(userDir, { recursive: true });
    
    // Create media type directory if it doesn't exist
    const mediaTypeDir = path.join(userDir, mediaType);
    await mkdir(mediaTypeDir, { recursive: true });
    
    // Full path to save the file
    const filePath = path.join(mediaTypeDir, uniqueFilename);
    
    // Save the file
    await writeFile(filePath, file.buffer);
    
    // Calculate file hash for integrity verification
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    
    // Return file information
    return {
      id: uuidv4(),
      userId,
      originalName: file.originalname,
      filename: uniqueFilename,
      path: filePath,
      mediaType,
      mimeType: file.mimetype,
      size: file.size,
      hash,
      url: `/api/media/${userId}/${mediaType}/${uniqueFilename}`,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Failed to save file: ${error.message}`);
    throw error;
  }
};

// Delete file from disk
const deleteFile = async (userId, mediaType, filename) => {
  try {
    const filePath = path.join(UPLOAD_DIR, userId, mediaType, filename);
    
    // Check if file exists
    await stat(filePath);
    
    // Delete the file
    await unlink(filePath);
    
    return true;
  } catch (error) {
    logger.error(`Failed to delete file: ${error.message}`);
    throw error;
  }
};

// Get file path
const getFilePath = (userId, mediaType, filename) => {
  return path.join(UPLOAD_DIR, userId, mediaType, filename);
};

// Check if file exists
const fileExists = async (userId, mediaType, filename) => {
  try {
    const filePath = getFilePath(userId, mediaType, filename);
    await stat(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  initialize,
  MEDIA_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZES,
  validateFile,
  saveFileToDisk,
  deleteFile,
  getFilePath,
  fileExists,
  getMediaTypeFromExtension
};
