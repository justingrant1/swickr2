/**
 * Script to test push notification performance monitoring
 * 
 * This script sends a batch of test notifications and measures performance metrics
 * Run with: node test-notification-performance.js [count] [delay] [simulate-client]
 * 
 * Arguments:
 * - count: Number of notifications to send (default: 10)
 * - delay: Delay between notifications in ms (default: 500)
 * - simulate-client: Whether to simulate client-side events (default: false)
 */

require('dotenv').config();
const notificationService = require('../services/NotificationService');
const NotificationPerformanceMonitor = require('../services/NotificationPerformanceMonitor');
const logger = require('../utils/logger');
const { pool } = require('../config/database');
const axios = require('axios');

// Parse command line arguments
const args = process.argv.slice(2);
const count = parseInt(args[0]) || 10;
const delay = parseInt(args[1]) || 500;
const simulateClient = args[2] === 'true' || args[2] === 'simulate-client';

// API base URL for client event simulation
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * Get all users with push notification subscriptions
 */
async function getUsersWithSubscriptions() {
  try {
    const result = await pool.query(`
      SELECT DISTINCT user_id 
      FROM push_notification_subscriptions
    `);
    
    return result.rows.map(row => row.user_id);
  } catch (error) {
    logger.error('Error getting users with subscriptions:', error);
    return [];
  }
}

/**
 * Get API token for a user
 */
async function getUserApiToken(userId) {
  try {
    const result = await pool.query(`
      SELECT token FROM user_api_tokens 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId]);
    
    if (result.rows.length === 0) {
      // Create a test token if none exists
      const tokenResult = await pool.query(`
        INSERT INTO user_api_tokens (user_id, token, expires_at)
        VALUES ($1, $2, NOW() + INTERVAL '1 day')
        RETURNING token
      `, [userId, `test-token-${userId}-${Date.now()}`]);
      
      return tokenResult.rows[0].token;
    }
    
    return result.rows[0].token;
  } catch (error) {
    logger.error(`Error getting API token for user ${userId}:`, error);
    return null;
  }
}

/**
 * Send a test notification to a user
 */
async function sendTestNotification(userId, index) {
  try {
    const notificationId = `perf-test-${userId}-${Date.now()}`;
    
    // Start tracking performance
    const endTracking = NotificationPerformanceMonitor.startNotificationSend(notificationId);
    
    const result = await notificationService.sendPushNotificationToUser(
      userId,
      {
        title: `Performance Test #${index + 1}`,
        body: `Testing notification delivery performance (${index + 1}/${count})`,
        type: 'performance-test',
        data: {
          testId: notificationId,
          timestamp: Date.now(),
          testIndex: index
        }
      }
    );
    
    // End tracking with appropriate success/failure status
    endTracking(
      result.success, 
      'performance-test',
      result.success ? null : 'test-failure'
    );
    
    return {
      success: result.success,
      userId,
      notificationId,
      index
    };
  } catch (error) {
    logger.error(`Error sending test notification to user ${userId}:`, error);
    return {
      success: false,
      userId,
      error: error.message
    };
  }
}

/**
 * Simulate client-side notification events
 */
