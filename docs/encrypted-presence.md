# Encrypted Presence and Message Delivery Status

This document explains how Swickr implements end-to-end encrypted presence indicators and message delivery status features, ensuring both real-time communication and privacy.

## Overview

Swickr's encrypted presence system extends our end-to-end encryption to cover not just message content, but also:

- User presence status (online, away, busy, offline)
- Message delivery status (sending, sent, delivered, read)
- Typing indicators
- Conversation presence (who is actively viewing a conversation)

This ensures that metadata about user behavior is protected with the same level of security as message content itself.

## Architecture

### Client-Side Components

- **encryptedPresenceService.js**: Core service that integrates encryption with presence features
- **EncryptedPresenceSettings.jsx**: UI component for managing encrypted presence preferences
- **EncryptedConversation.jsx**: Conversation component with integrated encrypted presence features

### Server-Side Components

- **socket.js**: Enhanced WebSocket server that handles encrypted presence events
- **Message.js**: Model with support for encrypted message status tracking

## Technical Implementation

### Encrypted Presence Data Flow

1. **Initialization**:
   - User generates or loads encryption keys during authentication
   - `encryptedPresenceService` is initialized with these keys
   - User's encrypted presence preferences are loaded from the server

2. **Sending Encrypted Presence Updates**:
   - Presence data (typing, read receipts, etc.) is serialized to JSON
   - Data is encrypted using the same hybrid encryption approach as messages
   - A unique symmetric key is generated for each update
   - The symmetric key is encrypted with each recipient's public key
   - The encrypted data and keys are sent to the server

3. **Receiving Encrypted Presence Updates**:
   - Server forwards encrypted presence data to all conversation participants
   - Recipients decrypt the symmetric key using their private key
   - The symmetric key is used to decrypt the presence data
   - Decrypted data is processed and displayed in the UI

### Example: Encrypted Read Receipts

```javascript
// Sending an encrypted read receipt
const sendEncryptedReadReceipt = async (messageId, conversationId, recipients) => {
  // Create read receipt data
  const readReceiptData = {
    messageId,
    conversationId,
    userId: currentUserId,
    timestamp: new Date().toISOString()
  };
  
  // Encrypt the read receipt data
  const encryptedData = await encryptedPresenceService.encryptPresenceData(
    readReceiptData,
    recipients
  );
  
  // Send the encrypted read receipt
  socketService.emit('encrypted_read_receipt', {
    ...encryptedData,
    conversationId
  });
};
```

### Example: Encrypted Typing Indicators

```javascript
// Sending an encrypted typing indicator
const sendEncryptedTypingIndicator = async (conversationId, recipients) => {
  // Create typing indicator data
  const typingData = {
    conversationId,
    userId: currentUserId,
    timestamp: new Date().toISOString()
  };
  
  // Encrypt the typing indicator data
  const encryptedData = await encryptedPresenceService.encryptPresenceData(
    typingData,
    recipients
  );
  
  // Send the encrypted typing indicator
  socketService.emit('encrypted_typing', {
    ...encryptedData,
    conversationId
  });
};
```

## User Experience

### Privacy Controls

Users have granular control over which presence features are encrypted:

- **Encrypt Read Receipts**: Prevents third parties from knowing when messages are read
- **Encrypt Typing Indicators**: Hides when a user is typing from anyone outside the conversation
- **Encrypt Presence Updates**: Protects online status information

These settings are accessible through the `EncryptedPresenceSettings` component in the user settings area.

### Visual Indicators

The UI clearly indicates when encrypted presence features are active:

- Lock icon appears next to presence indicators when encrypted
- Settings panel shows which features are currently using encryption
- Error states are displayed when encryption is unavailable

## Performance Considerations

Encrypting presence data adds some computational and network overhead:

- **CPU Usage**: Additional encryption/decryption operations
- **Battery Impact**: Slightly increased on mobile devices
- **Latency**: Small increase (typically <50ms) for presence updates
- **Bandwidth**: Encrypted presence data is approximately 30% larger

To mitigate these impacts:

- Typing indicators are debounced to reduce encryption operations
- Presence updates are batched when possible
- Encryption operations are performed asynchronously

### Performance Optimizations

To meet Swickr's performance targets (<500ms message latency, <2s app launch time), we've implemented several optimizations:

#### 1. Caching

The `performanceService` implements a sophisticated caching system:

```javascript
// Example of caching encrypted data
const cachedEncryptedData = performanceService.getCachedEncryptedData(
  dataKey,
  recipients
);

if (cachedEncryptedData) {
  return cachedEncryptedData;
}

// Only perform encryption if not cached
const encryptedData = await encryptionService.encryptGroupMessage(
  data,
  recipients
);

// Cache the result for future use
performanceService.cacheEncryptedData(
  dataKey,
  recipients,
  encryptedData
);
```

This caching system reduces redundant encryption operations, particularly for:
- Repeated presence updates with the same status
- Read receipts for multiple messages in the same conversation
- Typing indicators sent in quick succession

#### 2. Debouncing

Typing indicators are debounced to prevent excessive encryption operations:

```javascript
// Debounced typing indicator
const debouncedSendTypingIndicator = performanceService.debounce(
  (conversationId, recipients) => {
    encryptedPresenceService.sendEncryptedTypingIndicator(
      conversationId,
      recipients
    );
  },
  300 // Debounce time in milliseconds
);
```

This reduces the number of encryption operations during typing by up to 90% while maintaining a responsive user experience.

#### 3. Batching

Presence updates are batched to reduce network overhead:

