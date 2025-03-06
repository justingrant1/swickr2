# Real-Time Presence and Message Delivery Status

This document outlines the implementation of real-time presence indicators and message delivery status features in Swickr.

## Table of Contents

1. [Overview](#overview)
2. [User Presence](#user-presence)
3. [Message Delivery Status](#message-delivery-status)
4. [Typing Indicators](#typing-indicators)
5. [Implementation Details](#implementation-details)
6. [Usage Guide](#usage-guide)
7. [Security Considerations](#security-considerations)

## Overview

Real-time presence and message delivery status indicators are essential features for modern messaging applications. They provide users with immediate feedback about the status of their messages and the availability of their contacts.

Swickr implements these features using Socket.io for real-time communication between clients and the server. The implementation includes:

- User presence indicators (online, away, busy, offline)
- Message delivery status (sending, sent, delivered, read)
- Typing indicators
- Conversation presence tracking

## User Presence

### Presence States

Swickr supports the following user presence states:

- **Online**: User is actively using the application
- **Away**: User has been inactive for a period of time (default: 10 minutes)
- **Busy**: User has manually set their status to busy (do not disturb)
- **Offline**: User is not connected to the application

### Automatic Presence Updates

The system automatically updates a user's presence based on their activity:

1. When a user connects, they are marked as "online"
2. After 10 minutes of inactivity, they are automatically marked as "away"
3. When a user disconnects, they are marked as "offline" after a 5-second grace period (to handle brief connection issues)

### Manual Presence Updates

Users can manually set their presence status through the UI. This overrides the automatic presence system until the next significant event (like a disconnect or extended inactivity).

## Message Delivery Status

### Delivery States

Swickr tracks the following message delivery states:

- **Sending**: Message is being sent to the server
- **Sent**: Server has received the message
- **Delivered**: Recipient's client has received the message
- **Read**: Recipient has viewed the message
- **Failed**: Message failed to send

### Delivery Flow

1. When a user sends a message, it is initially marked as "sending"
2. Once the server acknowledges receipt, it is marked as "sent"
3. When the recipient's client receives the message, it automatically sends a delivery receipt, and the message is marked as "delivered"
4. When the recipient views the conversation or specific message, a read receipt is sent, and the message is marked as "read"

### Read Receipts

Read receipts are sent in the following scenarios:

- When a user opens a conversation
- When a user scrolls to view previously unread messages
- When a user explicitly marks messages as read

## Typing Indicators

Typing indicators show when a user is actively composing a message. The implementation includes:

- Real-time typing status updates
- Automatic expiration of typing status after inactivity
- Typing indicator UI with animated dots

### Typing Flow

1. When a user begins typing, a "typing" event is sent to the server
2. The server broadcasts this event to all other participants in the conversation
3. When the user stops typing for 1.5 seconds, a "typing_stopped" event is sent
4. When a user sends a message, typing status is automatically cleared

## Implementation Details

### Client-Side Components

1. **presenceService.js**: Manages user presence states and message delivery status
2. **socketService.js**: Handles socket connection and real-time events
3. **PresenceIndicator.jsx**: UI component for displaying user presence
4. **MessageStatus.jsx**: UI component for displaying message delivery status
5. **TypingIndicator.jsx**: UI component for displaying typing indicators

### Server-Side Components

1. **socket.js**: Socket.io server implementation for handling real-time events
2. **User.js**: Model for storing and retrieving user presence information
3. **Message.js**: Model for storing and updating message delivery status

### Data Structures

The server maintains several in-memory data structures:

- `userSockets`: Map of userId to socketId
- `userPresence`: Map of userId to presence data (status, lastActive, device)
- `activeConversations`: Map of conversationId to set of active user IDs

### Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `status` | Client → Server | Update user status |
| `user_status` | Server → Client | Broadcast user status changes |
| `typing` | Client → Server | Indicate user is typing |
| `typing_stopped` | Client → Server | Indicate user stopped typing |
| `read_receipt` | Client → Server | Send read receipt for messages |
| `message_sent` | Server → Client | Confirm message was received by server |
| `message_delivered` | Server → Client | Confirm message was delivered to recipient |
| `join_conversation` | Client → Server | Join a conversation's presence tracking |
| `leave_conversation` | Client → Server | Leave a conversation's presence tracking |
| `user_activity` | Client → Server | Update user's last activity timestamp |

## Usage Guide

### Integrating Presence Indicators

```jsx
import PresenceIndicator from '../components/chat/PresenceIndicator';

// In your component
<PresenceIndicator 
  userId="user123"
  size="medium"
  showAvatar={true}
/>
```

### Displaying Message Status

```jsx
import MessageStatus from '../components/chat/MessageStatus';

// In your message component
<MessageStatus 
  messageId="msg123"
  isEncrypted={true}
  size="small"
/>
```

### Showing Typing Indicators

```jsx
import TypingIndicator from '../components/chat/TypingIndicator';

// In your conversation component
<TypingIndicator 
  isTyping={isUserTyping}
  username="John"
/>
```

### Initializing Services

```javascript
// In your app initialization
import presenceService from './services/presenceService';
import socketService from './services/socketService';

// Initialize socket connection
socketService.init(authToken);

// Initialize presence service
presenceService.init();
```

## Security Considerations

### Privacy

- User presence information is only shared with contacts
- Typing indicators are only shared within the current conversation
- Read receipts can be disabled in privacy settings (future implementation)

### Performance

- Presence updates are throttled to reduce server load
- Typing indicators have debounce mechanisms to prevent excessive updates
- Socket reconnection uses exponential backoff to prevent server overload

### Data Retention

- Presence data is stored in-memory and not persisted long-term
- Message delivery status is stored in the database for message history
- Typing indicators are ephemeral and not stored

---

## Future Enhancements

1. **Group Conversation Indicators**: Enhanced indicators for group conversations showing who has read messages
2. **Custom Status Messages**: Allow users to set custom status messages
3. **Scheduled Status**: Allow users to schedule status changes (e.g., automatically set to "busy" during meetings)
4. **Privacy Controls**: Give users fine-grained control over what presence information is shared
5. **Presence History**: Track and display patterns of availability for frequently contacted users
