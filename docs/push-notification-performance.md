# Push Notification Performance Monitoring

This document outlines the push notification performance monitoring system implemented in Swickr.

## Overview

The push notification performance monitoring system tracks and analyzes metrics related to push notification delivery, including:

- Success rates
- Delivery times
- Failure reasons
- Performance by notification type
- Client-side interaction metrics (received, clicked, closed)
- User engagement patterns

This data helps identify performance bottlenecks, track user engagement, and ensure reliable notification delivery.

## Key Components

### Server-Side Components

1. **NotificationPerformanceMonitor**
   - Located at: `server/src/services/NotificationPerformanceMonitor.js`
   - Tracks notification events and calculates performance metrics
   - Stores metrics in Redis for efficient retrieval and aggregation
   - Records client-side events for comprehensive performance analysis

2. **NotificationService**
   - Located at: `server/src/services/NotificationService.js`
   - Integrated with the performance monitor to track all notification sends
   - Records success/failure status and timing information
   - Provides methods for sending test notifications

3. **Performance API Endpoints**
   - Located at: `server/src/api/notifications/performance.js`
   - Provides endpoints for retrieving metrics and performance reports
   - Allows resetting metrics and tracking client-side notification events

4. **Client Events API**
   - Located at: `server/src/api/notifications/client-events.js`
   - Tracks client-side notification events (received, clicked, closed, displayed)
   - Calculates delivery and response times
   - Provides endpoints for retrieving client-side metrics

### Client-Side Components

1. **NotificationContext**
   - Located at: `client/src/context/NotificationContext.jsx`
   - Provides methods for tracking client-side notification events
   - Integrates with the performance API endpoints
   - Handles notification interaction tracking automatically

2. **NotificationPerformanceDashboard**
   - Located at: `client/src/pages/NotificationPerformanceDashboard.jsx`
   - Visualizes performance metrics in a user-friendly dashboard
   - Provides tools for analyzing notification performance
   - Includes interactive charts and filtering options

3. **NotificationPerformanceChart**
   - Located at: `client/src/components/notifications/NotificationPerformanceChart.jsx`
   - Visualizes notification performance metrics over time
   - Supports different time ranges (hourly, daily, weekly)
   - Displays trends in success rates and delivery times

4. **NotificationPerformanceWidget**
   - Located at: `client/src/components/notifications/NotificationPerformanceWidget.jsx`
   - Compact widget for embedding performance metrics in other components
   - Provides at-a-glance performance indicators

## Metrics Tracked

The system tracks the following metrics:

| Metric | Description |
|--------|-------------|
| Send Count | Total number of notifications sent |
| Success Count | Number of successfully delivered notifications |
| Failure Count | Number of failed notification attempts |
| Success Rate | Percentage of notifications successfully delivered |
| Average Duration | Average time to deliver a notification (ms) |
| Min Duration | Minimum notification delivery time (ms) |
| Max Duration | Maximum notification delivery time (ms) |
| Failure Reasons | Categorized reasons for notification failures |
| Send Times by Type | Performance metrics broken down by notification type |
| Hourly Stats | Performance metrics aggregated by hour |
| Daily Stats | Performance metrics aggregated by day |
| Delivery Time | Time between sending and client receiving the notification |
| Response Time | Time between client receiving and user interacting with notification |
| Click-through Rate | Percentage of notifications that were clicked by users |
| Dismissal Rate | Percentage of notifications that were dismissed without interaction |

## Client-Side Event Tracking

The system now tracks the following client-side events:

1. **Received**: When a notification is received by the client device
2. **Displayed**: When a notification is displayed to the user
3. **Clicked**: When a user clicks/taps on a notification
4. **Closed**: When a user dismisses a notification without interaction

These events provide valuable insights into user engagement and notification effectiveness.

## API Endpoints

### Get Performance Metrics

```
GET /api/notifications/performance
```

Returns current performance metrics.

### Get Recent Events

```
GET /api/notifications/performance/events
```

Returns recent notification events.

### Get Hourly Statistics

```
GET /api/notifications/performance/hourly
```

Returns performance metrics aggregated by hour.

### Get Daily Statistics

```
GET /api/notifications/performance/daily
```

Returns performance metrics aggregated by day.

### Reset Metrics

```
POST /api/notifications/performance/reset
```

Resets all performance metrics.

### Track Client Event

```
POST /api/notifications/client/events
```

Tracks a client-side notification event.

Parameters:
- `notificationId`: ID of the notification
- `eventType`: Type of event (received, clicked, closed, displayed)
- `data`: Additional event data

### Get Client Events

```
GET /api/notifications/client/events
```

Returns client-side notification events for the current user.

### Get Client Metrics

```
GET /api/notifications/client/events/metrics
```

Returns aggregated metrics for client-side notification events.

## Testing Performance

A test script is provided to evaluate notification performance:

```bash
node server/src/scripts/test-notification-performance.js [count] [delay]
```

Parameters:
- `count`: Number of notifications to send (default: 10)
- `delay`: Delay between notifications in ms (default: 500)

This script sends test notifications and reports detailed performance metrics.

You can also send a test notification directly from the dashboard by clicking the "Send Test Notification" button.

## Performance Dashboard

The notification performance dashboard provides a comprehensive view of notification metrics:

1. **Summary Cards**: At-a-glance metrics including total notifications, success rate, average time, and performance rating

2. **Performance Trends**: Interactive charts showing performance metrics over time with options for hourly, daily, and weekly views

3. **Notification Types**: Breakdown of performance by notification type

4. **Failure Reasons**: Analysis of common failure reasons

5. **Client Interaction**: Metrics on how users interact with notifications

To access the dashboard, navigate to Settings > Notification Performance.

## Best Practices

1. **Regular Monitoring**: Check the performance dashboard regularly to identify trends and issues.

2. **Performance Testing**: Run performance tests before major releases to ensure notification reliability.

3. **Failure Analysis**: Investigate common failure reasons to improve delivery rates.

4. **Optimize Payload Size**: Keep notification payloads small to improve delivery speed.

5. **Set Performance Targets**: Establish baseline metrics and set improvement targets.

6. **Monitor User Engagement**: Track client-side metrics to understand how users interact with notifications.

7. **A/B Testing**: Use the performance data to compare different notification strategies.

## Troubleshooting

### Common Issues

1. **High Failure Rate**
   - Check network connectivity
   - Verify VAPID keys are properly configured
   - Ensure user subscriptions are valid

2. **Slow Delivery Times**
   - Check server load
   - Optimize notification payload size
   - Verify Redis performance

3. **Missing Metrics**
   - Ensure Redis is running
   - Check for errors in the notification service logs
   - Verify API endpoints are accessible

4. **Low Click-through Rate**
   - Review notification content and relevance
   - Check timing of notifications
   - Ensure notifications are properly formatted

### Debugging

Enable debug logging to get more detailed information:

```javascript
// In server/src/config/logger.js
const logLevel = process.env.LOG_LEVEL || 'debug';
```

## Future Enhancements

Planned improvements to the performance monitoring system:

1. **Real-time Monitoring**: Implement WebSocket-based real-time updates for the dashboard.

2. **Advanced Analytics**: Add machine learning-based anomaly detection for notification patterns.

3. **User Segmentation**: Track performance metrics by user segments and demographics.

4. **Notification Throttling**: Automatically adjust notification rates based on performance metrics.

5. **A/B Testing Framework**: Implement a formal A/B testing framework for notification content and delivery strategies.

6. **Personalization Insights**: Use performance data to drive notification personalization.

7. **Predictive Delivery**: Optimize notification timing based on user engagement patterns.
