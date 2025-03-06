# Message Reactions

This document provides an overview of the message reactions feature in Swickr, including implementation details and usage guidelines.

## Overview

Message reactions allow users to express their feelings about a message without sending a new message. This feature enhances user engagement and provides a quick way to respond to messages.

## Features

- Add emoji reactions to messages
- Remove reactions from messages
- View all reactions for a message
- Real-time updates via WebSockets
- Reaction counts and user-specific reaction tracking

## Implementation

### Database Schema

Message reactions are stored in the `message_reactions` table with the following structure:

```sql
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(32) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);
```

Indexes are created for efficient querying:
```sql
CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX idx_message_reactions_emoji ON message_reactions(emoji);
```

### Server-Side Components

1. **MessageReaction Model** (`server/src/models/MessageReaction.js`)
   - Handles database operations for message reactions
   - Provides methods for adding, removing, and retrieving reactions

2. **Reactions Controller** (`server/src/api/reactions/controller.js`)
   - Handles HTTP requests for reaction operations
   - Validates input and permissions

3. **Reactions Routes** (`server/src/api/reactions/routes.js`)
   - Defines API endpoints for reaction operations

4. **WebSocket Integration** (`server/src/websocket/socket.js`)
   - Handles real-time reaction events
   - Broadcasts reaction updates to all participants in a conversation

### Client-Side Components

1. **ReactionService** (`client/src/services/reactionService.js`)
   - Provides methods for interacting with the reactions API
   - Handles API requests and error handling

2. **MessageReactions Component** (`client/src/components/messages/MessageReactions.jsx`)
   - Displays reactions for a message
   - Provides UI for adding and removing reactions
   - Updates in real-time via WebSockets

## API Endpoints

### Get Reactions for a Message

```
GET /api/reactions/message/:messageId
```

**Response:**
```json
{
  "reactions": [
    {
      "id": "uuid",
      "messageId": "uuid",
      "userId": "uuid",
      "username": "user1",
      "emoji": "👍",
      "timestamp": "2025-03-06T16:45:00Z"
    }
  ],
  "reactionCounts": [
    {
      "emoji": "👍",
      "count": 3
    },
    {
      "emoji": "❤️",
      "count": 2
    }
  ],
  "userReactions": ["👍", "❤️"]
}
```

### Add a Reaction

```
POST /api/reactions/message/:messageId
```

**Request Body:**
```json
{
  "emoji": "👍"
}
```

**Response:**
```json
{
  "id": "uuid",
  "messageId": "uuid",
  "userId": "uuid",
  "emoji": "👍",
  "timestamp": "2025-03-06T16:45:00Z"
}
```

### Remove a Reaction

```
DELETE /api/reactions/message/:messageId/:emoji
```

**Response:**
```json
{
  "success": true,
  "message": "Reaction removed successfully"
}
```

## WebSocket Events

### Add Reaction

**Client Emits:**
```javascript
socket.emit('message:reaction:add', {
  messageId: 'uuid',
  emoji: '👍'
});
```

**Server Broadcasts:**
```javascript
io.to(socketId).emit('message:reaction:add', {
  messageId: 'uuid',
  userId: 'uuid',
  username: 'user1',
  emoji: '👍',
  timestamp: new Date()
});
```

### Remove Reaction

**Client Emits:**
```javascript
socket.emit('message:reaction:remove', {
  messageId: 'uuid',
  emoji: '👍'
});
```

**Server Broadcasts:**
```javascript
io.to(socketId).emit('message:reaction:remove', {
  messageId: 'uuid',
  userId: 'uuid',
  username: 'user1',
  emoji: '👍',
  timestamp: new Date()
});
```

## Usage Examples

### React Component Usage

```jsx
// Basic usage
<MessageReactions messageId="message-uuid" />

// With initial data
const initialReactions = {
  reactions: [...],
  reactionCounts: [...],
  userReactions: [...]
};

<MessageReactions 
  messageId="message-uuid" 
  initialReactions={initialReactions} 
/>
```

### Service API Usage

```javascript
// Get reactions for a message
const reactions = await reactionService.getReactions('message-uuid');

// Add a reaction
await reactionService.addReaction('message-uuid', '👍');

// Remove a reaction
await reactionService.removeReaction('message-uuid', '👍');

// Get common emojis
const commonEmojis = reactionService.getCommonEmojis();
```

### WebSocket Integration

