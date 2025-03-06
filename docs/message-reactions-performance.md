# Message Reactions Performance Optimization Guide

This document provides guidelines and best practices for optimizing the performance of the message reactions feature in Swickr, ensuring it meets our strict performance targets (<500ms message latency, <2s app launch time).

## Performance Targets

For the message reactions feature, we aim to achieve:

- Reaction add/remove latency: <100ms
- Reaction rendering time: <50ms for up to 100 reactions
- Memory usage: <5MB additional memory for reaction data
- Network payload: <1KB per reaction update

## Database Optimizations

### Indexing Strategy

The `message_reactions` table includes the following indexes to optimize query performance:

```sql
CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);
CREATE INDEX idx_message_reactions_emoji ON message_reactions(emoji);
```

For high-volume deployments, consider adding a composite index:

```sql
CREATE INDEX idx_message_reactions_message_user ON message_reactions(message_id, user_id);
```

### Query Optimization

1. **Limit Reaction Fetching**: When displaying reactions for a conversation, fetch reactions only for visible messages.

2. **Pagination**: For messages with many reactions (>50), implement pagination to limit the initial load.

3. **Selective Fields**: Only retrieve necessary fields when querying reactions:

```javascript
// Instead of SELECT *
const result = await client.query(
  `SELECT r.id, r.emoji, r.user_id, u.username, u.display_name
   FROM message_reactions r
   JOIN users u ON r.user_id = u.id
   WHERE r.message_id = $1
   ORDER BY r.timestamp ASC`,
  [messageId]
);
```

4. **Batch Operations**: When adding or removing multiple reactions, use batch operations:

```javascript
// Batch insert example
const values = reactions.map((r, i) => 
  `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`
).join(', ');

const params = reactions.flatMap(r => 
  [r.id, r.messageId, r.userId, r.emoji, r.timestamp]
);

await client.query(
  `INSERT INTO message_reactions (id, message_id, user_id, emoji, timestamp)
   VALUES ${values}
   ON CONFLICT DO NOTHING`,
  params
);
```

## API Batch Endpoints

To optimize performance for multiple reaction operations, we've implemented batch API endpoints:

### Adding Multiple Reactions

```javascript
// Client-side implementation
const addReactionsBatch = async (messageId, emojis) => {
  const startTime = performance.now();
  
  try {
    const response = await axios.post(
      `${API_URL}/api/reactions/message/${messageId}/batch`,
      { emojis },
      { withCredentials: true }
    );
    
    const endTime = performance.now();
    performanceService.trackBatchOperation('reaction.add', emojis.length, endTime - startTime);
    
    return response.data;
  } catch (error) {
    console.error('Error adding reactions batch:', error);
    throw error;
  }
};
```

### Removing Multiple Reactions

```javascript
// Client-side implementation
const removeReactionsBatch = async (messageId, emojis) => {
  const startTime = performance.now();
  
  try {
    const response = await axios.delete(
      `${API_URL}/api/reactions/message/${messageId}/batch`,
      { 
        data: { emojis },
        withCredentials: true 
      }
    );
    
    const endTime = performance.now();
    performanceService.trackBatchOperation('reaction.remove', emojis.length, endTime - startTime);
    
    return response.data;
  } catch (error) {
    console.error('Error removing reactions batch:', error);
    throw error;
  }
};
```

## Frontend Optimizations

### React Component Optimization

1. **Memoization**: Use React.memo and useMemo to prevent unnecessary re-renders:

```javascript
// Memoize the MessageReactions component
const MessageReactions = React.memo(({ messageId, initialReactions }) => {
  // Component implementation
});

// Memoize expensive calculations
const groupedReactions = useMemo(() => {
  return groupReactionsByEmoji(reactions);
}, [reactions]);
```

2. **Virtualization**: For messages with many reactions, use virtualization to render only visible items:

