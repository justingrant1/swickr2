/**
 * API endpoints for tracking client-side notification events
 */
const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../../middleware/auth');
const NotificationPerformanceMonitor = require('../../services/NotificationPerformanceMonitor');
const logger = require('../../utils/logger');

/**
 * Track a client-side notification event
 * 
 * This endpoint allows the client to report notification events like:
 * - received (notification was received by the client)
 * - clicked (user clicked/tapped the notification)
 * - closed (user dismissed the notification)
 * - displayed (notification was shown to the user)
 * 
 * @route POST /api/notifications/events
 * @param {string} notificationId - ID of the notification
 * @param {string} eventType - Type of event (received, clicked, closed, displayed)
 * @param {Object} data - Additional event data
 * @returns {Object} Success status
 */
router.post('/events', authenticateJWT, async (req, res) => {
  try {
    const { notificationId, eventType, data = {} } = req.body;
    const userId = req.user.id;
    
    if (!notificationId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: notificationId and eventType'
      });
    }
    
    // Validate event type
    const validEventTypes = ['received', 'clicked', 'closed', 'displayed'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid event type. Must be one of: ${validEventTypes.join(', ')}`
      });
    }
    
    // Record the client event
    await NotificationPerformanceMonitor.recordClientEvent(
      notificationId,
      userId,
      eventType,
      data
    );
    
    // Calculate and update metrics for this notification
    if (eventType === 'received') {
      // Calculate delivery time (time from send to receive)
      const sendTime = data.sendTime || null;
      if (sendTime) {
        const deliveryTime = Date.now() - sendTime;
        await NotificationPerformanceMonitor.updateDeliveryMetrics(notificationId, deliveryTime);
      }
    } else if (eventType === 'clicked') {
      // Calculate response time (time from receive to click)
      const receiveTime = data.receiveTime || null;
      if (receiveTime) {
        const responseTime = Date.now() - receiveTime;
        await NotificationPerformanceMonitor.updateResponseMetrics(notificationId, responseTime);
      }
    }
    
    logger.debug(`Tracked client notification event: ${eventType} for ${notificationId}`);
    
    return res.json({
      success: true,
      message: `Notification ${eventType} event recorded`
    });
  } catch (error) {
    logger.error('Error tracking notification client event:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to track notification event'
    });
  }
});

/**
 * Get client-side notification events for a user
 * 
 * @route GET /api/notifications/events
 * @param {number} limit - Maximum number of events to return (default: 50)
 * @returns {Object} List of notification events
 */
router.get('/events', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    
    // Get events for this user
    const events = await NotificationPerformanceMonitor.getClientEvents(userId, limit);
    
    return res.json({
      success: true,
      events
    });
  } catch (error) {
    logger.error('Error getting notification client events:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get notification events'
    });
  }
});

/**
 * Get notification interaction metrics for a user
 * 
 * @route GET /api/notifications/events/metrics
 * @returns {Object} Notification interaction metrics
 */
router.get('/events/metrics', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get metrics for this user
    const metrics = await NotificationPerformanceMonitor.getClientMetrics(userId);
    
    return res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Error getting notification client metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get notification metrics'
    });
  }
});

module.exports = router;
