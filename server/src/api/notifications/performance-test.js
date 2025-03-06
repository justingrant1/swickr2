/**
 * Notification Performance Test API
 * 
 * Endpoints for testing notification performance and tracking test progress
 */

const express = require('express');
const router = express.Router();
const NotificationService = require('../../services/NotificationService');
const NotificationPerformanceMonitor = require('../../services/NotificationPerformanceMonitor');
const { authenticateJWT } = require('../../middleware/auth');

// Test state (in-memory for simplicity, would use Redis or similar in production)
let testState = {
  running: false,
  total: 0,
  current: 0,
  success: 0,
  failed: 0,
  results: null,
  failureReasons: {}
};

/**
 * @route POST /api/notifications/performance/test
 * @desc Start a notification performance test
 * @access Private
 */
router.post('/test', authenticateJWT, async (req, res) => {
  try {
    const { count = 5, delay = 500, simulateClient = true } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (count < 1 || count > 100) {
      return res.status(400).json({ message: 'Count must be between 1 and 100' });
    }
    
    if (delay < 0 || delay > 5000) {
      return res.status(400).json({ message: 'Delay must be between 0 and 5000ms' });
    }
    
    // Check if a test is already running
    if (testState.running) {
      return res.status(409).json({ message: 'A test is already running' });
    }
    
    // Reset test state
    testState = {
      running: true,
      total: count,
      current: 0,
      success: 0,
      failed: 0,
      results: null,
      failureReasons: {}
    };
    
    // Start the test in the background
    runPerformanceTest(userId, count, delay, simulateClient);
    
    return res.status(200).json({ message: 'Performance test started', testId: Date.now() });
  } catch (error) {
    console.error('Error starting performance test:', error);
    return res.status(500).json({ message: 'Failed to start performance test' });
  }
});

/**
 * @route GET /api/notifications/performance/test/status
 * @desc Get the status of the current or last performance test
 * @access Private
 */
router.get('/test/status', authenticateJWT, (req, res) => {
  try {
    return res.status(200).json(testState);
  } catch (error) {
    console.error('Error getting test status:', error);
    return res.status(500).json({ message: 'Failed to get test status' });
  }
});

/**
 * Run a performance test by sending multiple notifications
 * @param {string} userId - User ID to send notifications to
 * @param {number} count - Number of notifications to send
 * @param {number} delay - Delay between notifications in ms
 * @param {boolean} simulateClient - Whether to simulate client-side events
 */
async function runPerformanceTest(userId, count, delay, simulateClient) {
  const startTime = Date.now();
  const durations = [];
  
  try {
    for (let i = 0; i < count; i++) {
      if (!testState.running) {
        // Test was cancelled
        break;
      }
      
      testState.current = i + 1;
      
      // Create a test notification
      const notification = {
        title: `Test Notification #${i + 1}`,
        body: `This is a test notification sent at ${new Date().toLocaleTimeString()}`,
        type: 'system',
        data: {
          testId: `test-${Date.now()}-${i}`,
          performanceTest: true
        }
      };
      
      try {
        // Send the notification and track performance
        const sendStart = Date.now();
        const result = await NotificationService.sendPushNotificationToUser(userId, notification);
        const sendDuration = Date.now() - sendStart;
        
        if (result.success) {
          testState.success++;
          durations.push(sendDuration);
          
          // Simulate client-side events if enabled
          if (simulateClient) {
            await simulateClientEvents(userId, notification.data.testId);
          }
        } else {
          testState.failed++;
          
          // Track failure reason
          const reason = result.error || 'Unknown error';
          testState.failureReasons[reason] = (testState.failureReasons[reason] || 0) + 1;
        }
      } catch (error) {
        testState.failed++;
        const reason = error.message || 'Unknown error';
        testState.failureReasons[reason] = (testState.failureReasons[reason] || 0) + 1;
      }
      
      // Add delay between notifications if specified
      if (delay > 0 && i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Calculate results
    const totalDuration = Date.now() - startTime;
    const successRate = (testState.success / count) * 100;
    
    let averageDuration = 0;
    let minDuration = 0;
    let maxDuration = 0;
    
    if (durations.length > 0) {
      averageDuration = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
      minDuration = Math.min(...durations);
      maxDuration = Math.max(...durations);
    }
    
    // Update test state with results
    testState.results = {
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      successRate,
      failureReasons: testState.failureReasons
    };
  } catch (error) {
    console.error('Error running performance test:', error);
  } finally {
    testState.running = false;
  }
}

/**
 * Simulate client-side notification events
 * @param {string} userId - User ID
 * @param {string} notificationId - Notification ID
 */
async function simulateClientEvents(userId, notificationId) {
  try {
    // Simulate received event (immediately)
    await NotificationPerformanceMonitor.trackClientEvent(userId, notificationId, 'received');
    
    // Simulate displayed event (after a short delay)
    setTimeout(async () => {
      await NotificationPerformanceMonitor.trackClientEvent(userId, notificationId, 'displayed');
    }, 500);
    
    // Simulate clicked event (50% chance)
    if (Math.random() > 0.5) {
      setTimeout(async () => {
        await NotificationPerformanceMonitor.trackClientEvent(userId, notificationId, 'clicked');
      }, 1500);
    } else {
      // Otherwise simulate closed event
      setTimeout(async () => {
        await NotificationPerformanceMonitor.trackClientEvent(userId, notificationId, 'closed');
      }, 3000);
    }
  } catch (error) {
    console.error('Error simulating client events:', error);
  }
}

module.exports = router;