async function simulateClientEvents(result, userToken) {
  if (!result.success || !userToken) return;
  
  try {
    const notificationId = result.notificationId;
    const events = ['received', 'displayed', 'clicked', 'closed'];
    const headers = { Authorization: `Bearer ${userToken}` };
    
    // Simulate received event (immediately)
    await axios.post(`${API_BASE_URL}/api/notifications/client/events`, {
      notificationId,
      eventType: 'received',
      data: { timestamp: Date.now() }
    }, { headers });
    
    // Simulate displayed event (after 500ms)
    await sleep(500);
    await axios.post(`${API_BASE_URL}/api/notifications/client/events`, {
      notificationId,
      eventType: 'displayed',
      data: { timestamp: Date.now() }
    }, { headers });
    
    // Randomly decide if the notification will be clicked or closed
    const isClicked = Math.random() > 0.3; // 70% chance of clicking
    
    // Simulate user interaction (after 1-3 seconds)
    const interactionDelay = 1000 + Math.floor(Math.random() * 2000);
    await sleep(interactionDelay);
    
    await axios.post(`${API_BASE_URL}/api/notifications/client/events`, {
      notificationId,
      eventType: isClicked ? 'clicked' : 'closed',
      data: { 
        timestamp: Date.now(),
        interactionType: isClicked ? 'click' : 'dismiss'
      }
    }, { headers });
    
    logger.info(`Simulated client events for notification ${notificationId} (${isClicked ? 'clicked' : 'closed'})`);
    
    return {
      notificationId,
      events: isClicked ? ['received', 'displayed', 'clicked'] : ['received', 'displayed', 'closed'],
      interactionDelay
    };
  } catch (error) {
    logger.error(`Error simulating client events for notification ${result.notificationId}:`, error);
    return null;
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run the performance test
 */
async function runPerformanceTest() {
  logger.info(`Starting push notification performance test (${count} notifications, ${delay}ms delay, simulate client: ${simulateClient})`);
  
  // Get users with subscriptions
  const userIds = await getUsersWithSubscriptions();
  
  if (userIds.length === 0) {
    logger.error('No users with push subscriptions found');
    process.exit(1);
  }
  
  logger.info(`Found ${userIds.length} users with push subscriptions`);
  
  // Reset performance metrics before starting
  await NotificationPerformanceMonitor.resetMetrics();
  
  const results = [];
  const clientEvents = [];
  const startTime = Date.now();
  
  // Send notifications
  for (let i = 0; i < count; i++) {
    // Select a random user for each notification
    const randomIndex = Math.floor(Math.random() * userIds.length);
    const userId = userIds[randomIndex];
    
    logger.info(`Sending test notification ${i + 1}/${count} to user ${userId}`);
    
    const result = await sendTestNotification(userId, i);
    results.push(result);
    
    // Simulate client events if enabled
    if (simulateClient && result.success) {
      const userToken = await getUserApiToken(userId);
      if (userToken) {
        const clientEvent = await simulateClientEvents(result, userToken);
        if (clientEvent) {
          clientEvents.push(clientEvent);
        }
      }
    }
    
    // Wait for the specified delay before sending the next notification
    if (i < count - 1) {
      await sleep(delay);
    }
  }
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // Calculate success rate
  const successCount = results.filter(r => r.success).length;
  const successRate = (successCount / count) * 100;
  
  // Get performance metrics
  const metrics = await NotificationPerformanceMonitor.getPerformanceMetrics();
  
  // Print results
  logger.info('\n========== PERFORMANCE TEST RESULTS ==========');
  logger.info(`Total notifications sent: ${count}`);
  logger.info(`Successful: ${successCount} (${successRate.toFixed(2)}%)`);
  logger.info(`Failed: ${count - successCount}`);
  logger.info(`Total duration: ${totalDuration}ms`);
  logger.info(`Average time per notification: ${(totalDuration / count).toFixed(2)}ms`);
  
  if (simulateClient) {
    logger.info(`\nClient events simulated: ${clientEvents.length}`);
    logger.info(`Click rate: ${(clientEvents.filter(e => e.events.includes('clicked')).length / clientEvents.length * 100).toFixed(2)}%`);
    
    const avgInteractionDelay = clientEvents.reduce((sum, e) => sum + e.interactionDelay, 0) / clientEvents.length;
    logger.info(`Average interaction delay: ${avgInteractionDelay.toFixed(2)}ms`);
  }
  
  logger.info('\n========== PERFORMANCE METRICS ==========');
  logger.info(`Average send time: ${metrics.averageDuration.toFixed(2)}ms`);
  logger.info(`Success rate: ${metrics.successRate.toFixed(2)}%`);
  logger.info(`Min duration: ${metrics.minDuration}ms`);
  logger.info(`Max duration: ${metrics.maxDuration}ms`);
  
  if (metrics.failureReasons && Object.keys(metrics.failureReasons).length > 0) {
    logger.info('\nFailure reasons:');
    Object.entries(metrics.failureReasons).forEach(([reason, count]) => {
      logger.info(`  ${reason}: ${count}`);
    });
  }
  
  // Exit the process
  process.exit(0);
}

// Run the test
runPerformanceTest().catch(error => {
  logger.error('Error running performance test:', error);
  process.exit(1);
});
