/**
 * Notification Routes
 * 
 * API routes for notification management
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const notificationController = require('./controller');

// Apply authentication middleware to all notification routes
router.use(authenticateToken);

// Get all notifications for the authenticated user
router.get('/', notificationController.getNotifications);

// Mark a notification as read
router.put('/:id/read', notificationController.markNotificationAsRead);

// Mark all notifications as read
router.put('/read-all', notificationController.markAllNotificationsAsRead);

// Delete a notification
router.delete('/:id', notificationController.deleteNotification);

// Get notification settings
router.get('/settings', notificationController.getNotificationSettings);

// Update notification settings
router.put('/settings', notificationController.updateNotificationSettings);

// Get VAPID public key for push notifications
router.get('/vapid-public-key', notificationController.getVapidPublicKey);

// Subscribe to push notifications
router.post('/subscribe', notificationController.subscribeToPushNotifications);

// Unsubscribe from push notifications
router.post('/unsubscribe', notificationController.unsubscribeFromPushNotifications);

// Test push notification (development only)
router.post('/test-push', notificationController.testPushNotification);

module.exports = router;