```javascript
import { FixedSizeGrid } from 'react-window';

// In your component
<FixedSizeGrid
  columnCount={Math.ceil(groupedReactions.length / rowCount)}
  columnWidth={44}
  height={120}
  rowCount={rowCount}
  rowHeight={44}
  width={300}
  itemData={groupedReactions}
>
  {ReactionCell}
</FixedSizeGrid>
```

3. **Lazy Loading**: Implement lazy loading for the emoji picker:

```javascript
const ReactionPicker = React.lazy(() => import('./ReactionPicker'));

// In your component
{showPicker && (
  <Suspense fallback={<div>Loading...</div>}>
    <ReactionPicker onSelectEmoji={handleAddReaction} />
  </Suspense>
)}
```

### State Management

1. **Normalized State**: Store reactions in a normalized format for efficient updates:

```javascript
// Instead of array of reaction objects
const [reactionsById, setReactionsById] = useState({});
const [reactionsByEmoji, setReactionsByEmoji] = useState({});

// Update a single reaction efficiently
setReactionsById(prev => ({
  ...prev,
  [newReaction.id]: newReaction
}));
```

2. **Optimistic Updates**: Implement optimistic updates to improve perceived performance:

```javascript
const handleAddReaction = async (emoji) => {
  // Generate temporary ID
  const tempId = `temp-${Date.now()}`;
  
  // Create optimistic reaction
  const optimisticReaction = {
    id: tempId,
    messageId,
    userId: currentUser.id,
    emoji,
    timestamp: new Date().toISOString(),
    pending: true
  };
  
  // Add to state immediately
  setReactions(prev => [...prev, optimisticReaction]);
  
  try {
    // Make API call
    const savedReaction = await reactionService.addReaction(messageId, emoji);
    
    // Replace optimistic reaction with saved one
    setReactions(prev => prev.map(r => 
      r.id === tempId ? savedReaction : r
    ));
  } catch (error) {
    // Remove optimistic reaction on error
    setReactions(prev => prev.filter(r => r.id !== tempId));
    // Show error
  }
};
```

### WebSocket Optimization

1. **Debouncing**: Debounce rapid reaction changes to reduce WebSocket traffic:

```javascript
const debouncedEmitReaction = useCallback(
  debounce((event, data) => {
    socket.emit(event, data);
  }, 100),
  [socket]
);
```

2. **Batching**: Batch multiple reaction updates into a single message:

```javascript
// On the client
const batchedReactions = [];

const addToBatch = (reaction) => {
  batchedReactions.push(reaction);
  
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      socket.emit('message:reactions:batch', { reactions: batchedReactions });
      batchedReactions.length = 0;
      batchTimeout = null;
    }, 100);
  }
};

// On the server
socket.on('message:reactions:batch', ({ reactions }) => {
  // Process batch of reactions
});
```

3. **Selective Broadcasting**: Only broadcast reaction updates to users who are actively viewing the relevant conversation:

```javascript
// On the server
const userRooms = new Map(); // Map of userId -> Set of roomIds

// When user opens a conversation
socket.on('conversation:join', ({ conversationId }) => {
  socket.join(`conversation:${conversationId}`);
  
  if (!userRooms.has(socket.userId)) {
    userRooms.set(socket.userId, new Set());
  }
  userRooms.get(socket.userId).add(conversationId);
});

// When broadcasting reaction updates
const broadcastReaction = (reaction) => {
  // Get conversation ID for the message
  const conversationId = getConversationIdForMessage(reaction.messageId);
  
  // Broadcast only to users in this conversation
  io.to(`conversation:${conversationId}`).emit('message:reaction:add', reaction);
};
```

## Advanced Performance Optimizations

### Container-Based Architecture

We've implemented a container-based architecture to better separate concerns and optimize performance:

```javascript
// MessageReactionsContainer handles:
// - Performance monitoring
// - Batch operations coordination
// - Error handling and retries
// - Socket event management
<MessageReactionsContainer messageId={message.id} />

// While MessageReactions focuses on:
// - UI rendering
// - User interactions
// - Optimistic updates
```

This separation allows for more efficient rendering cycles and better performance monitoring.

