/**
 * Migration to add user status functionality
 */
const { Pool } = require('pg');
const config = require('../config/database');

const pool = new Pool(config);

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add status and status_updated_at columns to users table
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available',
      ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    `);

    // Create user_status_history table to track status changes
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_status_history (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create index for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS user_status_history_user_id_idx ON user_status_history(user_id)
    `);

    await client.query('COMMIT');
    console.log('Migration 009_user_status completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in migration 009_user_status:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop index
    await client.query(`DROP INDEX IF EXISTS user_status_history_user_id_idx`);

    // Drop table
    await client.query(`DROP TABLE IF EXISTS user_status_history`);

    // Remove columns from users table
    await client.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS status,
      DROP COLUMN IF EXISTS status_updated_at
    `);

    await client.query('COMMIT');
    console.log('Rollback of migration 009_user_status completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in rollback of migration 009_user_status:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  up,
  down
};
