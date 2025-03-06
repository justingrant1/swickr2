# Swickr Presence and Delivery Status Integration Guide

This guide explains how to integrate the real-time presence indicators and message delivery status features into your Swickr components.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Integrating Presence Indicators](#integrating-presence-indicators)
4. [Implementing Message Delivery Status](#implementing-message-delivery-status)
5. [Adding Typing Indicators](#adding-typing-indicators)
6. [Conversation Presence Tracking](#conversation-presence-tracking)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Overview

Swickr's real-time presence and delivery status features enhance the user experience by providing immediate feedback about message delivery and user availability. These features include:

- User presence indicators (online, away, busy, offline)
- Message delivery status (sending, sent, delivered, read)
- Typing indicators
- Conversation presence tracking

## Prerequisites

Before integrating these features, ensure you have:

1. Swickr client and server applications set up
2. Socket.io connection established
3. Authentication implemented

## Integrating Presence Indicators

### 1. Import the PresenceIndicator Component

```jsx
import PresenceIndicator from '../components/chat/PresenceIndicator';
```

### 2. Add to User Avatars or Contact List

```jsx
// In a contact list item
<ListItem>
  <ListItemAvatar>
    <Avatar src={contact.avatarUrl}>
      {contact.displayName[0]}
    </Avatar>
  </ListItemAvatar>
  <ListItemText 
    primary={contact.displayName} 
    secondary={contact.status} 
  />
  <PresenceIndicator 
    userId={contact.id}
    size="small"
    showTooltip={true}
  />
</ListItem>
```

### 3. Initialize Presence Service

In your app initialization:

```javascript
import presenceService from '../services/presenceService';

// After user authentication
presenceService.init();
```

### 4. Handle User Activity

To ensure accurate presence status, track user activity:

```javascript
// In your App component
useEffect(() => {
  const handleActivity = () => {
    presenceService.recordUserActivity();
  };
  
  // Track user activity events
  window.addEventListener('mousemove', handleActivity);
  window.addEventListener('keydown', handleActivity);
  window.addEventListener('click', handleActivity);
  
  return () => {
    window.removeEventListener('mousemove', handleActivity);
    window.removeEventListener('keydown', handleActivity);
    window.removeEventListener('click', handleActivity);
  };
}, []);
```

### 5. Manual Status Setting

Allow users to manually set their status:

```jsx
<Select
  value={currentStatus}
  onChange={(e) => {
    const newStatus = e.target.value;
    presenceService.setUserStatus(newStatus);
    setCurrentStatus(newStatus);
  }}
>
  <MenuItem value="online">Online</MenuItem>
  <MenuItem value="busy">Busy</MenuItem>
  <MenuItem value="away">Away</MenuItem>
  <MenuItem value="offline">Offline</MenuItem>
</Select>
```

## Implementing Message Delivery Status

### 1. Import the MessageStatus Component

```jsx
import MessageStatus from '../components/chat/MessageStatus';
```

### 2. Add to Message Bubbles

```jsx
// In your message component
<Box className="message-bubble">
  <Typography>{message.content}</Typography>
  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
    <Typography variant="caption" color="textSecondary">
      {formatTime(message.timestamp)}
    </Typography>
    {message.senderId === currentUserId && (
      <MessageStatus 
        messageId={message.id}
        isEncrypted={message.isEncrypted}
        size="small"
      />
    )}
  </Box>
</Box>
```

### 3. Handling Message Sending

When sending messages, use the following pattern to track delivery status:

```javascript
// When sending a message
const sendMessage = async (content) => {
  // Generate temporary ID
  const tempId = `temp_${Date.now()}`;
  
  // Add to local state with "sending" status
  const tempMessage = {
    id: tempId,
    content,
    senderId: currentUserId,
    conversationId,
    timestamp: new Date(),
    status: 'sending'
  };
  
  // Add to messages list
  setMessages(prev => [...prev, tempMessage]);
  
  // Mark as sending in presence service
  presenceService.markMessageAsSending(tempId);
  
  try {
    // Send via socket
    const result = await socketService.sendConversationMessage(
      conversationId,
      content
    );
    
    // Update with real message ID
    setMessages(prev => prev.map(msg => 
      msg.id === tempId ? { ...msg, id: result.messageId, status: 'sent' } : msg
    ));
  } catch (error) {
    // Mark as failed
    setMessages(prev => prev.map(msg => 
      msg.id === tempId ? { ...msg, status: 'failed' } : msg
    ));
    
    presenceService.markMessageAsFailed(tempId, error.message);
  }
};
```

### 4. Marking Messages as Read

When a conversation is opened or messages are viewed:

```javascript
// When opening a conversation
useEffect(() => {
  if (conversationId) {
    // Join conversation
    socketService.joinConversation(conversationId);
    
    // Mark as read
    presenceService.markConversationAsRead(conversationId);
    
    return () => {
      // Leave conversation
      socketService.leaveConversation(conversationId);
    };
  }
}, [conversationId]);
```

## Adding Typing Indicators

### 1. Import the TypingIndicator Component

```jsx
import TypingIndicator from '../components/chat/TypingIndicator';
```

### 2. Add to Conversation Interface

```jsx
// In your conversation component
<Box className="message-list">
  {messages.map(message => (
    <MessageItem key={message.id} message={message} />
  ))}
  
  {isUserTyping && (
    <TypingIndicator 
      isTyping={isUserTyping}
      username={typingUsername}
    />
  )}
</Box>
```

### 3. Track Typing Status

```javascript
// In your message input component
const [isTyping, setIsTyping] = useState(false);
const typingTimeoutRef = useRef(null);

const handleInputChange = (e) => {
  setNewMessage(e.target.value);
  
  // Set typing indicator
  if (!isTyping && e.target.value.trim() !== '') {
    setIsTyping(true);
    socketService.sendTypingIndicator(conversationId);
  }
  
  // If input is empty, stop typing indicator immediately
  if (e.target.value.trim() === '') {
    setIsTyping(false);
    socketService.sendTypingStoppedIndicator(conversationId);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }
  
  // Reset typing timeout
  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current);
  }
  
  typingTimeoutRef.current = setTimeout(() => {
    setIsTyping(false);
    socketService.sendTypingStoppedIndicator(conversationId);
  }, 2000);
};

// Clean up on unmount
useEffect(() => {
  return () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };
}, []);
```

### 4. Listen for Typing Events

```javascript
useEffect(() => {
  const handleTyping = (data) => {
    if (data.conversationId === conversationId) {
      setTypingUsers(prev => ({
        ...prev,
        [data.userId]: {
          isTyping: true,
          username: data.username
        }
      }));
    }
  };
  
  const handleTypingStopped = (data) => {
    if (data.conversationId === conversationId) {
      setTypingUsers(prev => ({
        ...prev,
        [data.userId]: {
          isTyping: false,
          username: prev[data.userId]?.username
        }
      }));
    }
  };
  
  socketService.on('typing', handleTyping);
  socketService.on('typing_stopped', handleTypingStopped);
  
  return () => {
    socketService.off('typing', handleTyping);
    socketService.off('typing_stopped', handleTypingStopped);
  };
}, [conversationId]);
```

## Conversation Presence Tracking

### 1. Join and Leave Conversations

```javascript
// When entering a conversation view
useEffect(() => {
  if (conversationId) {
    // Join the conversation
    socketService.joinConversation(conversationId);
    
    return () => {
      // Leave when component unmounts
      socketService.leaveConversation(conversationId);
    };
  }
}, [conversationId]);
```

### 2. Track Active Participants

```javascript
const [activeParticipants, setActiveParticipants] = useState([]);

useEffect(() => {
  const handleConversationPresence = (data) => {
    if (data.conversationId === conversationId) {
      setActiveParticipants(data.activeUsers || []);
    }
  };
  
  socketService.on('conversation_presence', handleConversationPresence);
  
  return () => {
    socketService.off('conversation_presence', handleConversationPresence);
  };
}, [conversationId]);
```

### 3. Display Active Participants

```jsx
<Typography variant="caption" color="textSecondary">
  {activeParticipants.length > 0 
    ? `${activeParticipants.length} active participant(s)` 
    : 'No active participants'}
</Typography>
```

## Best Practices

1. **Performance Optimization**:
   - Debounce typing events to reduce network traffic
   - Use memoization for presence components that appear in lists

2. **User Experience**:
   - Provide clear visual indicators for all states
   - Ensure color contrast meets accessibility standards
   - Add tooltips to explain status icons

3. **Error Handling**:
   - Gracefully handle disconnections
   - Provide retry mechanisms for failed messages
   - Show error states in the UI

4. **Security**:
   - Only share presence information with contacts
   - Allow users to control who sees their read receipts
   - Consider privacy implications of typing indicators

## Troubleshooting

### Common Issues

1. **Presence not updating**:
   - Check socket connection status
   - Verify user activity events are being triggered
   - Ensure presence service is initialized

2. **Message status stuck**:
   - Check for socket disconnections
   - Verify message IDs are consistent
   - Check server logs for errors

3. **Typing indicators not showing**:
   - Verify event listeners are properly set up
   - Check debounce timing
   - Ensure conversation IDs match

4. **Performance issues**:
   - Reduce unnecessary re-renders
   - Optimize socket event handling
   - Use virtualized lists for large conversations

For more detailed documentation, see the [Presence and Delivery Status Documentation](./presence-and-delivery.md).

---

## Example: Complete Conversation Component

For a complete implementation example, see the `ConversationWithPresence` component in:
`/client/src/components/chat/ConversationWithPresence.jsx`