### Dynamic Batch Processing

The system dynamically adjusts batch processing based on current performance metrics:

```javascript
// Get optimal batch processing delay based on performance metrics
const getOptimalBatchDelay = () => {
  const metrics = performanceService.getMetrics();
  
  // Base delay of 250ms
  let delay = 250;
  
  // Adjust based on network conditions
  if (metrics.messageLatency > 150) {
    // Slower network - increase batch window to collect more operations
    delay = Math.min(500, metrics.messageLatency * 1.5);
  } else if (metrics.messageLatency < 50) {
    // Very fast network - can process batches more quickly
    delay = 100;
  }
  
  // Adjust based on current batch efficiency
  if (metrics.reactionBatchEfficiency > 0.8) {
    // If batching is already efficient, slightly increase delay to collect more
    delay += 50;
  } else if (metrics.reactionBatchEfficiency < 0.4) {
    // If batching is inefficient, reduce delay to process smaller batches
    delay = Math.max(50, delay - 100);
  }
  
  return delay;
};
```

### Comprehensive Performance Monitoring

We've enhanced the performance monitoring system to track batch operations metrics:

```javascript
// Track batch operation
performanceService.trackBatchOperation('reaction', 'add', emojis.length);

// Track batch processing time
performanceService.trackBatchProcessingTime('reaction', processingTime);

// Track batch success/failure
performanceService.trackBatchSuccess('reaction', true);

// Track optimistic update success/failure
performanceService.trackOptimisticUpdate(true);
```

These metrics are displayed in the PerformanceMonitor component, allowing developers to:

1. Monitor batch efficiency (target: >70%)
2. Track batch processing times (target: <200ms)
3. Analyze batch success rates (target: >95%)
4. Measure optimistic update times (target: <20ms)
5. View batch network payload sizes (target: <2KB)

### Enhanced Reaction Picker

The ReactionPicker component has been optimized for performance:

```javascript
// Track render time
useEffect(() => {
  const renderEndTime = performance.now();
  performanceService.trackRenderTime(
    'reactionPicker', 
    'picker', 
    renderEndTime - renderStartTime.current
  );
  
  // Reset for next render
  renderStartTime.current = performance.now();
}, []);
```

Features include:
- Emoji search with performance tracking
- Selection highlighting for user reactions
- Touch-optimized UI with 40×40px touch targets
- Instant visual feedback for all actions

### Configuration Options

The PerformanceMonitor component provides toggles for reaction performance features:

1. **Enable Reaction Batching**: Batch multiple reaction operations together to reduce network requests and improve performance.

2. **Enable Optimistic Updates**: Show reaction changes immediately in the UI before server confirmation.

These settings can be adjusted in real-time based on the specific deployment environment and user needs.

### Performance Metrics Dashboard

The enhanced PerformanceMonitor component now includes a dedicated section for message reactions metrics:

```javascript
<Card sx={{ mb: 2, bgcolor: theme.palette.background.paper }}>
  <CardContent>
    <Typography variant="h6">
      Message Reactions Performance
    </Typography>
    
    {/* Reaction metrics display */}
    <Grid container spacing={2}>
      {/* Add Latency */}
      <Grid item xs={12} sm={6} md={4}>
        <Paper elevation={1}>
          <Typography variant="subtitle2">
            Add Latency
          </Typography>
          <Typography variant="h6">
            {metrics.reactionAddLatency.toFixed(1)} ms
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={getProgressValue(metrics.reactionAddLatency, 100, 300)}
          />
          <Typography variant="caption">
            Target: &lt;100ms
          </Typography>
        </Paper>
      </Grid>
      
      {/* Additional metrics... */}
    </Grid>
    
    {/* Batch Operations Metrics */}
    <Typography variant="subtitle1">
      Batch Operations Metrics
    </Typography>
    <Grid container spacing={2}>
      {/* Batch Size */}
      <Grid item xs={12} sm={6} md={4}>
        <Paper elevation={1}>
          <Typography variant="subtitle2">
            Average Batch Size
          </Typography>
          <Typography variant="h6">
            {metrics.reactionBatchSize.toFixed(1)}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={Math.min(metrics.reactionBatchSize / 10 * 100, 100)}
          />
          <Typography variant="caption">
            Target: &gt;5 reactions/batch
          </Typography>
        </Paper>
      </Grid>
      
      {/* Additional batch metrics... */}
    </Grid>
  </CardContent>
</Card>
```

