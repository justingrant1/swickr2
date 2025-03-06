/**
 * Migration: Message Reactions Table
 * 
 * Creates the message_reactions table for storing user reactions to messages
 */
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Apply the migration
 */
async function up() {
  const client = await pool.connect();
  
  try {
    logger.info('Starting migration: Creating message_reactions table');
    
    await client.query('BEGIN');
    
    // Create message_reactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id UUID PRIMARY KEY,
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(32) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(message_id, user_id, emoji)
      );
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_message_reactions_emoji ON message_reactions(emoji);
    `);
    
    await client.query('COMMIT');
    logger.info('Migration successful: Created message_reactions table');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Migration failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Revert the migration
 */
async function down() {
  const client = await pool.connect();
  
  try {
    logger.info('Reverting migration: Dropping message_reactions table');
    
    await client.query('BEGIN');
    
    // Drop indexes
    await client.query(`
      DROP INDEX IF EXISTS idx_message_reactions_message_id;
    `);
    
    await client.query(`
      DROP INDEX IF EXISTS idx_message_reactions_user_id;
    `);
    
    await client.query(`
      DROP INDEX IF EXISTS idx_message_reactions_emoji;
    `);
    
    // Drop table
    await client.query(`
      DROP TABLE IF EXISTS message_reactions;
    `);
    
    await client.query('COMMIT');
    logger.info('Migration reverted: Dropped message_reactions table');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Migration reversion failed: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };
