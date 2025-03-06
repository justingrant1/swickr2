# Swickr Push Notifications Setup Guide

This guide explains how to set up and test push notifications in the Swickr messaging application.

## Overview

Swickr uses the Web Push API to deliver real-time notifications to users. The implementation includes:

- Service worker for handling push events and displaying notifications
- Server-side components for managing subscriptions and sending notifications
- Client-side integration for subscribing to notifications

## Prerequisites

- Node.js 14+ and npm
- PostgreSQL database
- Web browser that supports Push API (Chrome, Firefox, Edge, etc.)
- HTTPS connection (required for Push API in production)

## Setup Instructions

### 1. Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for push notifications. Generate them using the provided script:

```bash
cd server
npm install web-push --save
node src/scripts/generate-vapid-keys.js
```

Add the generated keys to your `.env` file in the server directory:

```
VAPID_PUBLIC_KEY=your_generated_public_key
VAPID_PRIVATE_KEY=your_generated_private_key
VAPID_SUBJECT=mailto:support@swickr.com
```

### 2. Run Database Migrations

The push notification system requires several database tables. Apply the migration:

```bash
cd server
npm run migrate
```

This will create the following tables:
- `notifications` - Stores notification history
- `notification_settings` - Stores user notification preferences
- `push_notification_subscriptions` - Stores push subscription information

### 3. Verify Service Worker Registration

Ensure the service worker is properly registered in the client's `index.js` file:

```javascript
// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
```

## Testing Push Notifications

### 1. Enable Notifications in Browser

Users must grant permission for notifications. The application will prompt for this when a user enables notifications in settings.

### 2. Test Notification Endpoint

You can send a test notification to a user with:

```bash
curl -X POST http://localhost:5000/api/notifications/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title":"Test Notification","body":"This is a test notification","type":"system"}'
```

Or use the test button in the Notification Settings page.

## Notification Types

The system supports the following notification types:

- `message` - New message notifications
- `mention` - When a user is mentioned in a message
- `contact_request` - New contact requests
- `status_update` - Contact status changes
- `system` - System notifications

## User Preferences

Users can customize their notification experience through the Notification Settings page:

- Enable/disable all notifications
- Configure notification types (messages, mentions, etc.)
- Set quiet hours to prevent notifications during specific times

## Troubleshooting

### Notifications Not Appearing

1. Check browser console for errors
2. Verify notification permissions are granted
3. Ensure service worker is registered correctly
4. Check server logs for push notification errors

### Push Subscription Fails

1. Verify VAPID keys are correctly set in `.env`
2. Ensure you're using HTTPS in production
3. Check browser compatibility

## API Endpoints

The following API endpoints are available for notification management:

- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/unread-count` - Get unread notification count
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read
- `DELETE /api/notifications/:id` - Delete a notification
- `GET /api/notifications/settings` - Get notification settings
- `PUT /api/notifications/settings` - Update notification settings
- `GET /api/notifications/vapid-public-key` - Get VAPID public key
- `POST /api/notifications/subscribe` - Subscribe to push notifications
- `POST /api/notifications/unsubscribe` - Unsubscribe from push notifications
- `POST /api/notifications/test` - Send a test notification (development only)

## Security Considerations

- Push notification subscriptions are tied to user accounts
- All notification endpoints require authentication
- Sensitive data should not be included in notification payloads
- HTTPS is required for production use of Web Push API
