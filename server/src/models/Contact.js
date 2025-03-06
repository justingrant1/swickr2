const { pool } = require('../config/database');
const logger = require('../utils/logger');

class Contact {
  /**
   * Get all contacts for a user
   * @param {string} userId - User ID
   * @returns {Array} Array of contacts
   */
  static async getContactsByUserId(userId) {
    try {
      const result = await pool.query(
        `SELECT u.id, u.username, u.full_name as name, u.profile_picture as avatar, u.status, u.last_seen
         FROM contacts c
         JOIN users u ON c.contact_id = u.id
         WHERE c.user_id = $1
         ORDER BY u.full_name`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting contacts:', error);
      throw error;
    }
  }
  
  /**
   * Add a contact
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @returns {Object} Created contact
   */
  static async addContact(userId, contactId) {
    const client = await pool.connect();
    try {
      logger.debug(`Adding contact: userId=${userId}, contactId=${contactId}`);
      
      // Check if users are the same
      if (userId === contactId) {
        logger.debug('Cannot add yourself as a contact');
        throw new Error('Cannot add yourself as a contact');
      }
      
      await client.query('BEGIN');
      
      // Check if contact exists
      logger.debug(`Checking if user ${contactId} exists`);
      const userExists = await client.query(
        `SELECT id FROM users WHERE id = $1`,
        [contactId]
      );
      
      if (userExists.rows.length === 0) {
        logger.debug(`User ${contactId} not found`);
        throw new Error('User not found');
      }
      
      // Check if contact already exists
      logger.debug(`Checking if contact already exists: user=${userId}, contact=${contactId}`);
      const existingContact = await client.query(
        `SELECT id FROM contacts WHERE user_id = $1 AND contact_id = $2`,
        [userId, contactId]
      );
      
      if (existingContact.rows.length > 0) {
        logger.debug(`Contact already exists: user=${userId}, contact=${contactId}`);
        throw new Error('Contact already exists');
      }
      
      // Add contact
      logger.debug(`Inserting new contact: user=${userId}, contact=${contactId}`);
      const result = await client.query(
        `INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2) RETURNING id`,
        [userId, contactId]
      );
      
      // Add reciprocal contact (bidirectional relationship)
      logger.debug(`Adding reciprocal contact: user=${contactId}, contact=${userId}`);
      await client.query(
        `INSERT INTO contacts (user_id, contact_id) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id, contact_id) DO NOTHING`,
        [contactId, userId]
      );
      
      // Get contact details
      logger.debug(`Getting contact details for user ${contactId}`);
      const contactDetails = await client.query(
        `SELECT u.id, u.username, u.full_name as name, u.profile_picture as avatar, u.status, u.last_seen
         FROM users u
         WHERE u.id = $1`,
        [contactId]
      );
      
      await client.query('COMMIT');
      
      logger.debug(`Contact added successfully: ${JSON.stringify(contactDetails.rows[0], null, 2)}`);
      return contactDetails.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error adding contact:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Remove a contact
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @returns {boolean} Success
   */
  static async removeContact(userId, contactId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `DELETE FROM contacts WHERE user_id = $1 AND contact_id = $2 RETURNING id`,
        [userId, contactId]
      );
      
      await client.query('COMMIT');
      
      return result.rowCount > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error removing contact:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Check if a user is a contact
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @returns {boolean} True if contact exists
   */
  static async isContact(userId, contactId) {
    try {
      const result = await pool.query(
        `SELECT id FROM contacts WHERE user_id = $1 AND contact_id = $2`,
        [userId, contactId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking contact:', error);
      throw error;
    }
  }
  
  /**
   * Get a contact by ID
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @returns {Object|null} Contact or null if not found
   */
  static async getContactById(userId, contactId) {
    try {
      const result = await pool.query(
        `SELECT u.id, u.username, u.full_name as name, u.profile_picture as avatar, u.status, u.last_seen
         FROM contacts c
         JOIN users u ON c.contact_id = u.id
         WHERE c.user_id = $1 AND c.contact_id = $2`,
        [userId, contactId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting contact by ID:', error);
      throw error;
    }
  }
  
  /**
   * Search for users to add as contacts
   * @param {string} query - Search query
   * @param {string} userId - Current user ID
   * @returns {Array} Array of users
   */
  static async searchUsers(query, userId) {
    try {
      // Search for users by username or full name
      const result = await pool.query(
        `SELECT u.id, u.username, u.full_name as name, u.profile_picture as avatar, u.status,
                (SELECT EXISTS(SELECT 1 FROM contacts WHERE user_id = $2 AND contact_id = u.id)) as is_contact
         FROM users u
         WHERE u.id != $2
         AND (u.username ILIKE $1 OR u.full_name ILIKE $1)
         ORDER BY u.full_name
         LIMIT 20`,
        [`%${query}%`, userId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  }
}

module.exports = Contact;
