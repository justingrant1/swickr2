# Swickr WebSocket Integration Documentation

## Overview

This document provides comprehensive documentation for the WebSocket integration in Swickr, a high-performance messaging service focused on speed and simplicity. WebSockets enable real-time communication features including instant messaging, typing indicators, read receipts, and user status updates.

## Architecture

Swickr's WebSocket implementation uses Socket.IO on both the client and server sides:

- **Server**: Node.js with Express and Socket.IO
- **Client**: React with Socket.IO client
- **Authentication**: JWT-based authentication for secure WebSocket connections
- **Event System**: Bidirectional event-based communication

## Server-Side Implementation

### Socket Server Setup

The WebSocket server is initialized in `server/src/websocket/socket.js` and integrated with the Express server in `server/src/index.js`.

### Authentication Middleware

All WebSocket connections require authentication using JWT tokens:

```javascript
// Authentication middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error: Token not provided'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    socket.user = decoded;
    next();
  } catch (error) {
    return next(new Error('Authentication error: Invalid token'));
  }
});
```

### Connection Handling

When a user connects to the WebSocket server:

1. The user's status is updated to "online"
2. The user is added to a room with their user ID
3. The user's contacts are notified of their status change

### Event Handlers

The server handles the following events:

| Event | Description | Payload |
|-------|-------------|---------|
| `join-conversation` | User joins a conversation room | `{ conversationId }` |
| `leave-conversation` | User leaves a conversation room | `{ conversationId }` |
| `conversation-message` | User sends a message to a conversation | `{ conversationId, content, mediaId?, mediaType?, mediaUrl? }` |
| `typing` | User is typing in a conversation | `{ conversationId, isTyping }` |
| `read-receipt` | User has read a message | `{ messageId }` |
| `mark-conversation-read` | User has read all messages in a conversation | `{ conversationId }` |
| `status-update` | User updates their status | `{ status }` |
| `disconnect` | User disconnects from the WebSocket server | N/A |

## Client-Side Implementation

### Socket Service

The `socketService.js` file provides a clean API for WebSocket communication:

```javascript
// Connect to the WebSocket server
connect(token) { ... }

// Disconnect from the WebSocket server
disconnect() { ... }

// Join a conversation
joinConversation(conversationId) { ... }

// Leave a conversation
leaveConversation(conversationId) { ... }

// Send a message to a conversation
sendConversationMessage(conversationId, message) { ... }

// Send a typing indicator
sendTypingIndicator(conversationId, isTyping) { ... }

// Send a read receipt
sendReadReceipt(messageId) { ... }

// Mark a conversation as read
markConversationRead(conversationId) { ... }

// Update user status
updateUserStatus(status) { ... }
```

### Messaging Context

The `MessagingContext.js` file manages the state for conversations, messages, and WebSocket events:

1. Initializes the WebSocket connection when a user logs in
2. Sets up event listeners for incoming messages, typing indicators, read receipts, and user status updates
3. Updates the UI in real-time based on WebSocket events
4. Provides methods for sending messages, typing indicators, and read receipts

## Event Flow

### Sending a Message

1. User types a message and clicks send
2. Client calls `messageService.sendMessage()` to send the message via REST API
3. Server processes the message and saves it to the database
4. Server emits a `conversation-message` event to all users in the conversation
5. Clients receive the event and update their UI

### Typing Indicators

1. User starts typing in a conversation
2. Client emits a `typing` event with `isTyping: true`
3. Server broadcasts the event to all users in the conversation
4. Clients receive the event and show a typing indicator
5. When the user stops typing, client emits a `typing` event with `isTyping: false`
6. Server broadcasts the event and clients hide the typing indicator

### Read Receipts

1. User reads a message
2. Client emits a `read-receipt` event with the message ID
3. Server updates the message's read status in the database
4. Server broadcasts the event to all users in the conversation
5. Clients receive the event and update the message's read status in the UI

### User Status Updates

