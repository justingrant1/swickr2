# Swickr - Quick Messaging

Swickr is a high-performance, streamlined messaging service with a focus on speed and simplicity. Our primary value proposition is instant access to conversations with minimal friction.

## Project Overview

Swickr aims to provide a lightning-fast messaging experience at every interaction point, from login to message delivery.

### Core Brand Identity
- **Name**: Swickr
- **Tagline**: "quick messaging"
- **Brand Colors**: Purple (#6200ee) with blue accents (#0284c7)
- **Brand Values**: Speed, simplicity, reliability, privacy

## Technical Architecture

- **Frontend**: React-based web client with optimized bundle size
- **Backend**: Node.js with Express for API services
- **Real-time Communication**: WebSockets with Redis PubSub
- **Storage**: PostgreSQL + Redis for caching
- **Authentication**: JWT tokens with secure refresh mechanism

## Project Structure

```
swickr/
├── client/           # React frontend application
│   ├── public/       # Static assets
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── context/     # React context providers
│       ├── pages/       # Application pages
│       ├── services/    # API service clients
│       ├── theme/       # UI theme configuration
│       └── utils/       # Utility functions
├── server/           # Node.js backend services
│   ├── api/          # REST API endpoints
│   │   ├── auth/     # Authentication routes
│   │   ├── contacts/ # Contact management routes
│   │   ├── media/    # Media upload and retrieval routes
│   │   └── users/    # User management routes
│   ├── config/       # Configuration files
│   ├── middleware/   # Express middleware
│   ├── models/       # Database models
│   ├── websocket/    # WebSocket server for real-time messaging
│   └── utils/        # Utility functions
└── docs/             # Documentation
```

## Key Features

- Ultra-fast login process (under 1 second)
- Real-time message delivery with typing indicators
- End-to-end encryption
- Offline message queuing with automatic retry
- One-click shareable chat links
- QR code friend/group adding
- Dark mode support
- Media sharing with image preview and download
- Contact management with search functionality
- Message reactions with emoji support

## Push Notifications

Swickr provides a robust push notification system that keeps users informed about new messages, mentions, and other important events even when they're not actively using the application.

### Push Notification Features

- **Real-time Alerts**: Instant notifications for new messages, mentions, contact requests, and system updates
- **Customizable Preferences**: Fine-grained control over which notifications to receive
- **Quiet Hours**: Set specific times when notifications won't disturb you
- **Web Push API**: Leverages the Web Push API for delivering notifications even when the browser is closed
- **Service Worker Integration**: Background processing of notifications for improved performance
- **Notification History**: Access and manage your notification history
- **Multi-device Support**: Notifications sync across all your devices

### Notification Types

Swickr supports various notification types:

- **Message**: Notifications for new messages in conversations
- **Mention**: Alerts when you're mentioned in a message
- **Contact Request**: Notifications for new contact requests
- **Status Update**: Updates about contact status changes
- **System**: Important system announcements and updates

### Using Push Notifications

The notification system is integrated throughout the Swickr application:

```jsx
// Access notification context in components
const { 
  notifications, 
  unreadCount, 
  markAsRead, 
  enablePushNotifications 
} = useNotifications();

// Enable push notifications
await enablePushNotifications();

// Mark a notification as read
await markAsRead(notificationId);
```

### Notification Service API

The `NotificationService` provides a comprehensive API for handling notifications:

```javascript
// Send a notification to a user
await NotificationService.sendNotification({
  userId,
  type: 'message',
  title: 'New Message',
  body: 'You have a new message from John',
  data: {
    conversationId: '123',
    messageId: '456',
    senderId: '789'
  }
});

// Save a push subscription
await NotificationService.saveSubscription(userId, subscription);

// Get user notification settings
const settings = await NotificationService.getNotificationSettings(userId);

// Update notification settings
await NotificationService.updateNotificationSettings(userId, {
  enabled: true,
  newMessages: true,
  mentions: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00'
});
```

### Push Notification Setup

To set up push notifications:

1. Generate VAPID keys using the provided script:
```bash
node src/scripts/generate-vapid-keys.js
```

2. Add the generated keys to your `.env` file:
```
VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:your-email@example.com
```

3. Run database migrations to create the necessary tables:
```bash
npm run migrate
```

4. Enable push notifications in the application settings

For detailed information, see the [Push Notifications Documentation](./PUSH_NOTIFICATIONS.md).

## Push Notification Performance Monitoring

Swickr includes a comprehensive push notification performance monitoring system to ensure reliable and efficient notification delivery:

### Notification Performance Features

- **Real-time Metrics**: Track notification success rates, delivery times, and failure reasons
- **Client-side Tracking**: Monitor how users interact with notifications (received, displayed, clicked, closed)
- **Performance Dashboard**: Visualize notification performance with interactive charts and filters
- **Notification Types Analysis**: Compare performance across different notification types
- **Failure Analysis**: Identify and address common notification delivery issues
- **Performance Testing**: Built-in tools for testing notification performance

### Key Benefits

- **Improved Reliability**: Identify and fix notification delivery issues quickly
- **Enhanced User Experience**: Optimize notifications for better engagement
- **Performance Insights**: Make data-driven decisions about notification strategy
- **Reduced Latency**: Track and minimize notification delivery times
- **Higher Engagement**: Monitor and improve notification click-through rates

### Performance Metrics Tracked

- **Success Rate**: Percentage of notifications successfully delivered
- **Average Delivery Time**: Time taken to deliver notifications
- **Click-through Rate**: Percentage of notifications clicked by users
- **Dismissal Rate**: Percentage of notifications dismissed without interaction
- **Delivery Time Distribution**: Breakdown of notification delivery times
- **Hourly/Daily Performance**: Performance trends over time

### Using the Performance Dashboard

The notification performance dashboard provides a comprehensive view of notification metrics:

```jsx
// Access the dashboard component
<NotificationPerformanceDashboard />

// Use the performance summary component in other pages
<NotificationPerformanceSummary />
```

For detailed information, see the [Push Notification Performance](./docs/push-notification-performance.md) documentation and the [Notification Performance Guide](./docs/notification-performance-guide.md).

## Media Performance Optimizations

Swickr includes advanced media handling optimizations to provide a seamless messaging experience:

- **WebP Support**: Automatic conversion to WebP format for smaller file sizes and faster loading
- **Dynamic Thumbnails**: Optimized thumbnails generated on upload for instant previews
- **Intelligent Caching**: Multi-level caching system for media files and metadata
- **Performance Tracking**: Real-time monitoring of media upload and processing performance
- **Batch Processing**: Efficient handling of multiple media uploads in a single request
- **Progressive Loading**: Images load progressively for better perceived performance
- **Adaptive Quality**: Image quality adjusts based on network conditions and device capabilities

These optimizations result in:
- Up to 75% reduction in image file sizes
- 60% faster media loading times
- Reduced bandwidth usage for mobile users
- Improved battery life on mobile devices

For detailed information, see the [Media Performance Optimization](./docs/media-performance-optimization.md) documentation.

## Message Reactions

Swickr allows users to express themselves through message reactions, providing a quick and intuitive way to respond to messages without typing.

### Message Reaction Features

- **Emoji Reactions**: React to messages with a wide range of emojis
- **Real-time Updates**: Reactions appear instantly for all conversation participants
- **Toggle Functionality**: Click an emoji again to remove your reaction
- **Reaction Counts**: See how many users reacted with each emoji
- **Quick Reaction Panel**: Access commonly used emojis with a single click

### Using Message Reactions

The `MessageReactions` component provides an intuitive interface for adding and viewing reactions:

```jsx
// Display reactions for a message
<MessageReactions messageId={messageId} />

// Display reactions with initial data
<MessageReactions 
  messageId={messageId}
  initialReactions={initialReactionsData}
/>
```

### Reaction Service API

The `reactionService` provides a comprehensive API for handling message reactions:

```javascript
// Get all reactions for a message
const reactions = await reactionService.getReactions(messageId);

// Add a reaction to a message
await reactionService.addReaction(messageId, '👍');

// Remove a reaction from a message
await reactionService.removeReaction(messageId, '👍');

// Get common emoji reactions
const commonEmojis = reactionService.getCommonEmojis();
```

### Message Reactions Performance Optimizations

Message reactions are optimized for performance with the following features:

- **Batch Operations**: Multiple reactions are batched together to reduce network traffic and encryption overhead
- **Monitoring**: Real-time monitoring of reaction performance to ensure optimal delivery

## Media Sharing Features

Swickr provides robust media sharing capabilities, allowing users to share various types of media files in their conversations.

### Supported Media Types

- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Videos**: MP4, WebM, QuickTime
- **Audio**: MP3, WAV, OGG, WebM audio
- **Documents**: PDF, Word (DOC, DOCX), Excel (XLS, XLSX), PowerPoint (PPT, PPTX), Text files, CSV

### Media Upload Features

- **Single & Batch Uploads**: Upload individual files or multiple files at once
- **Progress Tracking**: Real-time upload progress with speed and time remaining estimates
- **Error Handling**: Comprehensive validation and error handling with actionable feedback
- **Metadata Extraction**: Automatic extraction of media metadata (dimensions, duration, etc.)
- **Captions**: Add optional captions to media files
- **Preview Generation**: Instant previews for uploaded media
- **File Size Limits**: Maximum file size of 100MB per file

### Using Media Uploads

The `MediaUploader` component provides a user-friendly interface for uploading media files:

```jsx
// Single file upload
<MediaUploader 
  conversationId={conversationId}
  onMediaUploaded={handleMediaUploaded}
/>

// Multiple file upload
<MediaUploader 
  conversationId={conversationId}
  onMediaUploaded={handleMediaUploaded}
  allowMultiple={true}
/>
```

### Media Service API

The `mediaService` provides a comprehensive API for handling media operations:

```javascript
// Upload a single file
const media = await mediaService.uploadMedia(file, conversationId, onProgress);

// Upload multiple files
const mediaItems = await mediaService.uploadMediaBatch(
  files, 
  conversationId, 
  onProgress, 
  onFileProgress, 
  onFileComplete
);

// Validate a file before upload
const validation = mediaService.validateFile(file);
if (!validation.valid) {
  console.error(validation.error);
}

// Generate a preview for a file
const previewUrl = await mediaService.generatePreview(file);

// Get media for a conversation
const media = await mediaService.getMediaForConversation(conversationId);
```

### Server-Side Media Handling

Media files are processed on the server with the following workflow:

1. **Validation**: Files are validated for type, size, and integrity
2. **Storage**: Files are stored in a structured directory system
3. **Metadata Extraction**: Additional metadata is extracted and stored
4. **Thumbnail Generation**: Thumbnails are generated for supported media types
5. **Database Recording**: Media information is recorded in the database
6. **Access Control**: Media access is restricted to conversation participants

For more details on implementation, see the [Media API Documentation](./docs/media-api.md).

## Performance Optimizations

Swickr is designed with performance as a core principle. We maintain strict performance targets:
- Message latency: < 500ms from send to receipt
- App launch time: < 2s on modern devices

### Encrypted Presence Features

Our encrypted presence features (typing indicators, read receipts, and online status) use the following optimizations to maintain performance while ensuring privacy:

#### Web Worker Implementation

Encryption operations are offloaded to a dedicated Web Worker thread to prevent UI blocking:

```javascript
// Example: Using the worker service for encryption
const encryptedData = await workerService.encryptWithWorker(
  messageContent,
  recipientKeys
);
```

Benefits:
- Keeps the UI responsive during heavy encryption tasks
- Allows parallel processing of multiple encryption operations
- Gracefully falls back to main thread when Web Workers aren't supported

#### Smart Caching

We implement an LRU (Least Recently Used) cache for encrypted presence data:

```javascript
// Example: Using the performance service for cached operations
const result = await performanceService.cacheOperation(
  cacheKey,
  async () => await expensiveOperation()
);
```

This reduces redundant encryption operations for frequently accessed data.

#### Batching and Debouncing

Multiple presence updates are batched together to reduce network traffic and encryption overhead:

```javascript
// Example: Batching multiple operations
await performanceService.batchOperation(
  'presenceUpdates',
  updateData,
  async (batch) => await processBatch(batch)
);
```

Typing indicators are debounced to prevent excessive updates during rapid typing.

#### Real-time Performance Monitoring

The `PerformanceMonitor` component provides real-time visibility into:
- Message latency
- Encryption time
- Cache hit rates
- Batch processing efficiency

Users can toggle specific optimizations based on their device capabilities and preferences.

#### Adaptive Settings

Performance settings automatically adjust based on device capabilities:
- Reduced batch sizes on low-end devices
- Increased cache limits on high-memory devices
- Adjusted debounce intervals based on network conditions

These optimizations ensure that Swickr's encrypted presence features maintain the application's performance targets while providing strong privacy guarantees.

## Performance Monitoring

Swickr includes a comprehensive performance monitoring system to ensure encrypted presence features maintain optimal performance:

```javascript
// Access the performance dashboard
import { PerformanceDashboard } from './components/performance';

// Example: Render the performance dashboard
<PerformanceDashboard />
```

The performance monitoring system includes:

1. **Performance Dashboard**: A central hub for all performance metrics with the following panels:
   - Overview panel for general performance metrics
   - Real-time metrics panel with time-series visualization
   - Encrypted presence panel for end-to-end encryption performance
   - Optimization comparison panel to evaluate different strategies
   - Worker, cache, batch, and network performance panels

2. **Real-time Metrics**: Live monitoring of key performance indicators:
   - Presence latency (target: <500ms)
   - Message latency
   - Updates per second
   - Cache hit rates
   - Worker utilization

3. **Optimization Strategies**: Compare different optimization approaches:
   - No optimization (baseline)
   - Cache-only optimization
   - Worker-only optimization
   - Batch-only optimization
   - Combined optimizations

4. **Performance Service API**:

```javascript
// Get general performance metrics
const metrics = performanceService.getMetrics();

// Get specific metrics for encrypted presence
const networkMetrics = performanceService.getNetworkMetrics();
const cacheMetrics = performanceService.getCacheMetrics();
const batchMetrics = performanceService.getBatchMetrics();
const workerMetrics = performanceService.getWorkerMetrics();

// Compare optimization strategies
const comparison = performanceService.getOptimizationComparison('latency');

// Get optimization recommendations
const recommendations = performanceService.getOptimizationRecommendations();

// Update performance configuration
performanceService.updateConfig({
  useWorker: true,
  useCache: true,
  useBatch: true,
  batchSize: 10,
  cacheSize: 100
);
```

## Performance Features

Swickr includes a comprehensive performance monitoring system that helps users track and optimize their messaging experience:

### Performance Monitor

The Performance Monitor provides real-time metrics on various aspects of the application:

- **Message Performance**: Tracks message delivery times, processing times, and queue lengths
- **Encryption Performance**: Monitors encryption and decryption times for secure messaging
- **Network Performance**: Measures connection quality, latency, and bandwidth usage
- **Media Performance**: Tracks upload times, processing times, and optimization metrics for media files

### Media Performance Optimization

Swickr includes advanced media performance features to enhance the user experience:

- **WebP Conversion**: Automatically converts images to WebP format for up to 75% smaller file sizes
- **Thumbnail Generation**: Creates optimized thumbnails for faster loading in message threads
- **Media Caching**: Stores frequently accessed media for improved performance
- **Batch Processing**: Efficiently handles multiple media files simultaneously
- **Media Performance Settings**: Allows users to configure media optimization parameters
- **Thumbnail Regeneration**: Provides tools to regenerate thumbnails with updated settings
- **Media Performance Metrics**: Displays detailed statistics on media handling performance
- **Media Optimization Tips**: Provides users with actionable guidance on optimizing their media usage

The Media Performance features can be accessed through the Performance Monitor interface, which includes:

1. **Media Performance Metrics Dashboard**: Real-time visualization of media performance data
2. **Media Performance Settings**: Advanced configuration options for media handling
3. **Media Optimization Tips**: Best practices and recommendations for optimal media performance

These features work together to provide Swickr users with a high-performance messaging experience, particularly when sharing media files in conversations.

## Features

### Core Features
- End-to-end encryption for messages and media
- Real-time messaging with typing indicators and read receipts
- User presence (online, away, offline status)
- Contact management
- Media sharing (images, documents, etc.)
- Group conversations
- Message search
- Push notifications
- Performance-optimized encrypted presence indicators and message delivery status
  - Debounced typing indicators to reduce encryption operations
  - Cached encryption operations for improved performance
  - Batched presence updates to reduce network traffic
  - Device-adaptive settings for optimal performance on different devices
  - Web Worker support for encryption operations on capable devices
- Performance-optimized message reactions with batch operations and monitoring

### In Progress
- End-to-end encrypted voice and video calls
- Self-destructing messages
- Offline mode with message queue
- Multi-device synchronization

## Implementation Status

### Completed Features
- Authentication system with JWT
- Real-time messaging with Socket.io
- Contact management with database integration
- Media sharing with image preview
- Responsive UI with dark mode support
- Database schema and models for users, contacts, and messages
- Real-time presence indicators (online, away, busy, offline)
- Message delivery status tracking (sending, sent, delivered, read)
- Typing indicators
- Conversation presence tracking
- Message reactions with emoji support and real-time updates
- Performance-optimized message reactions with batch operations and monitoring
- Push notifications with customizable settings and quiet hours

### In Progress
- Message persistence in database
- Conversation management
- End-to-end encryption integration with presence features

### Upcoming Features
- Offline message queuing
- Group chat functionality
- Message replies
- Custom status messages
- Read receipt privacy controls

## Getting Started

### Prerequisites
- Node.js (v14+)
- PostgreSQL (v12+)
- Redis (v6+)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/swickr.git
cd swickr
```

2. Install dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. Configure environment variables
```bash
# Server
cd ../server
cp .env.example .env
# Edit .env with your database credentials and JWT secret

# Client
cd ../client
cp .env.example .env
# Edit .env with your API URL
```

4. Start the development servers
```bash
# Start the server
cd ../server
npm run dev

# Start the client
cd ../client
npm start
```

### Running the Message Reactions Demo

To quickly test the message reactions feature without setting up the full environment, you can use our demo script:

```bash
# From the project root
node start-demo.js
```

This will:
1. Start the server with mock database support
2. Start the client application
3. Open the reactions demo page at http://localhost:3000/reactions-demo

In the demo, you can:
- View existing message reactions
- Add new reactions to messages
- Remove reactions by clicking them again
- Send new messages and react to them
- See real-time updates when reactions change

The demo uses mock data and simulated WebSocket connections to demonstrate the full functionality without requiring a database connection.

## Performance Targets

- Message send/receive latency: < 500ms
- App launch to message access: < 2 seconds
- Media upload time: < 2s for images up to 5MB
- Thumbnail generation: < 500ms per image
- Media loading time: < 1s for optimized images
- Smooth scrolling (60fps) even in long chat histories

## Contributing

Guidelines for contributing to the project will be added soon.

## License

MIT