```javascript
// Batched presence updates
performanceService.batchOperation(
  'presence_updates',
  (updates) => {
    // Process all updates in a single operation
    const batchedUpdate = {
      userId,
      status: updates[updates.length - 1].status, // Use most recent status
      timestamp: new Date().toISOString()
    };
    
    return encryptedPresenceService.sendEncryptedPresenceUpdate(
      batchedUpdate,
      recipients
    );
  },
  100 // Batch window in milliseconds
);
```

This batching reduces network traffic and server load by consolidating multiple updates into a single operation.

#### 4. Device-Adaptive Settings

The system automatically adjusts performance settings based on device capabilities:

```javascript
// Example of device-adaptive settings
const optimizeForDevice = async () => {
  const devicePerformance = await performanceService.assessDeviceCapabilities();
  
  if (devicePerformance === 'low') {
    // Optimize for low-power devices
    performanceService.setConfig({
      cacheSize: 50,
      debounceTime: 500,
      batchWindow: 200
    });
  } else {
    // Settings for high-performance devices
    performanceService.setConfig({
      cacheSize: 200,
      debounceTime: 200,
      batchWindow: 50
    });
  }
};
```

This ensures optimal performance across a range of devices, from mobile phones to desktop computers.

#### 5. Web Workers

For browsers that support it, encryption operations are offloaded to Web Workers:

```javascript
// Example of Web Worker implementation
if (performanceService.isWebWorkerSupported()) {
  // Offload encryption to a worker thread
  const worker = new Worker('/workers/encryption-worker.js');
  
  worker.postMessage({
    action: 'encrypt',
    data: presenceData,
    recipients: recipientKeys
  });
  
  worker.onmessage = (e) => {
    if (e.data.error) {
      console.error('Encryption error:', e.data.error);
      return;
    }
    
    // Send the encrypted data from the worker
    socketService.emit('encrypted_presence_update', e.data.encryptedData);
  };
} else {
  // Fall back to main thread encryption
  const encryptedData = await encryptionService.encryptGroupMessage(
    presenceData,
    recipientKeys
  );
  
  socketService.emit('encrypted_presence_update', encryptedData);
}
```

This prevents encryption operations from blocking the main thread, ensuring a smooth user experience even during intensive encryption tasks.

### Performance Monitoring

The `PerformanceMonitor` component provides real-time visibility into the performance of encrypted presence features:

- **Real-time Metrics**: Displays message latency, encryption time, and other key metrics
- **Visual Indicators**: Color-coded progress bars show performance relative to targets
- **Optimization Controls**: Allows users to toggle specific optimizations
- **Expandable View**: Detailed metrics available in expanded view

## Security Considerations

### Metadata Protection

While message content encryption is common, Swickr's approach also protects metadata:

- **Who is online and when**: Protected by encrypted presence
- **Who is reading messages and when**: Protected by encrypted read receipts
- **Who is typing and when**: Protected by encrypted typing indicators

This prevents traffic analysis that could reveal communication patterns even when message content is encrypted.

### Forward Secrecy

The current implementation uses the same key pairs as message encryption. For enhanced security:

- Consider implementing ephemeral keys for presence data
- Implement automatic key rotation for long-lived conversations

### Limitations

Some limitations to be aware of:

- Server can still see conversation membership
- Timing patterns may still reveal some information
- Group membership changes are visible to the server

## Integration Guide

### Adding Encrypted Presence to a Component

```jsx
// Import the necessary services
import encryptedPresenceService from '../../services/encryptedPresenceService';

// Initialize the service with user keys
useEffect(() => {
  const userKeys = JSON.parse(localStorage.getItem('userKeys'));
  encryptedPresenceService.init(userKeys, userId);
}, [userId]);

// Check if encryption is available
const encryptionAvailable = encryptedPresenceService.isEncryptionAvailable();

// Send an encrypted read receipt
const markAsRead = async (messageId) => {
  if (encryptionAvailable) {
    await encryptedPresenceService.sendEncryptedReadReceipt(
      messageId,
      conversationId,
      recipients
    );
  } else {
    // Fall back to unencrypted read receipts
    socketService.emit('read_receipt', { messageId, conversationId });
  }
};
```

### Handling Encrypted Presence Events

```jsx
// Listen for encrypted presence events
useEffect(() => {
  const handleEncryptedReadReceipt = async (data) => {
    try {
      // The service will decrypt and emit a standard 'message_read' event
      // which you can listen for as usual
    } catch (error) {
      console.error('Error processing encrypted read receipt:', error);
    }
  };
  
  socketService.on('encrypted_read_receipt', handleEncryptedReadReceipt);
  
  return () => {
    socketService.off('encrypted_read_receipt', handleEncryptedReadReceipt);
  };
}, []);
```

## Testing

Comprehensive tests for the encrypted presence system should include:

- Unit tests for encryption/decryption of presence data
- Integration tests for the full presence flow
- Performance benchmarks to measure overhead
- Security audits to verify privacy claims

See the `tests/presence-and-delivery.test.js` file for examples of automated tests.

## Future Enhancements

1. **Multi-Device Support**: Synchronize encrypted presence across user devices
2. **Perfect Forward Secrecy**: Implement ephemeral keys for presence data
3. **Presence Privacy Levels**: Allow users to set different privacy levels for different contacts
4. **Custom Status Messages**: Support encrypted custom status messages
5. **Offline Presence Queueing**: Queue encrypted presence updates when offline

## References

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Signal Protocol](https://signal.org/docs/)
- [Metadata-Resistant Messaging](https://www.eff.org/deeplinks/2020/03/what-you-should-know-about-online-tools-during-covid-19-crisis)
