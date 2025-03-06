/**
 * Notification Test API
 * 
 * Endpoints for testing push notifications
 */

const express = require('express');
const router = express.Router();
const NotificationService = require('../../services/NotificationService');
const { authenticateJWT } = require('../../middleware/auth');
const logger = require('../../utils/logger');

/**
 * @route POST /api/notifications/test
 * @desc Send a test notification to the user
 * @access Private
 */
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title = 'Test Notification',
      body = 'This is a test notification from Swickr',
      type = 'message',
      userId: targetUserId,
      url = '/'
    } = req.body;
    
    // Create notification payload
    const notification = {
      title,
      body,
      type,
      data: {
        url,
        testNotification: true,
        timestamp: Date.now()
      }
    };
    
    // If targetUserId is provided and user is an admin, send to that user
    // Otherwise, send to the current user
    const recipientId = (targetUserId && req.user.isAdmin) ? targetUserId : userId;
    
    // Send the notification
    const result = await NotificationService.sendPushNotificationToUser(recipientId, notification);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Test notification sent successfully',
        notificationId: result.notificationId
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Failed to send test notification',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error sending test notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
