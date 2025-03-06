# Swickr Push Notifications

This document provides comprehensive information about the push notification system in Swickr, including architecture, implementation details, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation](#implementation)
4. [Performance Considerations](#performance-considerations)
5. [Security](#security)
6. [User Experience](#user-experience)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Overview

Swickr's push notification system allows users to receive real-time alerts about new messages, mentions, and other important events, even when the application is not actively open in their browser. The system is built on the Web Push API and is designed to be:

- **Fast**: Notifications are delivered in under 500ms (in line with Swickr's performance targets)
- **Reliable**: High delivery success rate with fallback mechanisms
- **User-friendly**: Respects user preferences and quiet hours
- **Secure**: End-to-end encrypted and privacy-focused
- **Efficient**: Optimized for battery life and network usage

## Architecture

### Components

The push notification system consists of the following components:

1. **Client-side**:
   - Service Worker: Handles background push events and displays notifications
   - Push Notification Utils: Manages subscriptions and permissions
   - Notification Settings UI: Allows users to configure preferences

2. **Server-side**:
   - Notification Service: Manages subscriptions and sends notifications
   - Database Tables: Stores subscriptions and user preferences
   - Performance Monitoring: Tracks notification metrics

3. **External Services**:
   - Web Push Protocol: Standard for delivering push messages
   - Push Services (e.g., FCM, Mozilla, etc.): Deliver notifications to devices

### Flow Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Swickr  │     │  Swickr  │     │   Push   │     │  User's  │
│  Client  │◄────┤  Server  │◄────┤ Service  │◄────┤ Browser  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
      │               │                                  │
      │  Subscribe    │                                  │
      │───────────────►                                  │
      │               │                                  │
      │               │  Store Subscription              │
      │               │◄─────────────────────────────────┤
      │               │                                  │
      │  New Message  │                                  │
      │◄──────────────┤                                  │
      │               │                                  │
      │               │  Send Notification               │
      │               │─────────────────────────────────►│
      │               │                                  │
      │  Display      │                                  │
      │  Notification │                                  │
      │◄─────────────────────────────────────────────────┤
      │               │                                  │
```

## Implementation

### Database Schema

The push notification system uses the following database tables:

1. **push_notification_subscriptions**:
   - `id`: Unique identifier
   - `user_id`: User the subscription belongs to
   - `endpoint`: Push service endpoint URL
   - `p256dh`: Public key for encryption
   - `auth`: Authentication secret
   - `user_agent`: Browser user agent
   - `created_at`: Creation timestamp
   - `last_used_at`: Last successful notification

2. **notification_settings**:
   - `user_id`: User ID
   - `enabled`: Master toggle for notifications
   - `new_messages`: Toggle for message notifications
   - `mentions`: Toggle for mention notifications
   - `contact_requests`: Toggle for contact request notifications
   - `quiet_hours_enabled`: Toggle for quiet hours
   - `quiet_hours_start`: Start time for quiet hours
   - `quiet_hours_end`: End time for quiet hours

3. **notifications**:
   - `id`: Unique identifier
   - `user_id`: Target user
   - `type`: Notification type (message, mention, etc.)
   - `title`: Notification title
   - `body`: Notification body
   - `data`: Additional JSON data
   - `created_at`: Creation timestamp
   - `read_at`: When the notification was read

### Client-Side Implementation

#### Service Worker

The service worker (`service-worker.js`) handles push events and displays notifications:

```javascript
// Listen for push events
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  // Display the notification
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-96x96.png',
      data: data.data || {},
      actions: data.actions || [],
      tag: data.tag || 'default',
      renotify: data.renotify || false,
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = '/';
  
  // Determine the URL based on notification type
  if (data.conversationId) {
    url = `/conversations/${data.conversationId}`;
  }
  
  // Open or focus the appropriate window
  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise, open a new window
        return self.clients.openWindow(url);
      })
  );
});
```

#### Push Notification Utils

The `pushNotificationUtils.js` file provides utility functions for managing push notifications:

```javascript
// Request notification permission
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  const result = await Notification.requestPermission();
  return result;
}

// Subscribe to push notifications
export async function subscribeToPushNotifications(vapidPublicKey) {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Get existing subscription or create a new one
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      return subscription;
    }
    
    // Convert VAPID key to Uint8Array
    const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
    
    // Create new subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey
    });
    
    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}
