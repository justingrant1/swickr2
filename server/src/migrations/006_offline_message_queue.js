/**
 * Migration to create the offline_message_queue table
 */
const { Pool } = require('pg');
const config = require('../config/database');

const pool = new Pool(config);

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create offline_message_queue table
    await client.query(`
      CREATE TABLE IF NOT EXISTS offline_message_queue (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        content TEXT,
        media_id UUID,
        parent_message_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        CONSTRAINT offline_message_queue_media_fk FOREIGN KEY (media_id)
          REFERENCES media(id) ON DELETE SET NULL,
        CONSTRAINT offline_message_queue_parent_message_fk FOREIGN KEY (parent_message_id)
          REFERENCES messages(id) ON DELETE SET NULL
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS offline_message_queue_user_id_idx ON offline_message_queue(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS offline_message_queue_conversation_id_idx ON offline_message_queue(conversation_id)
    `);

    await client.query('COMMIT');
    console.log('Migration 006_offline_message_queue completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in migration 006_offline_message_queue:', error);
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
    await client.query(`DROP INDEX IF EXISTS offline_message_queue_user_id_idx`);
    await client.query(`DROP INDEX IF EXISTS offline_message_queue_conversation_id_idx`);

    // Drop table
    await client.query(`DROP TABLE IF EXISTS offline_message_queue`);

    await client.query('COMMIT');
    console.log('Rollback of migration 006_offline_message_queue completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in rollback of migration 006_offline_message_queue:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  up,
  down
};
