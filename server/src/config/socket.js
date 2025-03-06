const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Store active connections
const activeConnections = new Map();

// Initialize Socket.IO server
const initSocketServer = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: '*', // In production, restrict this to your frontend domain
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      logger.warn('Socket connection rejected: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Attach user data to socket
      socket.user = {
        id: decoded.userId,
        username: decoded.username
      };
      
      logger.info(`Socket authenticated for user: ${decoded.username} (${decoded.userId})`);
      next();
    } catch (error) {
      logger.warn(`Socket authentication failed: ${error.message}`);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const username = socket.user.username;
    
    logger.info(`User connected: ${username} (${userId}), socket ID: ${socket.id}`);
    
    // Store user connection
    activeConnections.set(userId, socket.id);
    
    // Update user status to online
    io.emit('user_status', {
      userId,
      status: 'online'
    });
    
    // Join conversation handler
    socket.on('join', (conversationId) => {
      logger.debug(`User ${username} joining conversation: ${conversationId}`);
      socket.join(`conversation:${conversationId}`);
    });
    
    // Leave conversation handler
    socket.on('leave', (conversationId) => {
      logger.debug(`User ${username} leaving conversation: ${conversationId}`);
      socket.leave(`conversation:${conversationId}`);
    });
    
    // Typing indicator handler
    socket.on('typing', ({ conversationId, isTyping }) => {
      logger.debug(`User ${username} ${isTyping ? 'is typing' : 'stopped typing'} in conversation: ${conversationId}`);
      
      // Broadcast to all users in the conversation except the sender
      socket.to(`conversation:${conversationId}`).emit('typing', {
        userId,
        username,
        conversationId,
        isTyping
      });
    });
    
    // Message handler
    socket.on('message', async (data) => {
      try {
        const { conversationId, content, contentType = 'text', mediaId = null } = data;
        
        logger.debug(`Received message from ${username} in conversation: ${conversationId}`);
        
        // In a real implementation, we would save the message to the database here
        // and then broadcast it to all users in the conversation
        
        // For now, just broadcast the message
        io.to(`conversation:${conversationId}`).emit('message', {
          id: Date.now().toString(),
          senderId: userId,
          senderUsername: username,
          conversationId,
          content,
          contentType,
          mediaId,
          timestamp: new Date().toISOString(),
          status: 'sent',
          read: false
        });
      } catch (error) {
        logger.error(`Error handling message: ${error.message}`);
        socket.emit('error', { message: 'Failed to process message' });
      }
    });
    
    // Read receipt handler
    socket.on('read', ({ conversationId, messageIds }) => {
      logger.debug(`User ${username} read messages in conversation: ${conversationId}`);
      
      // In a real implementation, we would update the message read status in the database
      
      // Broadcast read receipts to all users in the conversation
      io.to(`conversation:${conversationId}`).emit('read', {
        userId,
        username,
        conversationId,
        messageIds,
        timestamp: new Date().toISOString()
      });
    });
    
    // Disconnect handler
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${username} (${userId})`);
      
      // Remove user connection
      activeConnections.delete(userId);
      
      // Update user status to offline
      io.emit('user_status', {
        userId,
        status: 'offline'
      });
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
};

// Get active socket by user ID
const getSocketByUserId = (userId) => {
  const socketId = activeConnections.get(userId);
  if (!socketId) return null;
  
  return io.sockets.sockets.get(socketId);
};

// Broadcast message to a conversation
const broadcastToConversation = (conversationId, event, data) => {
  io.to(`conversation:${conversationId}`).emit(event, data);
};

// Broadcast message to a specific user
const broadcastToUser = (userId, event, data) => {
  const socketId = activeConnections.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

module.exports = {
  initSocketServer,
  getSocketByUserId,
  broadcastToConversation,
  broadcastToUser
};
