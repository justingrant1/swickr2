/**
 * Test Push Notification Script
 * 
 * This script sends a test push notification to a specific subscription
 * Usage: node test-push-notification.js <subscription-id>
 */

require('dotenv').config();
const { NotificationService } = require('../services/NotificationService');

async function sendTestNotification() {
  try {
    // Check if subscription ID was provided
    const subscriptionId = process.argv[2];
    if (!subscriptionId) {
      console.error('Error: Subscription ID is required');
      console.log('Usage: node test-push-notification.js <subscription-id>');
      process.exit(1);
    }

    console.log(`Sending test notification to subscription ${subscriptionId}...`);

    // Send the test notification
    const result = await NotificationService.sendPushNotificationBySubscriptionId(
      subscriptionId,
      {
        title: 'Test Notification',
        body: 'This is a test notification from Swickr',
        icon: '/assets/icon-192x192.png',
        badge: '/assets/badge.png',
        data: {
          url: '/notifications/test',
          timestamp: new Date().toISOString(),
          type: 'test'
        }
      }
    );

    console.log('Notification sent successfully:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error sending test notification:', error);
    process.exit(1);
  }
}

// Execute the function
sendTestNotification();
