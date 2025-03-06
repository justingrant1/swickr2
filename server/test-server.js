const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');

// Configuration
const PORT = 3004;
const JWT_SECRET = process.env.JWT_SECRET || 'swickr_secret_key_change_in_production';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// In-memory mock database
const mockDb = {
  users: [],
  messages: [],
  conversations: []
};

// Create Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.io
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path}`);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    // Don't log passwords in clear text
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) {
      sanitizedBody.password = '--- PASSWORD ---';
    }
    console.log('Request body:', sanitizedBody);
  }
  next();
});

// Enhanced logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    
    console.log(`Registration attempt for username: ${username}, email: ${email}`);
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        error: {
          message: 'Please provide username, email, and password'
        }
      });
    }
    
    // Check if username or email already exists
    const existingUser = mockDb.users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      return res.status(409).json({
        error: {
          message: 'Username or email already exists'
        }
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create new user
    const newUser = {
      id: uuidv4(),
      username,
      email,
      password_hash: passwordHash,
      full_name: fullName || username,
      profile_picture: null,
      status: 'offline',
      created_at: new Date().toISOString()
    };
    
    // Add to mock database
    mockDb.users.push(newUser);
    
    console.log(`User created successfully with ID: ${newUser.id}`);
    
    // Generate JWT tokens
    const accessToken = jwt.sign(
      { userId: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
      { userId: newUser.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return user data and tokens
    res.status(201).json({
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name,
        profilePicture: newUser.profile_picture
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: {
        message: 'Registration failed: ' + (error.message || 'Unknown error')
      }
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        error: {
          message: 'Please provide username and password'
        }
      });
    }
    
    // Find user
    const user = mockDb.users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials'
        }
      });
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          message: 'Invalid credentials'
        }
      });
    }
    
    // Generate JWT tokens
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return user data and tokens
    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        profilePicture: user.profile_picture
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        message: 'Login failed: ' + (error.message || 'Unknown error')
      }
    });
  }
});

// Contacts routes
app.get('/api/contacts', authenticateToken, (req, res) => {
  try {
    // In a real app, this would filter contacts for the current user
    const contacts = mockDb.users
      .filter(user => user.id !== req.user.userId)
      .map(user => ({
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        profilePicture: user.profile_picture,
        status: 'offline' // Default status
      }));
    
    res.status(200).json({ contacts });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error'
      }
    });
  }
});

// Messages routes
app.post('/api/messages', authenticateToken, (req, res) => {
  try {
    const { recipientId, content, messageType = 'text' } = req.body;
    
    // Basic validation
    if (!recipientId || !content) {
      return res.status(400).json({
        error: { message: 'Recipient ID and content are required' }
      });
    }
    
    // Check if recipient exists
    const recipient = mockDb.users.find(user => user.id === recipientId);
    if (!recipient) {
      return res.status(404).json({
        error: { message: 'Recipient not found' }
      });
    }
    
    // Create new message
    const newMessage = {
      id: uuidv4(),
      senderId: req.user.userId,
      recipientId,
      content,
      messageType,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };
    
    // Add message to mock database
    mockDb.messages.push(newMessage);
    
    // Find or create conversation
    let conversation = mockDb.conversations.find(
      conv => (conv.participants.includes(req.user.userId) && conv.participants.includes(recipientId))
    );
    
    if (!conversation) {
      conversation = {
        id: uuidv4(),
        participants: [req.user.userId, recipientId],
        lastMessageId: newMessage.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.conversations.push(conversation);
    } else {
      conversation.lastMessageId = newMessage.id;
      conversation.updatedAt = new Date().toISOString();
    }
    
    res.status(201).json({
      message: newMessage,
      conversation: {
        id: conversation.id,
        participants: conversation.participants
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

app.get('/api/messages/:conversationId', authenticateToken, (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Find conversation
    const conversation = mockDb.conversations.find(conv => conv.id === conversationId);
    if (!conversation) {
      return res.status(404).json({
        error: { message: 'Conversation not found' }
      });
    }
    
    // Check if user is a participant
    if (!conversation.participants.includes(req.user.userId)) {
      return res.status(403).json({
        error: { message: 'You are not a participant in this conversation' }
      });
    }
    
    // Get messages for conversation
    const messages = mockDb.messages.filter(
      msg => conversation.participants.includes(msg.senderId) && 
             conversation.participants.includes(msg.recipientId)
    );
    
    res.status(200).json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

// Socket.io authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    
    // Find user
    const user = mockDb.users.find(user => user.id === decoded.userId);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Connected users map
const connectedUsers = new Map();

// Socket.io connection handler
io.on('connection', (socket) => {
  const userId = socket.userId;
  const username = socket.username;
  
  console.log(`User connected to socket: ${username} (${userId})`);
  
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
  socket.on('message:send', (data) => {
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
      
      console.log(`Message from ${username} to ${recipientId}: ${content}`);
      
      // Create message object
      const message = {
        id: uuidv4(),
        senderId: userId,
        senderUsername: username,
        recipientId,
        content,
        messageType,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };
      
      // Add message to mock database
      mockDb.messages.push(message);
      
      // Emit to sender for immediate feedback
      socket.emit('message:sent', message);
      
      // Find recipient socket
      const recipientData = connectedUsers.get(recipientId);
      if (recipientData) {
        // Recipient is online, deliver message
        io.to(recipientData.socketId).emit('message:received', message);
        
        // Update message status to delivered
        message.status = 'delivered';
        socket.emit('message:status', {
          messageId: message.id,
          status: 'delivered'
        });
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
    const recipientData = connectedUsers.get(recipientId);
    
    if (recipientData) {
      io.to(recipientData.socketId).emit('typing:update', {
        userId,
        username,
        isTyping: true
      });
    }
  });
  
  socket.on('typing:stop', (data) => {
    const { recipientId } = data;
    const recipientData = connectedUsers.get(recipientId);
    
    if (recipientData) {
      io.to(recipientData.socketId).emit('typing:update', {
        userId,
        username,
        isTyping: false
      });
    }
  });
  
  // Handle read receipts
  socket.on('message:read', (data) => {
    const { messageId, senderId } = data;
    const senderData = connectedUsers.get(senderId);
    
    if (senderData) {
      io.to(senderData.socketId).emit('message:status', {
        messageId,
        status: 'read'
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${username} (${userId})`);
    
    // Update user status
    if (connectedUsers.has(userId)) {
      connectedUsers.delete(userId);
    }
    
    // Broadcast user offline status
    socket.broadcast.emit('user:status', {
      userId,
      username,
      status: 'offline'
    });
  });
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      error: { message: 'Authentication token is required' }
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({
      error: { message: 'Invalid or expired token' }
    });
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log(`Using mock database with ${mockDb.users.length} users`);
  console.log(`JWT_SECRET is ${JWT_SECRET ? 'set' : 'not set'}`);
  console.log(`CLIENT_URL is set to ${CLIENT_URL}`);
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Test server closed');
  process.exit(0);
});
