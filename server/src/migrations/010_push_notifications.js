/**
 * Migration to add push notification functionality
 */
const { Pool } = require('pg');
const config = require('../config/database');

const pool = new Pool(config);

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create push_notification_subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_notification_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create notification_settings table for user preferences
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        new_message BOOLEAN DEFAULT TRUE,
        message_reactions BOOLEAN DEFAULT TRUE,
        group_invites BOOLEAN DEFAULT TRUE,
        status_updates BOOLEAN DEFAULT TRUE,
        sound_enabled BOOLEAN DEFAULT TRUE,
        vibration_enabled BOOLEAN DEFAULT TRUE,
        quiet_hours_enabled BOOLEAN DEFAULT FALSE,
        quiet_hours_start TIME DEFAULT '22:00:00',
        quiet_hours_end TIME DEFAULT '08:00:00',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create notification_history table to track sent notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_history (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data JSONB,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS push_notification_subscriptions_user_id_idx 
      ON push_notification_subscriptions(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS notification_history_user_id_idx 
      ON notification_history(user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS notification_history_read_idx 
      ON notification_history(read)
    `);

    await client.query('COMMIT');
    console.log('Migration 010_push_notifications completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in migration 010_push_notifications:', error);
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
    await client.query(`DROP INDEX IF EXISTS push_notification_subscriptions_user_id_idx`);
    await client.query(`DROP INDEX IF EXISTS notification_history_user_id_idx`);
    await client.query(`DROP INDEX IF EXISTS notification_history_read_idx`);

    // Drop tables
    await client.query(`DROP TABLE IF EXISTS notification_history`);
    await client.query(`DROP TABLE IF EXISTS notification_settings`);
    await client.query(`DROP TABLE IF EXISTS push_notification_subscriptions`);

    await client.query('COMMIT');
    console.log('Rollback of migration 010_push_notifications completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in rollback of migration 010_push_notifications:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  up,
  down
};
