const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationService = require('../services/NotificationService');
const { io } = require('../socket');
const logger = require('../utils/logger');
const clientEventsRouter = require('../api/notifications/client-events');
const performanceTestRouter = require('../api/notifications/performance-test');
const testRouter = require('../api/notifications/test');
const performanceRouter = require('../api/notifications/performance');

// Mount client-events router
router.use('/client', clientEventsRouter);

// Mount performance-test router
router.use('/performance-test', performanceTestRouter);

// Mount test router
router.use('/test', testRouter);

// Mount performance router (for metrics)
router.use('/performance', performanceRouter);

/**
 * @route   GET /api/notifications/vapid-public-key
 * @desc    Get VAPID public key for push notifications
 * @access  Private
 */
router.get('/vapid-public-key', auth, (req, res) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY) {
      return res.status(500).json({
        error: { message: 'Push notifications not configured on server' }
      });
    }
    
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  } catch (error) {
    logger.error('Error getting VAPID public key:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/notifications/subscribe
 * @desc    Subscribe to push notifications
 * @access  Private
 */
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ 
        error: { message: 'Invalid subscription object' } 
      });
    }
    
    const userAgent = req.headers['user-agent'];
    const result = await notificationService.saveSubscription(
      req.user.id, 
      subscription, 
      userAgent
    );
    
    res.json({ 
      success: true, 
      message: result.updated ? 'Subscription updated' : 'Subscription created',
      publicKey: process.env.VAPID_PUBLIC_KEY
    });
  } catch (error) {
    logger.error('Error subscribing to push notifications:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/notifications/unsubscribe
 * @desc    Unsubscribe from push notifications
 * @access  Private
 */
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ 
        error: { message: 'Endpoint is required' } 
      });
    }
    
    const result = await notificationService.deleteSubscription(req.user.id, endpoint);
    
    if (result) {
      res.json({ success: true, message: 'Subscription deleted' });
    } else {
      res.status(404).json({ error: { message: 'Subscription not found' } });
    }
  } catch (error) {
    logger.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/notifications/subscriptions
 * @desc    Get all push subscriptions for the user
 * @access  Private
 */
router.get('/subscriptions', auth, async (req, res) => {
  try {
    const subscriptions = await notificationService.getUserSubscriptions(req.user.id);
    res.json(subscriptions);
  } catch (error) {
    logger.error('Error getting push subscriptions:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/notifications/settings
 * @desc    Get notification settings for the user
 * @access  Private
 */
router.get('/settings', auth, async (req, res) => {
  try {
    const settings = await notificationService.getNotificationSettings(req.user.id);
    res.json(settings);
  } catch (error) {
    logger.error('Error getting notification settings:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   PUT /api/notifications/settings
 * @desc    Update notification settings for the user
 * @access  Private
 */
router.put('/settings', auth, async (req, res) => {
  try {
    const settings = req.body;
    const validSettings = [
      'enabled', 'newMessages', 'mentions', 'contactRequests', 'statusUpdates',
      'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd'
    ];
    
    // Filter out invalid settings
    const validatedSettings = {};
    for (const key of validSettings) {
      if (settings[key] !== undefined) {
        validatedSettings[key] = settings[key];
      }
    }
    
    if (Object.keys(validatedSettings).length === 0) {
      return res.status(400).json({ 
        error: { message: 'No valid settings provided' } 
      });
    }
    
    const updatedSettings = await notificationService.updateNotificationSettings(
      req.user.id, 
      validatedSettings
    );
    
    res.json(updatedSettings);
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/notifications
 * @desc    Get notifications for the user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { limit = 50, offset = 0, unreadOnly = false } = req.query;
    const options = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      unreadOnly: unreadOnly === 'true'
    };
    
    const notifications = await notificationService.getNotifications(
      req.user.id, 
      options
    );
    
    res.json(notifications);
  } catch (error) {
    logger.error('Error getting notifications:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (error) {
    logger.error('Error getting unread notification count:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    const success = await notificationService.markAsRead(
      notificationId,
      req.user.id
    );
    
    if (success) {
      // Emit socket event to update UI in real-time
      io.to(req.user.id).emit('notifications_updated', { 
        type: 'read', 
        ids: [notificationId]
      });
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: { message: 'Notification not found or already read' } });
    }
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', auth, async (req, res) => {
  try {
    const count = await notificationService.markAllAsRead(req.user.id);
    
    // Emit socket event to update UI in real-time
    io.to(req.user.id).emit('notifications_updated', { 
      type: 'read_all', 
      count 
    });
    
    res.json({ success: true, count });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    const success = await notificationService.deleteNotification(
      notificationId,
      req.user.id
    );
    
    if (success) {
      // Emit socket event to update UI in real-time
      io.to(req.user.id).emit('notifications_updated', { 
        type: 'delete', 
        ids: [notificationId]
      });
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: { message: 'Notification not found' } });
    }
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Send a test notification to the current user
 * @access  Private
 */
router.post('/test', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await notificationService.sendTestNotification(userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test notification sent successfully',
        notificationId: result.notificationId
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send test notification'
      });
    }
  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;