1. User logs in or changes their status
2. Client emits a `status-update` event with the new status
3. Server updates the user's status in the database
4. Server broadcasts the event to all of the user's contacts
5. Clients receive the event and update the user's status in the UI

## Performance Considerations

- **Connection Management**: Swickr automatically reconnects if the connection is lost
- **Offline Messages**: Messages sent while a user is offline are delivered when they reconnect
- **Throttling**: Message rate limiting to prevent abuse
- **Latency**: Target message latency is under 500ms
- **Scaling**: WebSocket connections can be distributed across multiple servers using Redis adapter

## Security Considerations

- **Authentication**: All WebSocket connections require a valid JWT token
- **Authorization**: Users can only join conversations they are participants in
- **Input Validation**: All incoming WebSocket events are validated
- **Rate Limiting**: Prevents abuse of the WebSocket API
- **Encryption**: WebSocket connections use TLS/SSL

## Error Handling

- **Connection Errors**: Automatically attempt to reconnect with exponential backoff
- **Authentication Errors**: Redirect to login page
- **Message Delivery Errors**: Retry with exponential backoff
- **Logging**: All errors are logged for debugging

## Testing

Two test scripts are provided to verify WebSocket functionality:

1. **Server-side test**: `server/src/scripts/testWebSocketIntegration.js`
2. **Client-side test**: `client/src/tests/websocketIntegration.test.js`

These tests verify:
- WebSocket connection and authentication
- Message sending and receiving
- Typing indicators
- Read receipts
- User status updates

## Debugging

To debug WebSocket issues:

1. Enable Socket.IO debug mode:
   ```javascript
   localStorage.debug = 'socket.io-client:*';
   ```

2. Check the browser console for Socket.IO debug messages
3. Check the server logs for Socket.IO debug messages
4. Use the Network tab in browser DevTools to inspect WebSocket frames

## API Reference

### Server Events (emitted by the server)

| Event | Payload | Description |
|-------|---------|-------------|
| `conversation-message` | `{ id, conversationId, senderId, content, createdAt, mediaId?, mediaType?, mediaUrl? }` | New message in a conversation |
| `typing` | `{ conversationId, userId, isTyping }` | User typing status |
| `read-receipt` | `{ messageId, userId, conversationId }` | Message read receipt |
| `user-status` | `{ userId, status, lastSeen }` | User status update |

### Client Events (emitted by the client)

| Event | Payload | Description |
|-------|---------|-------------|
| `join-conversation` | `{ conversationId }` | Join a conversation |
| `leave-conversation` | `{ conversationId }` | Leave a conversation |
| `conversation-message` | `{ conversationId, content, mediaId?, mediaType?, mediaUrl? }` | Send a message |
| `typing` | `{ conversationId, isTyping }` | Send typing status |
| `read-receipt` | `{ messageId }` | Send read receipt |
| `mark-conversation-read` | `{ conversationId }` | Mark conversation as read |
| `status-update` | `{ status }` | Update user status |

## Best Practices

1. **Always authenticate** before establishing a WebSocket connection
2. **Handle reconnection** gracefully
3. **Implement error handling** for all WebSocket operations
4. **Validate all data** before sending or processing
5. **Use typing debounce** to avoid sending too many typing events
6. **Optimize message delivery** for large conversations
7. **Implement offline support** for message queuing
8. **Test thoroughly** with different network conditions

## Troubleshooting

### Common Issues

1. **Connection fails**
   - Check if the token is valid
   - Verify the WebSocket server URL is correct
   - Check for CORS issues

2. **Messages not being received**
   - Verify the user has joined the conversation
   - Check if the WebSocket connection is established
   - Look for errors in the console

3. **High latency**
   - Check network conditions
   - Verify server performance
   - Reduce payload size

## Future Enhancements

1. **End-to-end encryption** for messages
2. **Message reactions** and replies
3. **Presence indicators** (away, busy, etc.)
4. **Message delivery status** (sent, delivered)
5. **Group typing indicators** (X users are typing...)
6. **Voice and video calls** integration
7. **File transfer progress** indicators
