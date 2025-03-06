/**
 * Run Database Migrations
 * 
 * Executes all migrations in order
 */

require('dotenv').config();
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// Migration files
const migrations = [
  require('../migrations/004_media_tables'),
  require('../migrations/005_message_reactions')
  // Add other migrations here as they are created
];

/**
 * Run all migrations
 */
async function runMigrations() {
  logger.info('Starting database migrations...');
  
  try {
    // Create migrations table if it doesn't exist
    await createMigrationsTable();
    
    // Run each migration if not already applied
    for (const migration of migrations) {
      const migrationName = getMigrationName(migration);
      
      if (await isMigrationApplied(migrationName)) {
        logger.info(`Migration ${migrationName} already applied, skipping`);
        continue;
      }
      
      logger.info(`Applying migration: ${migrationName}`);
      await migration.up();
      
      // Record migration as applied
      await recordMigration(migrationName);
      logger.info(`Migration ${migrationName} applied successfully`);
    }
    
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    // Close the database pool
    await pool.end();
  }
}

/**
 * Create migrations table if it doesn't exist
 */
async function createMigrationsTable() {
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

/**
 * Check if a migration has already been applied
 * 
 * @param {string} migrationName - Name of the migration
 * @returns {Promise<boolean>} Whether the migration has been applied
 */
async function isMigrationApplied(migrationName) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT 1 FROM migrations WHERE name = $1',
      [migrationName]
    );
    
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

/**
 * Record a migration as applied
 * 
 * @param {string} migrationName - Name of the migration
 */
async function recordMigration(migrationName) {
  const client = await pool.connect();
  
  try {
    await client.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [migrationName]
    );
  } finally {
    client.release();
  }
}

/**
 * Get the name of a migration from its module
 * 
 * @param {Object} migration - Migration module
 * @returns {string} Migration name
 */
function getMigrationName(migration) {
  // Try to get the filename from the module
  const modulePath = require.resolve(migration);
  if (modulePath) {
    return path.basename(modulePath, '.js');
  }
  
  // Fallback to a timestamp
  return `migration_${Date.now()}`;
}

// Run the migrations
runMigrations();
