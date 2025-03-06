const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// User connection store
const connectedUsers = new Map();

// Initialize WebSocket server
const initializeWebSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'swickr_secret_key_change_in_production');
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const username = socket.username;

    console.log(`User connected: ${username} (${userId})`);
    
    // Store user connection
    connectedUsers.set(userId, {
      socketId: socket.id,
      username,
      status: 'online',
      lastActive: new Date()
    });

    // Broadcast user online status
    socket.broadcast.emit('user:status', {
      userId,
      username,
      status: 'online'
    });

    // Handle private messages
    socket.on('message:send', async (data) => {
      try {
        const { recipientId, content, messageType = 'text' } = data;
        
        // Validate message data
        if (!recipientId || !content) {
          socket.emit('error', {
            message: 'Invalid message data',
            code: 'INVALID_MESSAGE'
          });
          return;
        }

        // Create message object
        const message = {
          id: Math.random().toString(36).substring(2, 15),
          senderId: userId,
          senderUsername: username,
          recipientId,
          content,
          messageType,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };

        // Emit to sender for immediate feedback
        socket.emit('message:sent', message);

        // Find recipient socket
        const recipientSocket = findUserSocket(recipientId);
        if (recipientSocket) {
          // Recipient is online, deliver message
          io.to(recipientSocket).emit('message:received', message);
          
          // Update message status to delivered
          socket.emit('message:status', {
            messageId: message.id,
            status: 'delivered'
          });
        } else {
          // Recipient is offline, store message for later delivery
          // In a production app, this would be stored in the database
          console.log(`User ${recipientId} is offline, message queued for later delivery`);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', {
          message: 'Failed to send message',
          code: 'MESSAGE_SEND_FAILED'
        });
      }
    });

    // Handle typing indicators
    socket.on('typing:start', (data) => {
      const { recipientId } = data;
      const recipientSocket = findUserSocket(recipientId);
      
      if (recipientSocket) {
        io.to(recipientSocket).emit('typing:update', {
          userId,
          username,
          isTyping: true
        });
      }
    });

    socket.on('typing:stop', (data) => {
      const { recipientId } = data;
      const recipientSocket = findUserSocket(recipientId);
      
      if (recipientSocket) {
        io.to(recipientSocket).emit('typing:update', {
          userId,
          username,
          isTyping: false
        });
      }
    });

    // Handle read receipts
    socket.on('message:read', (data) => {
      const { messageId, senderId } = data;
      const senderSocket = findUserSocket(senderId);
      
      if (senderSocket) {
        io.to(senderSocket).emit('message:status', {
          messageId,
          status: 'read'
        });
      }
    });

    // Handle user status changes
    socket.on('user:status', (data) => {
      const { status } = data;
      
      if (connectedUsers.has(userId)) {
        const userData = connectedUsers.get(userId);
        userData.status = status;
        userData.lastActive = new Date();
        connectedUsers.set(userId, userData);
      }
      
      socket.broadcast.emit('user:status', {
        userId,
        username,
        status
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${username} (${userId})`);
      
      if (connectedUsers.has(userId)) {
        const userData = connectedUsers.get(userId);
        userData.status = 'offline';
        userData.lastActive = new Date();
        connectedUsers.set(userId, userData);
      }
      
      // Broadcast user offline status
      socket.broadcast.emit('user:status', {
        userId,
        username,
        status: 'offline'
      });
    });
  });

  // Helper function to find a user's socket
  const findUserSocket = (userId) => {
    if (connectedUsers.has(userId)) {
      return connectedUsers.get(userId).socketId;
    }
    return null;
  };

  return io;
};

module.exports = {
  initializeWebSocket
};
