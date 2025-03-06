const webpush = require('web-push');
const logger = require('../utils/logger');
const { pool } = require('../config/database');
const NotificationPerformanceMonitor = require('./NotificationPerformanceMonitor');

/**
 * Service for handling push notifications
 */
class NotificationService {
  constructor() {
    // Initialize web-push with VAPID keys
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:support@swickr.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      this.initialized = true;
      logger.info('Push notification service initialized');
    } else {
      this.initialized = false;
      logger.warn('Push notification service not initialized: missing VAPID keys');
    }
  }

  /**
   * Save a push subscription for a user
   * @param {string} userId - User ID
   * @param {Object} subscription - Push subscription object
   * @param {string} userAgent - User agent string
   * @returns {Promise<Object>} - Saved subscription
   */
  async saveSubscription(userId, subscription, userAgent) {
    const client = await pool.connect();
    try {
      const { endpoint, keys } = subscription;
      
      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        throw new Error('Invalid subscription object');
      }

      // Check if subscription already exists
      const existingResult = await client.query(
        `SELECT id FROM push_notification_subscriptions 
         WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint]
      );

      if (existingResult.rows.length > 0) {
        // Update existing subscription
        const result = await client.query(
          `UPDATE push_notification_subscriptions 
           SET p256dh = $1, auth = $2, user_agent = $3, last_used_at = NOW() 
           WHERE user_id = $4 AND endpoint = $5 
           RETURNING id`,
          [keys.p256dh, keys.auth, userAgent, userId, endpoint]
        );
        
        logger.debug(`Updated push subscription for user ${userId}`);
        return { id: result.rows[0].id, updated: true };
      } else {
        // Create new subscription
        const result = await client.query(
          `INSERT INTO push_notification_subscriptions 
           (user_id, endpoint, p256dh, auth, user_agent) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING id`,
          [userId, endpoint, keys.p256dh, keys.auth, userAgent]
        );
        
        // Create default notification settings if they don't exist
        await this.ensureNotificationSettings(client, userId);
        
        logger.debug(`Created new push subscription for user ${userId}`);
        return { id: result.rows[0].id, updated: false };
      }
    } catch (error) {
      logger.error('Error saving push subscription:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Ensure notification settings exist for a user
   * @param {Object} client - Database client
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async ensureNotificationSettings(client, userId) {
    const settingsResult = await client.query(
      `SELECT user_id FROM notification_settings WHERE user_id = $1`,
      [userId]
    );

    if (settingsResult.rows.length === 0) {
      await client.query(
        `INSERT INTO notification_settings (user_id) VALUES ($1)`,
        [userId]
      );
      logger.debug(`Created default notification settings for user ${userId}`);
    }
  }

  /**
   * Delete a push subscription
   * @param {string} userId - User ID
   * @param {string} endpoint - Subscription endpoint
   * @returns {Promise<boolean>} - True if subscription was deleted
   */
  async deleteSubscription(userId, endpoint) {
    try {
      const result = await pool.query(
        `DELETE FROM push_notification_subscriptions 
         WHERE user_id = $1 AND endpoint = $2 
         RETURNING id`,
        [userId, endpoint]
      );
      
      logger.debug(`Deleted push subscription for user ${userId}`);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error deleting push subscription:', error);
      throw error;
    }
  }

  /**
   * Get all push subscriptions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - Array of subscription objects
   */
  async getUserSubscriptions(userId) {
    try {
      const result = await pool.query(
        `SELECT id, endpoint, p256dh, auth, user_agent, created_at, last_used_at 
         FROM push_notification_subscriptions 
         WHERE user_id = $1`,
        [userId]
      );
      
      return result.rows.map(row => ({
        id: row.id,
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth
        },
        userAgent: row.user_agent,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at
      }));
    } catch (error) {
      logger.error('Error getting user subscriptions:', error);
      throw error;
    }
  }

  /**
   * Update notification settings for a user
   * @param {string} userId - User ID
   * @param {Object} settings - Notification settings
   * @returns {Promise<Object>} - Updated settings
   */
  async updateNotificationSettings(userId, settings) {
    const client = await pool.connect();
    try {
      // Ensure settings exist
      await this.ensureNotificationSettings(client, userId);
      
      // Build dynamic update query
      const updateFields = [];
      const queryParams = [userId];
      let paramIndex = 2;
      
      // Add each setting to the update query
      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        }
      }
      
      // Add updated_at timestamp
      updateFields.push(`updated_at = NOW()`);
      
      // Execute update query
      const result = await client.query(
        `UPDATE notification_settings 
         SET ${updateFields.join(', ')} 
         WHERE user_id = $1 
         RETURNING *`,
        queryParams
      );
      
      logger.debug(`Updated notification settings for user ${userId}`);
      return this.formatNotificationSettings(result.rows[0]);
    } catch (error) {
      logger.error('Error updating notification settings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Format notification settings for client
   * @param {Object} dbSettings - Database settings object
   * @returns {Object} - Formatted settings
   */
  formatNotificationSettings(dbSettings) {
    if (!dbSettings) return null;
    
    return {
      enabled: dbSettings.enabled,
      newMessages: dbSettings.new_messages,
      mentions: dbSettings.mentions,
      contactRequests: dbSettings.contact_requests,
      statusUpdates: dbSettings.status_updates,
      quietHoursEnabled: dbSettings.quiet_hours_enabled,
      quietHoursStart: dbSettings.quiet_hours_start,
      quietHoursEnd: dbSettings.quiet_hours_end,
      updatedAt: dbSettings.updated_at
    };
  }

  /**
   * Get notification settings for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Notification settings
   */
  async getNotificationSettings(userId) {
    const client = await pool.connect();
    try {
      // Ensure settings exist
      await this.ensureNotificationSettings(client, userId);
      
      const result = await client.query(
        `SELECT * FROM notification_settings WHERE user_id = $1`,
        [userId]
      );
      
      return this.formatNotificationSettings(result.rows[0]);
    } catch (error) {
      logger.error('Error getting notification settings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a notification for a user
   * @param {string} userId - User ID
   * @param {string} type - Notification type (message, mention, contact_request, status_update, system)
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {Object} data - Additional notification data
   * @returns {Promise<Object>} - Created notification
   */
  async createNotification(userId, type, title, body, data = {}) {
    try {
      // Validate notification type
      const validTypes = ['message', 'mention', 'contact_request', 'status_update', 'system'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid notification type: ${type}`);
      }
      
      // Insert notification
      const result = await pool.query(
        `INSERT INTO notifications (user_id, type, title, body, data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, type, title, body, JSON.stringify(data)]
      );
      
      const notification = result.rows[0];
      logger.debug(`Created ${type} notification for user ${userId}`);
      
      // Send push notification if enabled
      await this.sendNotification(userId, notification);
      
      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send a push notification to a user
   * @param {string} userId - User ID
   * @param {Object} notification - Notification object
   * @returns {Promise<Object>} - Result of sending notifications
   */
  async sendNotification(userId, notification) {
    if (!this.initialized) {
      logger.warn('Push notification service not initialized, skipping send');
      return { sent: 0, failed: 0, skipped: true };
    }
    
    try {
      // Get user's notification settings
      const settings = await this.getNotificationSettings(userId);
      
      // Check if notifications are enabled
      if (!settings.enabled) {
        logger.debug(`Notifications disabled for user ${userId}, skipping push`);
        return { sent: 0, failed: 0, skipped: true, reason: 'notifications_disabled' };
      }
      
      // Check notification type settings
      const typeMap = {
        'message': 'newMessages',
        'mention': 'mentions',
        'contact_request': 'contactRequests',
        'status_update': 'statusUpdates',
        'system': true // System notifications are always enabled
      };
      
      const typeEnabled = typeMap[notification.type];
      if (typeEnabled !== true && !settings[typeEnabled]) {
        logger.debug(`${notification.type} notifications disabled for user ${userId}, skipping push`);
        return { sent: 0, failed: 0, skipped: true, reason: 'type_disabled' };
      }
      
      // Check quiet hours
      if (settings.quietHoursEnabled) {
        const isQuietHours = await this.isQuietHours(userId);
        if (isQuietHours) {
          logger.debug(`Quiet hours active for user ${userId}, skipping push`);
          return { sent: 0, failed: 0, skipped: true, reason: 'quiet_hours' };
        }
      }
      
      // Get user's push subscriptions
      const subscriptions = await this.getUserSubscriptions(userId);
      
      if (subscriptions.length === 0) {
        logger.debug(`No push subscriptions found for user ${userId}`);
        return { sent: 0, failed: 0, skipped: true, reason: 'no_subscriptions' };
      }
      
      // Prepare notification payload
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: '/assets/icon-192x192.png',
        badge: '/assets/badge.png',
        data: {
          ...notification.data,
          notificationId: notification.id,
          type: notification.type,
          url: this.getNotificationUrl(notification)
        },
        tag: `swickr-${notification.type}-${Date.now()}`
      });
      
      // Send push notifications to all subscriptions
      const results = await Promise.allSettled(
        subscriptions.map(subscription => 
          webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys
            },
            payload
          )
        )
      );
      
      // Count successes and failures
      const sent = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      // Log failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const subscription = subscriptions[index];
          logger.error(`Failed to send push notification to subscription ${subscription.id}:`, result.reason);
          
          // Handle expired or invalid subscriptions
          if (result.reason.statusCode === 404 || result.reason.statusCode === 410) {
            logger.info(`Removing expired subscription ${subscription.id}`);
            this.deleteSubscription(userId, subscription.endpoint).catch(err => {
              logger.error(`Error removing expired subscription:`, err);
            });
          }
        }
      });
      
      logger.debug(`Sent push notifications to ${sent}/${subscriptions.length} devices for user ${userId}`);
      return { sent, failed, skipped: false };
    } catch (error) {
      logger.error('Error sending push notification:', error);
      return { sent: 0, failed: 0, skipped: true, error: error.message };
    }
  }

  /**
   * Check if a time is within a range
   * @param {string} time - Time to check (HH:MM)
   * @param {string} start - Start time (HH:MM)
   * @param {string} end - End time (HH:MM)
   * @returns {boolean} - True if time is within range
   */
  isTimeInRange(time, start, end) {
    // Convert times to minutes since midnight for easier comparison
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);
    
    // Handle range that crosses midnight
    if (startMinutes > endMinutes) {
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }
    
    // Normal range
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }

  /**
   * Convert time string to minutes since midnight
   * @param {string} time - Time string (HH:MM)
   * @returns {number} - Minutes since midnight
   */
  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get URL for a notification
   * @param {Object} notification - Notification object
   * @returns {string} - URL to navigate to when notification is clicked
   */
  getNotificationUrl(notification) {
    switch (notification.type) {
      case 'message':
        return `/messages/${notification.data.conversationId}`;
      case 'mention':
        return `/messages/${notification.data.conversationId}?highlight=${notification.data.messageId}`;
      case 'contact_request':
        return `/contacts?request=${notification.data.requestId}`;
      case 'status_update':
        return `/contacts/${notification.data.contactId}`;
      case 'system':
        return notification.data.url || '/';
      default:
        return '/';
    }
  }

  /**
   * Mark a notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} - True if notification was marked as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const result = await pool.query(
        `UPDATE notifications
         SET read = true
         WHERE id = $1 AND user_id = $2 AND read = false
         RETURNING id`,
        [notificationId, userId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of notifications marked as read
   */
  async markAllAsRead(userId) {
    try {
      const result = await pool.query(
        `UPDATE notifications
         SET read = true
         WHERE user_id = $1 AND read = false
         RETURNING id`,
        [userId]
      );
      
      return result.rows.length;
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} - True if notification was deleted
   */
  async deleteNotification(notificationId, userId) {
    try {
      const result = await pool.query(
        `DELETE FROM notifications
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [notificationId, userId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of notifications to return
   * @param {number} options.offset - Offset for pagination
   * @param {boolean} options.unreadOnly - Only return unread notifications
   * @returns {Promise<Array>} - Array of notifications
   */
  async getNotifications(userId, options = {}) {
    const { limit = 50, offset = 0, unreadOnly = false } = options;
    
    try {
      let query = `
        SELECT id, type, title, body, data, created_at, read
        FROM notifications
        WHERE user_id = $1
      `;
      
      const queryParams = [userId];
      let paramIndex = 2;
      
      if (unreadOnly) {
        query += ` AND read = false`;
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, offset);
      
      const result = await pool.query(query, queryParams);
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Number of unread notifications
   */
  async getUnreadCount(userId) {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM notifications
         WHERE user_id = $1 AND read = false`,
        [userId]
      );
      
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error getting unread notification count:', error);
      throw error;
    }
  }

  /**
   * Send a push notification to a user
   * @param {string} userId - User ID
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} - Result of the send operation
   */
  async sendPushNotificationToUser(userId, notification) {
    if (!this.initialized) {
      logger.warn('Push notification service not initialized');
      return { success: false, error: 'Push notification service not initialized' };
    }

    try {
      // Generate a unique notification ID for tracking
      const notificationId = `${userId}-${Date.now()}`;
      
      // Start performance tracking
      const endTracking = NotificationPerformanceMonitor.startNotificationSend(notificationId);
      
      // Check notification settings
      const settings = await this.getNotificationSettings(userId);
      
      if (!settings.enabled) {
        endTracking(false, notification.type || 'unknown', 'notifications-disabled');
        return { success: false, error: 'Notifications disabled for user' };
      }
      
      // Check quiet hours
      if (settings.quietHoursEnabled) {
        const isQuietHours = await this.isQuietHours(userId);
        if (isQuietHours) {
          endTracking(false, notification.type || 'unknown', 'quiet-hours');
          return { success: false, error: 'Quiet hours enabled for user' };
        }
      }

      // Get all subscriptions for the user
      const subscriptions = await this.getUserSubscriptions(userId);
      
      if (subscriptions.length === 0) {
        endTracking(false, notification.type || 'unknown', 'no-subscriptions');
        return { success: false, error: 'No push subscriptions found for user' };
      }

      // Send to all subscriptions
      const results = await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth
                }
              },
              JSON.stringify(notification)
            );
            
            // Update last_used_at timestamp
            await pool.query(
              `UPDATE push_notification_subscriptions 
               SET last_used_at = NOW() 
               WHERE id = $1`,
              [subscription.id]
            );
            
            return { success: true, subscriptionId: subscription.id };
          } catch (error) {
            // Handle expired subscriptions
            if (error.statusCode === 410) {
              await this.removeSubscription(subscription.id);
              return { 
                success: false, 
                subscriptionId: subscription.id, 
                error: 'Subscription expired', 
                removed: true 
              };
            }
            
            logger.error(`Error sending push notification to subscription ${subscription.id}:`, error);
            return { 
              success: false, 
              subscriptionId: subscription.id, 
              error: error.message || 'Unknown error' 
            };
          }
        })
      );

      // Calculate success rate
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      // End performance tracking
      const notificationType = notification.type || 'unknown';
      endTracking(
        successCount > 0, 
        notificationType,
        successCount > 0 ? null : 'all-subscriptions-failed'
      );
      
      // Store notification in database for history
      await this.storeNotification(userId, notification);

      return {
        success: successCount > 0,
        total: results.length,
        successCount,
        failureCount,
        results
      };
    } catch (error) {
      logger.error('Error sending push notification to user:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Send a push notification to a specific subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} - Result of the send operation
   */
  async sendPushNotificationBySubscriptionId(subscriptionId, notification) {
    if (!this.initialized) {
      logger.warn('Push notification service not initialized');
      return { success: false, error: 'Push notification service not initialized' };
    }

    try {
      // Generate a unique notification ID for tracking
      const notificationId = `subscription-${subscriptionId}-${Date.now()}`;
      
      // Start performance tracking
      const endTracking = NotificationPerformanceMonitor.startNotificationSend(notificationId);
      
      // Get subscription
      const subscription = await this.getSubscriptionById(subscriptionId);
      
      if (!subscription) {
        endTracking(false, notification.type || 'unknown', 'subscription-not-found');
        return { success: false, error: 'Subscription not found' };
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          JSON.stringify(notification)
        );
        
        // Update last_used_at timestamp
        await pool.query(
          `UPDATE push_notification_subscriptions 
           SET last_used_at = NOW() 
           WHERE id = $1`,
          [subscriptionId]
        );
        
        // End performance tracking
        endTracking(true, notification.type || 'unknown');
        
        // Store notification in database for history
        await this.storeNotification(subscription.user_id, notification);
        
        return { success: true };
      } catch (error) {
        // Handle expired subscriptions
        if (error.statusCode === 410) {
          await this.removeSubscription(subscriptionId);
          endTracking(false, notification.type || 'unknown', 'subscription-expired');
          return { success: false, error: 'Subscription expired', removed: true };
        }
        
        logger.error(`Error sending push notification to subscription ${subscriptionId}:`, error);
        endTracking(false, notification.type || 'unknown', error.statusCode ? `http-${error.statusCode}` : 'send-error');
        return { 
          success: false, 
          error: error.message || 'Unknown error' 
        };
      }
    } catch (error) {
      logger.error('Error sending push notification to subscription:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Send a broadcast notification to all users
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} - Result of the broadcast operation
   */
  async sendBroadcastNotification(notification) {
    if (!this.initialized) {
      logger.warn('Push notification service not initialized');
      return { success: false, error: 'Push notification service not initialized' };
    }

    try {
      // Generate a unique notification ID for tracking
      const broadcastId = `broadcast-${Date.now()}`;
      
      // Start performance tracking
      const endTracking = NotificationPerformanceMonitor.startNotificationSend(broadcastId);
      
      // Get all active subscriptions
      const result = await pool.query(
        `SELECT id, user_id, endpoint, p256dh, auth 
         FROM push_notification_subscriptions`
      );
      
      const subscriptions = result.rows;
      
      if (subscriptions.length === 0) {
        endTracking(false, notification.type || 'unknown', 'no-subscriptions');
        return { success: false, error: 'No push subscriptions found' };
      }

      // Send to all subscriptions
      const results = await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            // Check if user has notifications enabled
            const settings = await this.getNotificationSettings(subscription.user_id);
            
            if (!settings.enabled) {
              return { 
                success: false, 
                userId: subscription.user_id, 
                subscriptionId: subscription.id, 
                error: 'Notifications disabled for user' 
              };
            }
            
            // Check quiet hours
            if (settings.quietHoursEnabled) {
              const isQuietHours = await this.isQuietHours(subscription.user_id);
              if (isQuietHours) {
                return { 
                  success: false, 
                  userId: subscription.user_id, 
                  subscriptionId: subscription.id, 
                  error: 'Quiet hours enabled for user' 
                };
              }
            }
            
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth
                }
              },
              JSON.stringify(notification)
            );
            
            // Update last_used_at timestamp
            await pool.query(
              `UPDATE push_notification_subscriptions 
               SET last_used_at = NOW() 
               WHERE id = $1`,
              [subscription.id]
            );
            
            // Store notification in database for history
            await this.storeNotification(subscription.user_id, notification);
            
            return { 
              success: true, 
              userId: subscription.user_id, 
              subscriptionId: subscription.id 
            };
          } catch (error) {
            // Handle expired subscriptions
            if (error.statusCode === 410) {
              await this.removeSubscription(subscription.id);
              return { 
                success: false, 
                userId: subscription.user_id, 
                subscriptionId: subscription.id, 
                error: 'Subscription expired', 
                removed: true 
              };
            }
            
            return { 
              success: false, 
              userId: subscription.user_id, 
              subscriptionId: subscription.id, 
              error: error.message || 'Unknown error' 
            };
          }
        })
      );

      // Calculate success rate
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      // End performance tracking
      endTracking(
        successCount > 0, 
        notification.type || 'broadcast', 
        successCount > 0 ? null : 'all-subscriptions-failed'
      );

      return {
        success: successCount > 0,
        total: results.length,
        successCount,
        failureCount,
        results
      };
    } catch (error) {
      logger.error('Error sending broadcast notification:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Get notification performance metrics
   * @returns {Object} - Performance metrics
   */
  getPerformanceMetrics() {
    return NotificationPerformanceMonitor.getPerformanceMetrics();
  }
}

// Create and export singleton instance
const notificationService = new NotificationService();
module.exports = notificationService;