```javascript
// In your component
useEffect(() => {
  // Listen for reaction add events
  socket.on('message:reaction:add', (data) => {
    if (data.messageId === messageId) {
      // Update reactions state
      setReactions(prevReactions => [...prevReactions, data]);
    }
  });

  // Listen for reaction remove events
  socket.on('message:reaction:remove', (data) => {
    if (data.messageId === messageId) {
      // Update reactions state
      setReactions(prevReactions => 
        prevReactions.filter(r => 
          !(r.userId === data.userId && r.emoji === data.emoji)
        )
      );
    }
  });

  return () => {
    socket.off('message:reaction:add');
    socket.off('message:reaction:remove');
  };
}, [messageId, socket]);
```

## Standalone Demo

A standalone demo of the message reactions feature is available to showcase the functionality without requiring a full server setup. The demo demonstrates:

- Adding and removing reactions
- User-specific reaction highlighting
- Reaction counts
- Real-time updates
- Multiple user perspectives (by switching between users)

### Running the Demo

You can run the standalone demo by opening the `reactions-demo.html` file in your browser:

```bash
# From the project root
open reactions-demo.html
```

Alternatively, you can run the full demo with mock server integration:

```bash
# From the project root
node start-demo.js
```

This will start both the client and server with mock data, allowing you to test the full functionality of the message reactions feature.

### Demo Implementation

The standalone demo implements the core functionality of message reactions using vanilla JavaScript and CSS, demonstrating the key concepts without framework dependencies. Key implementation details include:

1. **User Switching**: The demo allows switching between different user perspectives to demonstrate how reactions appear for different users.

2. **Reaction Toggling**: Clicking on an existing reaction toggles it on/off for the current user.

3. **Emoji Picker**: Clicking on a message reveals an emoji picker with common emojis.

4. **Real-time Updates**: The demo simulates real-time updates by immediately reflecting changes in the UI.

5. **Reaction Grouping**: Reactions are grouped by emoji with counts to show how many users reacted with each emoji.

## UI/UX Guidelines

When implementing message reactions, follow these UI/UX guidelines to ensure a consistent experience:

1. **Accessibility**: Ensure reaction buttons are accessible with proper ARIA labels and keyboard navigation.

2. **Visual Feedback**: Provide immediate visual feedback when a user adds or removes a reaction.

3. **Performance**: Optimize rendering to handle messages with many reactions without performance degradation.

4. **Mobile Considerations**: Ensure touch targets are large enough (minimum 44×44 points) for mobile users.

5. **Brand Consistency**: Use Swickr's brand colors (primary: #6200ee, accent: #0284c7) for active states and highlights.

## Performance Considerations

1. **Batch Reaction Updates**: When loading a conversation, batch reaction requests to minimize network traffic.

2. **Debounce Reaction Requests**: Implement debouncing on the client side to prevent rapid-fire reaction requests.

3. **Optimize Queries**: When displaying reactions, optimize database queries to minimize load, especially for messages with many reactions.

4. **Handle Errors Gracefully**: Provide clear feedback when reactions fail to send or receive.

5. **Caching**: Implement client-side caching of reactions to reduce server load and improve performance.

6. **Virtualization**: For messages with many reactions, consider virtualizing the reaction display to improve performance.

## Future Enhancements

Potential future enhancements to the message reactions feature include:

1. **Custom Reactions**: Allow users to add custom emoji reactions beyond the predefined set.

2. **Reaction Analytics**: Provide analytics on most-used reactions for conversation insights.

3. **Reaction Notifications**: Allow users to configure notification preferences for reactions to their messages.

4. **Reaction Search**: Enable searching messages by reaction type.

5. **Reaction Permissions**: Add granular permissions for who can add reactions in group conversations.

## Troubleshooting

Common issues and their solutions:

1. **Reactions not appearing in real-time**: Verify WebSocket connection is established and event listeners are properly set up.

2. **Duplicate reactions**: Check that the unique constraint in the database is properly enforced.

3. **Performance issues with many reactions**: Implement pagination or virtualization for displaying large numbers of reactions.

4. **Emoji rendering inconsistencies**: Use a consistent emoji rendering library across platforms.

## References

- [Emoji Unicode Standard](https://unicode.org/emoji/charts/full-emoji-list.html)
- [WebSocket Documentation](https://socket.io/docs/v4/)
- [Material UI Components](https://mui.com/components/)
