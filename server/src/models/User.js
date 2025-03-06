const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const redis = require('../config/redis');

class User {
  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Object} Created user
   */
  static async create(userData) {
    const client = await pool.connect();
    try {
      const { username, email, password, fullName } = userData;
      
      // Check if username or email already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );
      
      if (existingUser.rows.length > 0) {
        throw new Error('Username or email already exists');
      }
      
      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      // Generate UUID for user
      const userId = uuidv4();
      
      // Insert user
      const result = await client.query(
        `INSERT INTO users (id, username, email, password_hash, full_name, status) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, username, email, full_name, profile_picture, status, created_at`,
        [userId, username, email, passwordHash, fullName, 'offline']
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Authenticate a user
   * @param {string} usernameOrEmail - Username or email
   * @param {string} password - Password
   * @returns {Object} User data
   */
  static async authenticate(usernameOrEmail, password) {
    try {
      // Find user by username or email
      const result = await pool.query(
        'SELECT id, username, email, password_hash, full_name, profile_picture, status FROM users WHERE username = $1 OR email = $1',
        [usernameOrEmail]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Invalid username/email or password');
      }
      
      const user = result.rows[0];
      
      // Check password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      
      if (!passwordMatch) {
        throw new Error('Invalid username/email or password');
      }
      
      // Update user status to online
      await this.updateStatus(user.id, 'online');
      
      // Return user data in a consistent format
      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          profile_picture: user.profile_picture,
          status: 'online'
        }
      };
    } catch (error) {
      logger.error('Error authenticating user:', error);
      throw error;
    }
  }
  
  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Object} User data
   */
  static async getById(id) {
    try {
      const result = await pool.query(
        'SELECT id, username, email, full_name, profile_picture, status, created_at FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const user = result.rows[0];
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        profilePicture: user.profile_picture,
        status: user.status,
        createdAt: user.created_at
      };
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }
  
  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Object} User data
   */
  static async getByUsername(username) {
    try {
      logger.debug(`Getting user by username: ${username}`);
      
      const result = await pool.query(
        'SELECT id, username, email, full_name, profile_picture, status, created_at FROM users WHERE username = $1',
        [username]
      );
      
      logger.debug(`Query result for username ${username}: ${JSON.stringify(result.rows, null, 2)}`);
      
      if (result.rows.length === 0) {
        logger.debug(`No user found with username: ${username}`);
        return null;
      }
      
      const user = result.rows[0];
      logger.debug(`Found user by username: ${JSON.stringify(user, null, 2)}`);
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        profilePicture: user.profile_picture,
        status: user.status,
        createdAt: user.created_at
      };
    } catch (error) {
      logger.error(`Error getting user by username ${username}:`, error);
      throw error;
    }
  }
  
  /**
   * Get user by email
   * @param {string} email - Email
   * @returns {Object} User data
   */
  static async getByEmail(email) {
    try {
      logger.debug(`Getting user by email: ${email}`);
      
      const result = await pool.query(
        'SELECT id, username, email, full_name, profile_picture, status, created_at FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length === 0) {
        logger.debug(`No user found with email: ${email}`);
        return null;
      }
      
      const user = result.rows[0];
      logger.debug(`Found user by email: ${JSON.stringify(user, null, 2)}`);
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        profilePicture: user.profile_picture,
        status: user.status,
        createdAt: user.created_at
      };
    } catch (error) {
      logger.error('Error getting user by email:', error);
      throw error;
    }
  }
  
  /**
   * Search users by username or full name
   * @param {string} query - Search query
   * @param {string} currentUserId - Current user ID (to exclude from results)
   * @returns {Array} Array of users
   */
  static async search(query, currentUserId) {
    try {
      logger.debug(`Searching users with query: "${query}", excluding user: ${currentUserId}`);
      
      const result = await pool.query(
        `SELECT 
          u.id, 
          u.username, 
          u.full_name, 
          u.profile_picture, 
          u.status,
          u.last_seen_at
         FROM users u
         WHERE (u.username ILIKE $1 OR u.full_name ILIKE $1) AND u.id != $2
         LIMIT 20`,
        [`%${query}%`, currentUserId]
      );
      
      logger.debug(`Found ${result.rows.length} users matching query "${query}"`);
      
      return result.rows.map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        profilePicture: user.profile_picture,
        status: user.status,
        lastSeenAt: user.last_seen_at
      }));
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  }
  
  /**
   * Update user profile
   * @param {string} id - User ID
   * @param {Object} profileData - Profile data to update
   * @returns {Object} Updated user data
   */
  static async updateProfile(id, profileData) {
    const client = await pool.connect();
    try {
      const { fullName, profilePicture } = profileData;
      
      // Update user profile
      const result = await client.query(
        `UPDATE users 
         SET full_name = COALESCE($1, full_name), 
             profile_picture = COALESCE($2, profile_picture),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, username, email, full_name, profile_picture, status`,
        [fullName, profilePicture, id]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = result.rows[0];
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        profilePicture: user.profile_picture,
        status: user.status
      };
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Update user password
   * @param {string} id - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  static async updatePassword(id, currentPassword, newPassword) {
    const client = await pool.connect();
    try {
      // Get current password hash
      const userResult = await client.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [id]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      
      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!passwordMatch) {
        throw new Error('Current password is incorrect');
      }
      
      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      
      // Update password
      await client.query(
        `UPDATE users 
         SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newPasswordHash, id]
      );
      
      return true;
    } catch (error) {
      logger.error('Error updating user password:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Update user status
   * @param {string} userId - User ID
   * @param {string} status - New status (online, offline, away, busy)
   * @returns {boolean} True if status was updated
   */
  static async updateStatus(userId, status) {
    try {
      const validStatuses = ['online', 'offline', 'away', 'busy', 'custom'];
      
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }
      
      const result = await pool.query(
        `UPDATE users 
         SET status = $1, 
             status_updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING id`,
        [status, userId]
      );
      
      // Also update in Redis for fast access
      if (redis.redisClient) {
        await redis.redisClient.hSet('user:status', userId, status);
      }
      
      // Add to status history
      await this.addStatusHistory(userId, status);
      
      logger.debug(`Updated user ${userId} status to ${status}`);
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error updating user status: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update user's last seen timestamp
   * @param {string} userId - User ID
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {boolean} True if last seen was updated
   */
  static async updateLastSeen(userId, timestamp) {
    try {
      const lastSeen = new Date(timestamp).toISOString();
      
      const result = await pool.query(
        `UPDATE users SET last_seen_at = $1 WHERE id = $2 RETURNING id`,
        [lastSeen, userId]
      );
      
      // Also update in Redis for fast access
      if (redis.redisClient) {
        await redis.redisClient.hSet('user:lastSeen', userId, timestamp.toString());
      }
      
      logger.debug(`Updated user ${userId} last seen to ${lastSeen}`);
      return result.rows.length > 0;
    } catch (error) {
      logger.error(`Error updating user last seen: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get user's contacts
   * @param {string} userId - User ID
   * @returns {Array<string>} Array of contact user IDs
   */
  static async getContacts(userId) {
    try {
      const result = await pool.query(
        `SELECT contact_id FROM contacts WHERE user_id = $1`,
        [userId]
      );
      
      return result.rows.map(row => row.contact_id);
    } catch (error) {
      logger.error(`Error getting user contacts: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get user's contacts with details
   * @param {string} userId - User ID
   * @returns {Array<Object>} Array of contact objects with user details
   */
  static async getContactsWithDetails(userId) {
    try {
      const result = await pool.query(
        `SELECT 
          u.id, 
          u.username, 
          u.full_name, 
          u.profile_picture, 
          u.status,
          u.last_seen_at,
          c.nickname
         FROM contacts c
         JOIN users u ON c.contact_id = u.id
         WHERE c.user_id = $1
         ORDER BY u.full_name, u.username`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error(`Error getting user contacts with details: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get user status
   * @param {string} id - User ID
   * @returns {string} User status
   */
  static async getStatus(id) {
    try {
      // Try to get status from Redis first
      const redisStatus = await redis.getUserStatus(id);
      
      if (redisStatus) {
        return redisStatus;
      }
      
      // Fallback to database
      const result = await pool.query(
        'SELECT status FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0].status;
    } catch (error) {
      logger.error('Error getting user status:', error);
      throw error;
    }
  }
  
  /**
   * Delete user account
   * @param {string} id - User ID
   * @param {string} password - Password for verification
   * @returns {boolean} Success status
   */
  static async deleteAccount(id, password) {
    const client = await pool.connect();
    try {
      // Get current password hash
      const userResult = await client.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [id]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      
      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      
      if (!passwordMatch) {
        throw new Error('Password is incorrect');
      }
      
      // Delete user
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      
      // Remove user status from Redis
      await redis.removeUserStatus(id);
      
      return true;
    } catch (error) {
      logger.error('Error deleting user account:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Set custom status message
   * @param {string} userId - User ID
   * @param {string} statusMessage - Custom status message
   * @param {string} emoji - Optional emoji for the status
   * @returns {Object} Updated user data
   */
  static async setCustomStatus(userId, statusMessage, emoji = null) {
    const client = await pool.connect();
    try {
      // Validate status message length
      if (statusMessage && statusMessage.length > 100) {
        throw new Error('Status message must be 100 characters or less');
      }
      
      // Update user status to custom and set status message
      const result = await client.query(
        `UPDATE users 
         SET status = 'custom', 
             status_message = $1,
             status_emoji = $2,
             status_updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, username, status, status_message, status_emoji, status_updated_at`,
        [statusMessage, emoji, userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = result.rows[0];
      
      // Add to status history
      await this.addStatusHistory(userId, 'custom', statusMessage);
      
      // Update Redis cache
      if (redis.redisClient) {
        await redis.redisClient.hSet('user:status', userId, 'custom');
        await redis.redisClient.hSet('user:statusMessage', userId, statusMessage || '');
        if (emoji) {
          await redis.redisClient.hSet('user:statusEmoji', userId, emoji);
        }
      }
      
      return {
        id: user.id,
        username: user.username,
        status: user.status,
        statusMessage: user.status_message,
        statusEmoji: user.status_emoji,
        statusUpdatedAt: user.status_updated_at
      };
    } catch (error) {
      logger.error(`Error setting custom status: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Clear custom status message
   * @param {string} userId - User ID
   * @param {string} newStatus - New status to set (defaults to 'online')
   * @returns {Object} Updated user data
   */
  static async clearCustomStatus(userId, newStatus = 'online') {
    const client = await pool.connect();
    try {
      const validStatuses = ['online', 'offline', 'away', 'busy'];
      
      if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
      }
      
      // Clear custom status and set to new status
      const result = await client.query(
        `UPDATE users 
         SET status = $1, 
             status_message = NULL,
             status_emoji = NULL,
             status_updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, username, status, status_updated_at`,
        [newStatus, userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = result.rows[0];
      
      // Add to status history
      await this.addStatusHistory(userId, newStatus);
      
      // Update Redis cache
      if (redis.redisClient) {
        await redis.redisClient.hSet('user:status', userId, newStatus);
        await redis.redisClient.hDel('user:statusMessage', userId);
        await redis.redisClient.hDel('user:statusEmoji', userId);
      }
      
      return {
        id: user.id,
        username: user.username,
        status: user.status,
        statusUpdatedAt: user.status_updated_at
      };
    } catch (error) {
      logger.error(`Error clearing custom status: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Add status change to history
   * @param {string} userId - User ID
   * @param {string} status - Status value
   * @param {string} statusMessage - Optional custom status message
   * @returns {Promise<void>}
   */
  static async addStatusHistory(userId, status, statusMessage = null) {
    try {
      const historyEntry = statusMessage 
        ? `${status}: ${statusMessage}`
        : status;
        
      await pool.query(
        `INSERT INTO user_status_history (user_id, status)
         VALUES ($1, $2)`,
        [userId, historyEntry]
      );
    } catch (error) {
      logger.error(`Error adding status history: ${error.message}`);
      // Don't throw, just log the error to prevent disrupting the main flow
    }
  }
  
  /**
   * Get user's status history
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of history entries to return
   * @returns {Array<Object>} Array of status history entries
   */
  static async getStatusHistory(userId, limit = 10) {
    try {
      const result = await pool.query(
        `SELECT status, created_at
         FROM user_status_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      
      return result.rows.map(entry => ({
        status: entry.status,
        timestamp: entry.created_at
      }));
    } catch (error) {
      logger.error(`Error getting status history: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get user's current status with details
   * @param {string} userId - User ID
   * @returns {Object} User status details
   */
  static async getStatusDetails(userId) {
    try {
      const result = await pool.query(
        `SELECT status, status_message, status_emoji, status_updated_at
         FROM users
         WHERE id = $1`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const statusData = result.rows[0];
      
      return {
        status: statusData.status,
        statusMessage: statusData.status_message,
        statusEmoji: statusData.status_emoji,
        updatedAt: statusData.status_updated_at
      };
    } catch (error) {
      logger.error(`Error getting status details: ${error.message}`);
      throw error;
    }
  }
}

module.exports = User;
