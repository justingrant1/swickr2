# Push Notification Integration Guide

This guide explains how to integrate push notifications into various parts of the Swickr application. It provides code examples and best practices for using the notification system effectively.

## Table of Contents

1. [Introduction](#introduction)
2. [Notification Types](#notification-types)
3. [Sending Notifications from the Server](#sending-notifications-from-the-server)
4. [Handling Notifications in the Client](#handling-notifications-in-the-client)
5. [Testing Notifications](#testing-notifications)
6. [Performance Considerations](#performance-considerations)
7. [Best Practices](#best-practices)

## Introduction

Swickr's push notification system allows you to send real-time alerts to users even when they're not actively using the application. The system is built on the Web Push API and uses service workers to handle notifications in the background.

## Notification Types

Swickr supports several notification types, each with a specific purpose:

| Type | Purpose | Example |
|------|---------|---------|
| `message` | New message notifications | "You have a new message from John" |
| `mention` | When a user is mentioned | "John mentioned you in a message" |
| `contact_request` | New contact requests | "You have a new contact request from Jane" |
| `status_update` | Contact status changes | "John is now online" |
| `system` | System announcements | "Swickr has been updated to version 2.0" |

## Sending Notifications from the Server

### Basic Notification

To send a basic notification to a user:

```javascript
const { NotificationService } = require('../services/NotificationService');

// Send a notification to a specific user
await NotificationService.sendNotification({
  userId: '123',
  type: 'message',
  title: 'New Message',
  body: 'You have a new message from John',
  data: {
    conversationId: '456',
    messageId: '789',
    senderId: 'abc'
  }
});
```

### Notification with Actions

To send a notification with action buttons:

```javascript
await NotificationService.sendNotification({
  userId: '123',
  type: 'message',
  title: 'New Message',
  body: 'You have a new message from John',
  actions: [
    {
      action: 'reply',
      title: 'Reply'
    },
    {
      action: 'mark-read',
      title: 'Mark as Read'
    }
  ],
  data: {
    conversationId: '456',
    messageId: '789',
    senderId: 'abc'
  }
});
```

### Broadcast Notification

To send a notification to all subscribed users:

```javascript
await NotificationService.sendBroadcastNotification({
  title: 'System Update',
  body: 'Swickr has been updated with new features',
  data: {
    url: '/announcements',
    type: 'system'
  }
});
```

### Checking Notification Settings

Before sending a notification, check if the user has enabled notifications for this type:

```javascript
const settings = await NotificationService.getNotificationSettings(userId);

if (settings.enabled && settings.newMessages) {
  // Send message notification
}
```

### Respecting Quiet Hours

Always respect the user's quiet hours settings:

```javascript
const settings = await NotificationService.getNotificationSettings(userId);
const isQuietHours = await NotificationService.isQuietHours(userId);

if (settings.enabled && settings.newMessages && !isQuietHours) {
  // Send message notification
}
```

## Handling Notifications in the Client

### Subscribing to Push Notifications

To subscribe a user to push notifications:

```javascript
import { 
  subscribeToPushNotifications, 
  requestNotificationPermission 
} from '../utils/pushNotificationUtils';

// In a component or context
const subscribeUser = async () => {
  // First, request permission
  const permission = await requestNotificationPermission();
  
  if (permission === 'granted') {
    // Get the VAPID public key from the server
    const response = await fetch('/api/notifications/vapid-public-key');
    const { vapidPublicKey } = await response.json();
    
    // Subscribe the user
    const subscription = await subscribeToPushNotifications(vapidPublicKey);
    
    if (subscription) {
      // Save the subscription on the server
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription })
      });
      
      return true;
    }
  }
  
  return false;
};
```

### Handling Notification Clicks

Handle notification clicks in your service worker:

```javascript
// In service-worker.js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = '/';
  
  // Determine the URL based on notification type
  switch (data.type) {
    case 'message':
      url = `/conversations/${data.conversationId}`;
      break;
    case 'contact_request':
      url = '/contacts/requests';
      break;
    // Handle other types...
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

### Displaying In-App Notifications

For a better user experience, display in-app notifications when the app is open:

```jsx
// In a React component
import { useEffect } from 'react';
import { Snackbar, Button } from '@mui/material';

const InAppNotification = () => {
  const [notification, setNotification] = useState(null);
  
  useEffect(() => {
    const handlePushNotification = (event) => {
      setNotification(event.detail);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    };
    
    // Listen for push notifications
    window.addEventListener('push-notification', handlePushNotification);
    
    return () => {
      window.removeEventListener('push-notification', handlePushNotification);
    };
  }, []);
  
  if (!notification) return null;
  
  return (
    <Snackbar
      open={!!notification}
      message={notification.body}
      action={
        <Button 
          color="secondary" 
          size="small"
          onClick={() => {
            // Navigate to the appropriate page
            // ...
            setNotification(null);
          }}
        >
          View
        </Button>
      }
    />
  );
};
```

## Testing Notifications

### Using the Test Page

The easiest way to test notifications is to use the built-in test page:

1. Navigate to Settings > Test Notifications
2. Fill out the form and click "Send Test Notification"

### Using the Test Scripts

For more advanced testing, use the provided scripts:

```bash
# Test a specific subscription
node server/src/scripts/test-push-notification.js <subscription-id>

# Send a broadcast notification
node server/src/scripts/send-broadcast-notification.js "Title" "Message"
```

## Performance Considerations

Push notifications can impact performance if not implemented carefully. Follow these guidelines:

1. **Batch Notifications**: If a user will receive multiple notifications at once, batch them together.
2. **Limit Payload Size**: Keep notification payloads small (< 4KB).
3. **Prioritize Important Notifications**: Don't send too many notifications or users will disable them.
4. **Use Low-Priority for Non-Urgent Notifications**: This helps preserve battery life.
5. **Handle Offline Mode**: Queue notifications when the device is offline.

## Best Practices

1. **Be Respectful**: Only send notifications that provide value to the user.
2. **Be Clear and Concise**: Keep notification titles and messages short and informative.
3. **Provide Context**: Include enough information for the user to understand the notification.
4. **Add Actions**: When appropriate, include action buttons to allow quick responses.
5. **Respect User Preferences**: Always honor notification settings and quiet hours.
6. **Handle Errors**: Implement proper error handling for failed notifications.
7. **Monitor Performance**: Track notification delivery rates and user engagement.
8. **Test Thoroughly**: Test notifications on different devices and browsers.

---

For more information, see the [Push Notifications Documentation](../PUSH_NOTIFICATIONS.md) and [Testing Guide](../TESTING_PUSH_NOTIFICATIONS.md).
