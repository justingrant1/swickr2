/**
 * Script to run media enhancements migration
 * 
 * This script:
 * 1. Runs the SQL migration
 * 2. Creates necessary directories for media storage
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../db');
const logger = require('../utils/logger');
require('dotenv').config();

// Get upload directory from environment variable or use default
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Media types we support
const MEDIA_TYPES = ['image', 'video', 'audio', 'document'];

/**
 * Create necessary directories for media storage
 */
async function createDirectories() {
  logger.info('Creating media storage directories...');
  
  // Create main upload directory if it doesn't exist
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info(`Created main upload directory: ${UPLOAD_DIR}`);
  }
  
  // Create temp directory for uploads
  const tempDir = path.join(UPLOAD_DIR, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    logger.info(`Created temp upload directory: ${tempDir}`);
  }
  
  // Create thumbnails directory
  const thumbnailsDir = path.join(UPLOAD_DIR, 'thumbnails');
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
    logger.info(`Created thumbnails directory: ${thumbnailsDir}`);
  }
  
  // Get all users from the database to create user-specific directories
  try {
    const result = await pool.query('SELECT id FROM users');
    const users = result.rows;
    
    for (const user of users) {
      const userId = user.id;
      const userDir = path.join(UPLOAD_DIR, userId);
      
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      
      // Create directories for each media type
      for (const mediaType of MEDIA_TYPES) {
        const mediaTypeDir = path.join(userDir, mediaType);
        if (!fs.existsSync(mediaTypeDir)) {
          fs.mkdirSync(mediaTypeDir, { recursive: true });
        }
      }
    }
    
    logger.info(`Created directories for ${users.length} users`);
  } catch (error) {
    logger.error(`Error creating user directories: ${error.message}`);
    throw error;
  }
}

/**
 * Run the SQL migration
 */
async function runMigration() {
  logger.info('Running media enhancements migration...');
  
  const migrationPath = path.join(__dirname, '../db/migrations/20230701_media_enhancements.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    // Set upload directory as a PostgreSQL setting for the migration
    await pool.query(`SET app.upload_dir = '${UPLOAD_DIR}'`);
    
    // Run the migration
    await pool.query(sql);
    
    logger.info('Migration completed successfully');
  } catch (error) {
    logger.error(`Error running migration: ${error.message}`);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Run the migration
    await runMigration();
    
    // Create directories
    await createDirectories();
    
    logger.info('Media enhancements setup completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Error setting up media enhancements: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
main();