## Caching Strategy

1. **Client-Side Caching**: Implement a client-side cache for reactions:

```javascript
// Simple in-memory cache
const reactionsCache = new Map();

const getReactionsWithCache = async (messageId) => {
  // Check cache first
  if (reactionsCache.has(messageId)) {
    return reactionsCache.get(messageId);
  }
  
  // Fetch from API
  const reactions = await reactionService.getReactions(messageId);
  
  // Store in cache
  reactionsCache.set(messageId, reactions);
  
  return reactions;
};

// Invalidate cache when reactions change
const invalidateCache = (messageId) => {
  reactionsCache.delete(messageId);
};
```

2. **Redis Caching**: Implement server-side caching with Redis:

```javascript
// In the reactions controller
const getReactions = async (req, res) => {
  const { messageId } = req.params;
  
  // Try to get from cache
  const cachedReactions = await redisClient.get(`reactions:${messageId}`);
  if (cachedReactions) {
    return res.json(JSON.parse(cachedReactions));
  }
  
  // Fetch from database
  const reactions = await MessageReaction.getByMessageId(messageId);
  
  // Store in cache (expire after 1 hour)
  await redisClient.setex(
    `reactions:${messageId}`, 
    3600, 
    JSON.stringify(reactions)
  );
  
  res.json(reactions);
};
```

3. **Cache Invalidation**: Implement proper cache invalidation when reactions change:

```javascript
// When a reaction is added or removed
const invalidateReactionsCache = async (messageId) => {
  await redisClient.del(`reactions:${messageId}`);
};
```

## Network Optimization

1. **Payload Compression**: Compress WebSocket payloads for reaction updates:

```javascript
// On the server
io.use(require('socket.io-compression')());
```

2. **Minimal Payload**: Send only essential data in reaction updates:

```javascript
// Instead of sending the full reaction object
socket.emit('message:reaction:add', {
  id: reaction.id,
  messageId: reaction.messageId,
  userId: reaction.userId,
  emoji: reaction.emoji
  // Omit timestamp, username, etc. if not needed immediately
});
```

3. **Lazy Loading User Details**: Load user details for reactions only when needed:

```javascript
// Initial reaction data includes only counts
const reactionCounts = {
  '👍': 5,
  '❤️': 3
};

// Load user details on demand
const loadReactionUsers = async (messageId, emoji) => {
  const users = await reactionService.getReactionUsers(messageId, emoji);
  setReactionUsers(prev => ({
    ...prev,
    [`${messageId}:${emoji}`]: users
  }));
};
```

## Testing and Monitoring

### Performance Testing

1. **Load Testing**: Test reaction performance under load:

```javascript
// Example load test with k6
export default function() {
  const reactions = ['👍', '❤️', '😊', '👏', '🎉'];
  
  // Add random reactions
  for (let i = 0; i < 100; i++) {
    const messageId = `message-${Math.floor(Math.random() * 100)}`;
    const emoji = reactions[Math.floor(Math.random() * reactions.length)];
    
    http.post(`${BASE_URL}/api/reactions/message/${messageId}`, {
      emoji
    }, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
  }
}
```

2. **Rendering Performance**: Test reaction rendering performance:

```javascript
// Measure rendering time
console.time('reactions-render');
renderReactions(messageId, largeReactionsSet);
console.timeEnd('reactions-render');
```

### Performance Monitoring System

We've implemented a comprehensive performance monitoring system for message reactions:

