/**
 * Migration: Media Tables
 * 
 * Creates and updates tables related to media handling
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Run the migration
 */
async function up() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create media table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        media_type VARCHAR(20) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        thumbnail_path VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    
    // Add indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_media_media_type ON media(media_type)
    `);
    
    // Add conversation_id column if it doesn't exist
    const checkColumnResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'media' AND column_name = 'conversation_id'
    `);
    
    if (checkColumnResult.rows.length === 0) {
      await client.query(`
        ALTER TABLE media ADD COLUMN conversation_id VARCHAR(36)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_media_conversation_id ON media(conversation_id)
      `);
    }
    
    // Ensure messages table has media-related columns
    const messageColumnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'media_id'
    `);
    
    if (messageColumnsResult.rows.length === 0) {
      // Add media-related columns to messages table
      await client.query(`
        ALTER TABLE messages 
        ADD COLUMN media_id VARCHAR(36),
        ADD COLUMN media_type VARCHAR(20),
        ADD COLUMN media_url VARCHAR(255),
        ADD COLUMN media_caption TEXT,
        ADD COLUMN media_size BIGINT,
        ADD COLUMN media_mime_type VARCHAR(100)
      `);
      
      // Add index for media_id
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_media_id ON messages(media_id)
      `);
    }
    
    await client.query('COMMIT');
    logger.info('Media tables migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error in media tables migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rollback the migration
 */
async function down() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Remove media-related columns from messages table
    await client.query(`
      ALTER TABLE messages 
      DROP COLUMN IF EXISTS media_id,
      DROP COLUMN IF EXISTS media_type,
      DROP COLUMN IF EXISTS media_url,
      DROP COLUMN IF EXISTS media_caption,
      DROP COLUMN IF EXISTS media_size,
      DROP COLUMN IF EXISTS media_mime_type
    `);
    
    // Drop media table
    await client.query(`
      DROP TABLE IF EXISTS media
    `);
    
    await client.query('COMMIT');
    logger.info('Media tables migration rollback completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error in media tables migration rollback:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };
