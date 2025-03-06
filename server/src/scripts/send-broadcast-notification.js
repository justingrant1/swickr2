/**
 * Broadcast Push Notification Script
 * 
 * This script sends a push notification to all subscribed users
 * Usage: node send-broadcast-notification.js "Notification Title" "Notification Body"
 */

require('dotenv').config();
const { NotificationService } = require('../services/NotificationService');

async function sendBroadcastNotification() {
  try {
    // Check if title and body were provided
    const title = process.argv[2];
    const body = process.argv[3];
    
    if (!title || !body) {
      console.error('Error: Title and body are required');
      console.log('Usage: node send-broadcast-notification.js "Notification Title" "Notification Body"');
      process.exit(1);
    }

    console.log('Sending broadcast notification to all subscribed users...');
    console.log(`Title: ${title}`);
    console.log(`Body: ${body}`);

    // Send the broadcast notification
    const result = await NotificationService.sendBroadcastNotification({
      title,
      body,
      icon: '/assets/icon-192x192.png',
      badge: '/assets/badge.png',
      data: {
        url: '/',
        timestamp: new Date().toISOString(),
        type: 'broadcast'
      }
    });

    console.log(`Notification sent to ${result.successCount} users successfully`);
    
    if (result.failureCount > 0) {
      console.warn(`Failed to send to ${result.failureCount} users`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error sending broadcast notification:', error);
    process.exit(1);
  }
}

// Execute the function
sendBroadcastNotification();
