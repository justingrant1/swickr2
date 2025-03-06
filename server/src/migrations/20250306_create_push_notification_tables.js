/**
 * Database migration to create push notification tables
 * 
 * This migration creates the following tables:
 * - push_notification_subscriptions: Stores user push subscriptions
 * - notification_settings: Stores user notification preferences
 * - notifications: Stores notification history
 */

const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function up() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    logger.info('Creating push notification tables...');
    
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
        last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, endpoint)
      )
    `);
    
    // Create notification_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        enabled BOOLEAN DEFAULT TRUE,
        new_messages BOOLEAN DEFAULT TRUE,
        mentions BOOLEAN DEFAULT TRUE,
        contact_requests BOOLEAN DEFAULT TRUE,
        system_notifications BOOLEAN DEFAULT TRUE,
        quiet_hours_enabled BOOLEAN DEFAULT FALSE,
        quiet_hours_start TIME DEFAULT '22:00:00',
        quiet_hours_end TIME DEFAULT '08:00:00',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data JSONB,
        read_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create indexes for better performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_push_notification_subscriptions_user_id ON push_notification_subscriptions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info('Push notification tables created successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error('Error creating push notification tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    logger.info('Dropping push notification tables...');
    
    // Drop tables in reverse order (to respect foreign key constraints)
    await client.query(`DROP TABLE IF EXISTS notifications`);
    await client.query(`DROP TABLE IF EXISTS notification_settings`);
    await client.query(`DROP TABLE IF EXISTS push_notification_subscriptions`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info('Push notification tables dropped successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error('Error dropping push notification tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  up,
  down
};
