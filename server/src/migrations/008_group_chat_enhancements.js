/**
 * Migration to enhance group chat functionality
 */
const { Pool } = require('pg');
const config = require('../config/database');

const pool = new Pool(config);

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add avatar_url column to conversations table
    await client.query(`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS avatar_url TEXT
    `);

    // Add is_admin column to conversation_participants table
    await client.query(`
      ALTER TABLE conversation_participants 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE
    `);

    // Add joined_at column to conversation_participants table
    await client.query(`
      ALTER TABLE conversation_participants 
      ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    `);

    await client.query('COMMIT');
    console.log('Migration 008_group_chat_enhancements completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in migration 008_group_chat_enhancements:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove columns
    await client.query(`
      ALTER TABLE conversations 
      DROP COLUMN IF EXISTS avatar_url
    `);

    await client.query(`
      ALTER TABLE conversation_participants 
      DROP COLUMN IF EXISTS is_admin
    `);

    await client.query(`
      ALTER TABLE conversation_participants 
      DROP COLUMN IF EXISTS joined_at
    `);

    await client.query('COMMIT');
    console.log('Rollback of migration 008_group_chat_enhancements completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in rollback of migration 008_group_chat_enhancements:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  up,
  down
};
