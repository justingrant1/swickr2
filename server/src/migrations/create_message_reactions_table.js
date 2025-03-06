/**
 * Migration script to create the message_reactions table
 */
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const createMessageReactionsTable = async () => {
  const client = await pool.connect();
  
  try {
    logger.info('Starting migration: Creating message_reactions table');
    
    await client.query('BEGIN');
    
    // Check if table already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'message_reactions'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      logger.info('message_reactions table already exists, skipping creation');
      await client.query('COMMIT');
      return;
    }
    
    // Create message_reactions table
    await client.query(`
      CREATE TABLE message_reactions (
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
      CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
    `);
    
    await client.query(`
      CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);
    `);
    
    await client.query(`
      CREATE INDEX idx_message_reactions_emoji ON message_reactions(emoji);
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
};

module.exports = { createMessageReactionsTable };
