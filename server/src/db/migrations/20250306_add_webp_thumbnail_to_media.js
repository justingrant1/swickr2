/**
 * Migration: Add WebP thumbnail path to media table
 * 
 * This migration adds a new column to store WebP thumbnail paths and updates the
 * existing media table to support the new performance optimizations.
 */

const { pool } = require('../../db');
const logger = require('../../utils/logger');

/**
 * Run the migration
 */
const up = async () => {
  try {
    logger.info('Running migration: Add WebP thumbnail path to media table');
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Add webp_thumbnail_path column
    await pool.query(`
      ALTER TABLE media
      ADD COLUMN IF NOT EXISTS webp_thumbnail_path TEXT
    `);
    
    // Create index on webp_thumbnail_path
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_media_webp_thumbnail_path ON media(webp_thumbnail_path)
      WHERE webp_thumbnail_path IS NOT NULL
    `);
    
    // Add conversation_id column if it doesn't exist
    await pool.query(`
      ALTER TABLE media
      ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE
    `);
    
    // Create index on conversation_id
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_media_conversation_id ON media(conversation_id)
      WHERE conversation_id IS NOT NULL
    `);
    
    // Add performance-related columns
    await pool.query(`
      ALTER TABLE media
      ADD COLUMN IF NOT EXISTS processing_time INTEGER,
      ADD COLUMN IF NOT EXISTS thumbnail_processing_time INTEGER,
      ADD COLUMN IF NOT EXISTS webp_processing_time INTEGER
    `);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    logger.info('Migration completed successfully');
  } catch (error) {
    // Rollback the transaction in case of error
    await pool.query('ROLLBACK');
    logger.error(`Migration failed: ${error.message}`);
    throw error;
  }
};

/**
 * Revert the migration
 */
const down = async () => {
  try {
    logger.info('Reverting migration: Add WebP thumbnail path to media table');
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Drop the index on webp_thumbnail_path
    await pool.query(`
      DROP INDEX IF EXISTS idx_media_webp_thumbnail_path
    `);
    
    // Remove webp_thumbnail_path column
    await pool.query(`
      ALTER TABLE media
      DROP COLUMN IF EXISTS webp_thumbnail_path
    `);
    
    // Drop the index on conversation_id
    await pool.query(`
      DROP INDEX IF EXISTS idx_media_conversation_id
    `);
    
    // Remove performance-related columns
    await pool.query(`
      ALTER TABLE media
      DROP COLUMN IF EXISTS processing_time,
      DROP COLUMN IF EXISTS thumbnail_processing_time,
      DROP COLUMN IF EXISTS webp_processing_time
    `);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    logger.info('Migration reverted successfully');
  } catch (error) {
    // Rollback the transaction in case of error
    await pool.query('ROLLBACK');
    logger.error(`Migration reversion failed: ${error.message}`);
    throw error;
  }
};

module.exports = {
  up,
  down
};
