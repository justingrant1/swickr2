/**
 * Database Module
 * 
 * Provides a simplified interface for database operations
 * with support for both real and mock database connections
 */
const { pool, useMockDb } = require('./config/database');
const logger = require('./utils/logger');

/**
 * Execute a database query
 * 
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  if (useMockDb) {
    logger.warn('Using mock database for query');
    return { rows: [], rowCount: 0 };
  }
  
  try {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug(`Executed query: ${text} (${duration}ms)`);
    
    return result;
  } catch (error) {
    logger.error(`Database query error: ${error.message}`);
    throw error;
  }
};

/**
 * Begin a database transaction
 * 
 * @returns {Promise<Object>} Database client
 */
const beginTransaction = async () => {
  if (useMockDb) {
    logger.warn('Using mock database for transaction');
    return {
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
      commit: async () => {},
      rollback: async () => {}
    };
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    return client;
  } catch (error) {
    client.release();
    logger.error(`Error beginning transaction: ${error.message}`);
    throw error;
  }
};

/**
 * Commit a database transaction
 * 
 * @param {Object} client - Database client
 */
const commitTransaction = async (client) => {
  if (useMockDb) {
    return;
  }
  
  try {
    await client.query('COMMIT');
  } catch (error) {
    logger.error(`Error committing transaction: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Rollback a database transaction
 * 
 * @param {Object} client - Database client
 */
const rollbackTransaction = async (client) => {
  if (useMockDb) {
    return;
  }
  
  try {
    await client.query('ROLLBACK');
  } catch (error) {
    logger.error(`Error rolling back transaction: ${error.message}`);
  } finally {
    client.release();
  }
};

module.exports = {
  query,
  beginTransaction,
  commitTransaction,
  rollbackTransaction
};
