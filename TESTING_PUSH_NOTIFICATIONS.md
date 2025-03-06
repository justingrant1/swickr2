# Testing Push Notifications in Swickr

This guide will help you test the push notification system in Swickr to ensure all components are working correctly.

## Prerequisites

Before testing push notifications, make sure you have:

1. Generated VAPID keys and added them to your `.env` file
2. Run the database migrations to create the necessary tables
3. Started both the server and client applications

## Testing Steps

### 1. Enable Push Notifications

1. Navigate to the Swickr application in your browser
2. Go to Settings > Notification Settings
3. Toggle "Enable Push Notifications" to ON
4. Accept the browser permission request when prompted

### 2. Test Notifications Using the Test Page

1. Navigate to Settings > Test Notifications (or click the "Test Push Notifications" button on the home page)
2. Use the form to send a test notification:
   - Enter a title (e.g., "Test Notification")
   - Enter a message body (e.g., "This is a test notification")
   - Select notification options (sound, vibration, etc.)
   - Click "Send Test Notification"
3. You should receive a notification even if the browser is in the background

### 3. Test Notifications Using the Server Script

You can also test notifications using the server-side script:

```bash
# From the server directory
cd server

# Test a specific subscription
node src/scripts/test-push-notification.js <subscription-id>

# Send a broadcast to all users
node src/scripts/send-broadcast-notification.js "Broadcast Title" "Broadcast Message"
```

### 4. Verify Background Notifications

To verify that notifications work when the browser is closed:

1. Enable notifications as described above
2. Close the browser completely
3. Use the server script to send a notification
4. You should receive a system notification

## Troubleshooting

### Notification Permission Denied

If you accidentally denied notification permissions:

1. Click the lock icon in your browser's address bar
2. Find "Notifications" in the site settings
3. Change the permission to "Allow"
4. Refresh the page and try again

### Notifications Not Working

If notifications aren't working:

1. Check the browser console for errors
2. Verify that your VAPID keys are correctly set in the `.env` file
3. Make sure the service worker is registered (check the Application tab in Chrome DevTools)
4. Verify that the subscription was saved in the database
5. Check that your browser supports the Web Push API

### Service Worker Issues

If the service worker isn't working:

1. Go to Chrome DevTools > Application > Service Workers
2. Check if the service worker is registered and active
3. Try clicking "Unregister" and then refresh the page
4. Check the console for any service worker errors

## Browser Compatibility

Push notifications are supported in:

- Chrome (desktop and Android)
- Firefox (desktop and Android)
- Edge (desktop)
- Opera (desktop and Android)
- Safari (macOS, requires specific setup)

iOS Safari does not currently support the Web Push API.

## Next Steps

After verifying that push notifications work correctly, you can:

1. Customize the notification appearance and behavior
2. Implement notification categories for different types of messages
3. Add actions to notifications (e.g., "Reply", "Mark as Read")
4. Implement notification grouping for multiple messages

For more detailed information, see the [Push Notifications Documentation](./PUSH_NOTIFICATIONS.md).
