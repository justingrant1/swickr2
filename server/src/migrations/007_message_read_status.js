/**
 * Migration to add read receipt privacy controls
 */
const { Pool } = require('pg');
const config = require('../config/database');

const pool = new Pool(config);

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add read_receipts_enabled column to messages table
    await client.query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN DEFAULT TRUE
    `);

    // Create message_read_status table to track who has read each message
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_read_status (
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (message_id, user_id)
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS message_read_status_message_id_idx ON message_read_status(message_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS message_read_status_user_id_idx ON message_read_status(user_id)
    `);

    await client.query('COMMIT');
    console.log('Migration 007_message_read_status completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in migration 007_message_read_status:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop indexes
    await client.query(`DROP INDEX IF EXISTS message_read_status_message_id_idx`);
    await client.query(`DROP INDEX IF EXISTS message_read_status_user_id_idx`);

    // Drop table
    await client.query(`DROP TABLE IF EXISTS message_read_status`);

    // Remove column from messages table
    await client.query(`
      ALTER TABLE messages 
      DROP COLUMN IF EXISTS read_receipts_enabled
    `);

    await client.query('COMMIT');
    console.log('Rollback of migration 007_message_read_status completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in rollback of migration 007_message_read_status:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  up,
  down
};