1. **Key Metrics Tracked**:

   - **Reaction Add/Remove Latency**: Time taken to add or remove a reaction
   - **Render Time**: Time taken to render reactions UI components
   - **Network Payload Size**: Size of data transferred for reaction operations
   - **Cache Hit/Miss Ratio**: Effectiveness of the reaction caching system
   - **Optimistic Update Success Rate**: Success rate of optimistic UI updates
   - **Batch Processing Efficiency**: Performance gain from batch operations

2. **Implementation in PerformanceService**:

```javascript
// Track reaction add/remove latency
performanceService.trackReactionLatency('add', messageId, latencyMs);
performanceService.trackReactionLatency('remove', messageId, latencyMs);

// Track reaction render time
performanceService.trackRenderTime('reactions', messageId, renderTimeMs);

// Track network payload size
performanceService.trackNetworkPayload('reaction', payloadSizeBytes);

// Track cache metrics
performanceService.trackCacheMetric('reaction', messageId, isCacheHit);

// Track batch operation performance
performanceService.trackBatchOperation('reaction.add', batchSize, totalTimeMs);
```

3. **Real-time Monitoring Dashboard**:

```javascript
// PerformanceMonitor component displays real-time metrics
<PerformanceMonitor 
  category="reactions"
  metrics={[
    'latency.add',
    'latency.remove',
    'renderTime',
    'networkPayload',
    'cacheHitRate',
    'batchEfficiency'
  ]}
  refreshInterval={5000}
/>
```

4. **Performance Alerts**:

```javascript
// Set up alerts for performance degradation
performanceService.setAlert('reaction.latency.add', {
  threshold: 200, // ms
  condition: 'gt', // greater than
  actions: ['log', 'notify']
});
```

5. **Integration with Existing Services**:

The performance monitoring system integrates with:
- `reactionService` for tracking API calls and caching
- `MessageReactions` component for tracking UI rendering
- WebSocket handlers for tracking real-time updates

## Adaptive Optimizations

Implement adaptive optimizations based on device capabilities and network conditions:

```javascript
// Detect device capabilities
const isLowEndDevice = () => {
  return (
    navigator.deviceMemory < 4 || // Less than 4GB RAM
    navigator.hardwareConcurrency < 4 // Less than 4 cores
  );
};

// Adjust reaction display based on device capabilities
const getMaxVisibleReactions = () => {
  if (isLowEndDevice()) {
    return 10; // Show fewer reactions on low-end devices
  }
  return 50; // Show more on high-end devices
};

// Adjust update frequency based on network conditions
const getUpdateDebounceTime = () => {
  const connection = navigator.connection || {};
  
  if (connection.saveData) {
    return 500; // Longer debounce when data saver is enabled
  }
  
  if (connection.effectiveType === '4g') {
    return 100; // Short debounce on fast connections
  }
  
  return 300; // Default for slower connections
};
```

## Conclusion

By implementing these optimizations, the message reactions feature can meet Swickr's strict performance targets while providing a smooth and responsive user experience. Regular performance testing and monitoring should be conducted to ensure the feature continues to meet these targets as the application scales.

Remember that performance optimization is an ongoing process. Continuously measure, analyze, and improve the implementation based on real-world usage patterns and feedback.

## Implementation Best Practices

When implementing message reactions in your Swickr deployment, follow these best practices:

1. **Use the Container Pattern**: Always use MessageReactionsContainer instead of directly using MessageReactions to benefit from performance optimizations.

2. **Monitor Performance Metrics**: Regularly check the PerformanceMonitor to identify potential bottlenecks.

3. **Adjust Batch Settings**: Fine-tune batch processing delays based on your specific network conditions and usage patterns.

4. **Test with High Volumes**: Test the system with high volumes of reactions (100+) to ensure it scales appropriately.

5. **Consider Caching**: For read-heavy deployments, consider implementing additional caching layers.

6. **Optimize for Mobile**: Mobile networks may have higher latency; ensure optimistic updates provide a smooth experience.

7. **Track Error Rates**: Monitor batch operation success rates and implement appropriate retry strategies.
