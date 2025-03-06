/**
 * Setup Media Directories Script
 * 
 * Creates necessary directories for media storage in the Swickr application
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get upload directory from environment or use default
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Media types to create directories for
const MEDIA_TYPES = ['image', 'video', 'audio', 'document'];

/**
 * Create directory if it doesn't exist
 * 
 * @param {string} dirPath - Path to create
 */
function createDirectoryIfNotExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  } else {
    console.log(`Directory already exists: ${dirPath}`);
  }
}

/**
 * Setup media directories
 */
async function setupMediaDirectories() {
  try {
    console.log('Setting up media directories...');
    
    // Create main upload directory
    createDirectoryIfNotExists(UPLOAD_DIR);
    
    // Create temp directory for uploads in progress
    createDirectoryIfNotExists(path.join(UPLOAD_DIR, 'temp'));
    
    // Create directories for each media type
    for (const mediaType of MEDIA_TYPES) {
      createDirectoryIfNotExists(path.join(UPLOAD_DIR, mediaType));
    }
    
    console.log('Media directories setup complete!');
  } catch (error) {
    console.error('Error setting up media directories:', error);
    process.exit(1);
  }
}

// Run the setup
setupMediaDirectories();
