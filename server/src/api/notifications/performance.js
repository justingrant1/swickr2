/**
 * Notification Performance API
 * 
 * Endpoints for monitoring push notification performance
 */

const express = require('express');
const router = express.Router();
const notificationService = require('../../services/NotificationService');
const NotificationPerformanceMonitor = require('../../services/NotificationPerformanceMonitor');
const { authenticate } = require('../../middleware/auth');
const { isAdmin } = require('../../middleware/roles');
const logger = require('../../utils/logger');

/**
 * @route GET /api/notifications/performance
 * @desc Get notification performance metrics
 * @access Admin only
 */
router.get('/performance', authenticate, isAdmin, async (req, res) => {
  try {
    const metrics = await NotificationPerformanceMonitor.getPerformanceMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    logger.error('Error getting notification performance metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to get performance metrics' });
  }
});

/**
 * @route GET /api/notifications/performance/report
 * @desc Get detailed notification performance report for a specific time period
 * @access Admin only
 */
router.get('/performance/report', authenticate, isAdmin, async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    
    // Convert string timestamps to numbers
    const start = startTime ? parseInt(startTime) : 0;
    const end = endTime ? parseInt(endTime) : Date.now();
    
    const report = await NotificationPerformanceMonitor.getPerformanceReport(start, end);
    res.json({ success: true, report });
  } catch (error) {
    logger.error('Error getting notification performance report:', error);
    res.status(500).json({ success: false, error: 'Failed to get performance report' });
  }
});

/**
 * @route POST /api/notifications/performance/reset
 * @desc Reset notification performance metrics
 * @access Admin only
 */
router.post('/performance/reset', authenticate, isAdmin, async (req, res) => {
  try {
    const success = await NotificationPerformanceMonitor.resetMetrics();
    res.json({ success });
  } catch (error) {
    logger.error('Error resetting notification performance metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to reset performance metrics' });
  }
});

/**
 * @route GET /api/notifications/performance/events
 * @desc Get recent notification events
 * @access Admin only
 */
router.get('/performance/events', authenticate, isAdmin, async (req, res) => {
  try {
    const { limit } = req.query;
    const events = await NotificationPerformanceMonitor.getRecentEvents(parseInt(limit) || 100);
    res.json({ success: true, events });
  } catch (error) {
    logger.error('Error getting notification events:', error);
    res.status(500).json({ success: false, error: 'Failed to get notification events' });
  }
});

/**
 * @route GET /api/notifications/performance/hourly
 * @desc Get hourly notification statistics
 * @access Admin only
 */
router.get('/performance/hourly', authenticate, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 24 hours if not specified
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);
    
    const stats = await NotificationPerformanceMonitor.getHourlyStats(start, end);
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error getting hourly notification stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get hourly stats' });
  }
});

/**
 * @route GET /api/notifications/performance/daily
 * @desc Get daily notification statistics
 * @access Admin only
 */
router.get('/performance/daily', authenticate, isAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to last 30 days if not specified
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);
    
    const stats = await NotificationPerformanceMonitor.getDailyStats(start, end);
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error getting daily notification stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get daily stats' });
  }
});

/**
 * @route POST /api/notifications/track
 * @desc Track client-side notification event
 * @access Authenticated
 */
router.post('/track', authenticate, async (req, res) => {
  try {
    const { event, data, timestamp } = req.body;
    
    // Add user ID to the event data
    const eventData = {
      ...data,
      userId: req.user.id,
      event,
      timestamp: timestamp || Date.now()
    };
    
    // Record the event
    await NotificationPerformanceMonitor.recordNotificationEvent(eventData);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error tracking notification event:', error);
    res.status(500).json({ success: false, error: 'Failed to track notification event' });
  }
});

/**
 * @route POST /api/notifications/test-performance
 * @desc Send a test notification and measure performance
 * @access Authenticated
 */
router.post('/test-performance', authenticate, async (req, res) => {
  try {
    const { title, body, timestamp } = req.body;
    
    // Create a unique ID for this test
    const testId = `test-${req.user.id}-${Date.now()}`;
    
    // Start tracking performance
    const endTracking = NotificationPerformanceMonitor.startNotificationSend(testId);
    
    // Send the notification
    const result = await notificationService.sendPushNotificationToUser(
      req.user.id,
      {
        title: title || 'Performance Test',
        body: body || 'Testing notification delivery performance',
        data: {
          testId,
          timestamp: timestamp || Date.now()
        }
      }
    );
    
    // End tracking
    endTracking(result.success, 'test', result.success ? null : 'test-failure');
    
    res.json({
      success: result.success,
      testId,
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('Error testing notification performance:', error);
    res.status(500).json({ success: false, error: 'Failed to test notification performance' });
  }
});

module.exports = router;
