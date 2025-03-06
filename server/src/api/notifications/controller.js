/**
 * Notification Controller
 * 
 * Handles API endpoints for notifications including:
 * - Getting user notifications
 * - Marking notifications as read
 * - Managing notification settings
 * - Push notification subscriptions
 */

const webpush = require('web-push');
const pool = require('../../db/pool');
const { NotificationService } = require('../../services/NotificationService');
const { authenticateToken } = require('../../middleware/auth');

// Configure web-push with VAPID keys from environment variables
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:support@swickr.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Get all notifications for the authenticated user
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT id, type, title, body, data, created_at, read
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * Mark a notification as read
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    
    const result = await pool.query(
      `UPDATE notifications
       SET read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    return res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

/**
 * Mark all notifications as read for the authenticated user
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    await pool.query(
      `UPDATE notifications
       SET read = true
       WHERE user_id = $1 AND read = false`,
      [userId]
    );
    
    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

/**
 * Delete a notification
 */
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;
    
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    return res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ error: 'Failed to delete notification' });
  }
};

/**
 * Get notification settings for the authenticated user
 */
const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await pool.query(
      `SELECT 
        enabled, 
        new_messages AS "newMessages", 
        mentions, 
        contact_requests AS "contactRequests", 
        status_updates AS "statusUpdates", 
        quiet_hours_enabled AS "quietHoursEnabled", 
        quiet_hours_start AS "quietHoursStart", 
        quiet_hours_end AS "quietHoursEnd"
       FROM notification_settings
       WHERE user_id = $1`,
      [userId]
    );
    
    // If no settings found, return defaults
    if (result.rowCount === 0) {
      const defaultSettings = {
        enabled: true,
        newMessages: true,
        mentions: true,
        contactRequests: true,
        statusUpdates: false,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      };
      
      // Create default settings in database
      await pool.query(
        `INSERT INTO notification_settings
         (user_id, enabled, new_messages, mentions, contact_requests, status_updates, 
          quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId, 
          defaultSettings.enabled, 
          defaultSettings.newMessages, 
          defaultSettings.mentions, 
          defaultSettings.contactRequests, 
          defaultSettings.statusUpdates, 
          defaultSettings.quietHoursEnabled, 
          defaultSettings.quietHoursStart, 
          defaultSettings.quietHoursEnd
        ]
      );
      
      return res.status(200).json(defaultSettings);
    }
    
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    return res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
};

/**
 * Update notification settings for the authenticated user
 */
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      enabled,
      newMessages,
      mentions,
      contactRequests,
      statusUpdates,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd
    } = req.body;
    
    // Validate settings
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid settings: enabled must be a boolean' });
    }
    
    const result = await pool.query(
      `UPDATE notification_settings
       SET 
        enabled = $2,
        new_messages = $3,
        mentions = $4,
        contact_requests = $5,
        status_updates = $6,
        quiet_hours_enabled = $7,
        quiet_hours_start = $8,
        quiet_hours_end = $9
       WHERE user_id = $1
       RETURNING *`,
      [
        userId, 
        enabled, 
        newMessages, 
        mentions, 
        contactRequests, 
        statusUpdates, 
        quietHoursEnabled, 
        quietHoursStart, 
        quietHoursEnd
      ]
    );
    
    // If no settings were updated, create them
    if (result.rowCount === 0) {
      await pool.query(
        `INSERT INTO notification_settings
         (user_id, enabled, new_messages, mentions, contact_requests, status_updates, 
          quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId, 
          enabled, 
          newMessages, 
          mentions, 
          contactRequests, 
          statusUpdates, 
          quietHoursEnabled, 
          quietHoursStart, 
          quietHoursEnd
        ]
      );
    }
    
    return res.status(200).json({ 
      message: 'Notification settings updated',
      settings: {
        enabled,
        newMessages,
        mentions,
        contactRequests,
        statusUpdates,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd
      }
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    return res.status(500).json({ error: 'Failed to update notification settings' });
  }
};

/**
 * Get VAPID public key for push notifications
 */
const getVapidPublicKey = (req, res) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY) {
      return res.status(500).json({ error: 'VAPID public key not configured' });
    }
    
    return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    return res.status(500).json({ error: 'Failed to get VAPID public key' });
  }
};

/**
 * Subscribe to push notifications
 */
const subscribeToPushNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscription, userAgent } = req.body;
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }
    
    // Check if subscription already exists
    const existingResult = await pool.query(
      `SELECT id FROM push_notification_subscriptions
       WHERE user_id = $1 AND endpoint = $2`,
      [userId, subscription.endpoint]
    );
    
    if (existingResult.rowCount > 0) {
      // Update existing subscription
      await pool.query(
        `UPDATE push_notification_subscriptions
         SET p256dh = $3, auth = $4, user_agent = $5, updated_at = NOW()
         WHERE user_id = $1 AND endpoint = $2`,
        [
          userId, 
          subscription.endpoint, 
          subscription.keys.p256dh, 
          subscription.keys.auth, 
          userAgent
        ]
      );
    } else {
      // Create new subscription
      await pool.query(
        `INSERT INTO push_notification_subscriptions
         (user_id, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId, 
          subscription.endpoint, 
          subscription.keys.p256dh, 
          subscription.keys.auth, 
          userAgent
        ]
      );
    }
    
    return res.status(200).json({ message: 'Successfully subscribed to push notifications' });
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return res.status(500).json({ error: 'Failed to subscribe to push notifications' });
  }
};

/**
 * Unsubscribe from push notifications
 */
const unsubscribeFromPushNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const endpoint = req.body.endpoint;
    
    // If endpoint is provided, delete specific subscription
    if (endpoint) {
      await pool.query(
        `DELETE FROM push_notification_subscriptions
         WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint]
      );
    } else {
      // Otherwise delete all subscriptions for this user
      await pool.query(
        `DELETE FROM push_notification_subscriptions
         WHERE user_id = $1`,
        [userId]
      );
    }
    
    return res.status(200).json({ message: 'Successfully unsubscribed from push notifications' });
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return res.status(500).json({ error: 'Failed to unsubscribe from push notifications' });
  }
};

/**
 * Test sending a push notification
 * (For development purposes only)
 */
const testPushNotification = async (req, res) => {
  // Only allow in development environment
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'This endpoint is only available in development mode' });
  }
  
  try {
    const userId = req.user.id;
    const { title, body } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }
    
    // Get user's push subscriptions
    const subscriptions = await NotificationService.getUserSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      return res.status(404).json({ error: 'No push subscriptions found for this user' });
    }
    
    // Send notification to all subscriptions
    const payload = JSON.stringify({
      title,
      body,
      icon: '/assets/icon-192x192.png',
      badge: '/assets/badge.png',
      data: {
        url: '/'
      }
    });
    
    const results = await Promise.allSettled(
      subscriptions.map(subscription => 
        webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        }, payload)
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return res.status(200).json({ 
      message: `Push notification sent to ${successful} devices, failed on ${failed} devices` 
    });
  } catch (error) {
    console.error('Error sending test push notification:', error);
    return res.status(500).json({ error: 'Failed to send test push notification' });
  }
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationSettings,
  updateNotificationSettings,
  getVapidPublicKey,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  testPushNotification
};