```

### Server-Side Implementation

#### Notification Service

The `NotificationService.js` file handles sending notifications and managing subscriptions:

```javascript
// Send a push notification to a user
async sendPushNotification(userId, notification) {
  // Start performance monitoring
  const notificationId = `${userId}-${Date.now()}`;
  const endTracking = startNotificationSend(notificationId);
  
  // Check notification settings
  const settings = await this.getNotificationSettings(userId);
  
  if (!settings.enabled) {
    endTracking(false, notification.type || 'unknown', 'notifications-disabled');
    return { success: false, error: 'Notifications disabled for user' };
  }
  
  // Check quiet hours
  if (settings.quietHoursEnabled) {
    const isQuietHours = await this.isQuietHours(userId);
    if (isQuietHours) {
      endTracking(false, notification.type || 'unknown', 'quiet-hours');
      return { success: false, error: 'Quiet hours enabled for user' };
    }
  }

  // Get all subscriptions for the user
  const subscriptions = await this.getUserSubscriptions(userId);

  // Send to all subscriptions
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify(notification)
        );
        return { success: true };
      } catch (error) {
        // Handle expired subscriptions
        if (error.statusCode === 410) {
          await this.removeSubscription(subscription.endpoint);
        }
        return { success: false, error: error.message };
      }
    })
  );

  // Calculate success rate
  const successCount = results.filter(r => r.success).length;
  
  // End performance tracking
  endTracking(successCount > 0, notification.type || 'unknown');

  return {
    success: successCount > 0,
    results
  };
}
```

## Performance Considerations

Swickr's push notification system is designed to meet our performance target of <500ms notification delivery. To achieve this:

1. **Efficient Database Queries**:
   - Indexed tables for fast subscription lookups
   - Batch operations for sending to multiple devices

2. **Optimized Payload Size**:
   - Keep notification payloads small (<4KB)
   - Only include essential data in the notification

3. **Performance Monitoring**:
   - Track notification send times
   - Monitor success rates
   - Alert on slow notifications (>500ms)

4. **Caching**:
   - Cache user notification settings
   - Cache active subscriptions

5. **Asynchronous Processing**:
   - Send notifications asynchronously
   - Use worker threads for high-volume notifications

## Security

Security is a top priority for Swickr's notification system:

1. **End-to-End Encryption**:
   - All notification payloads are encrypted
   - Uses the Web Push encryption standard

2. **Authentication**:
   - VAPID authentication for push services
   - JWT authentication for API endpoints

3. **Privacy**:
   - No sensitive data in notification payloads
   - Respect user notification preferences

4. **Subscription Management**:
   - Automatic cleanup of expired subscriptions
   - User can revoke subscriptions at any time

5. **Rate Limiting**:
   - Prevent notification spam
   - Limit the number of subscriptions per user

## User Experience

The notification system is designed to provide an excellent user experience:

1. **Customizable Preferences**:
   - Enable/disable specific notification types
   - Set quiet hours
   - Control notification sounds and vibration

2. **Intelligent Delivery**:
   - Respect user's quiet hours
   - Batch notifications to prevent overwhelming users
   - Prioritize important notifications

3. **Rich Notifications**:
   - Support for notification actions (reply, mark as read)
   - Include relevant context in notifications
   - Badge counts for unread items

4. **Cross-Device Sync**:
   - Mark notifications as read across all devices
   - Consistent notification history

## Testing

To test the push notification system, see the [TESTING_PUSH_NOTIFICATIONS.md](../TESTING_PUSH_NOTIFICATIONS.md) guide, which covers:

1. **Manual Testing**:
   - Using the notification test page
   - Testing with different browsers and devices

2. **Automated Testing**:
   - Unit tests for notification functions
   - Integration tests for the notification service
   - Performance tests for notification delivery

3. **Test Scripts**:
   - `test-push-notification.js`: Test individual subscriptions
   - `send-broadcast-notification.js`: Test broadcasting to all users

## Troubleshooting

Common issues and their solutions:

1. **Notifications Not Showing**:
   - Check browser permissions
   - Verify service worker registration
   - Confirm VAPID keys are correctly set
   - Check for console errors

2. **Slow Notifications**:
   - Check server performance
   - Reduce payload size
   - Verify network connectivity
   - Check push service status

3. **High Failure Rate**:
   - Clean up expired subscriptions
   - Check for invalid subscription data
   - Verify VAPID configuration
   - Monitor push service status

4. **Service Worker Issues**:
   - Update service worker code
   - Clear browser cache
   - Check for service worker errors
   - Verify scope configuration

---

For more information about implementing push notifications in specific parts of the application, see the [Push Notification Integration Guide](./push-notification-integration-guide.md).
