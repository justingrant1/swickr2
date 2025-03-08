// Serverless API handler for Vercel deployment
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

// Create Express app
const app = express();

// Apply middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jgrant:Bowery85!@cluster1.cftfrg0.mongodb.net/swickr?retryWrites=true&w=majority';

// Log the MongoDB URI (without password)
console.log('MongoDB URI:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));

// Define schemas and models
let User, Message;

// Define User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  password_hash: { type: String, required: true },
  full_name: { type: String },
  status: { type: String, default: 'online' },
  created_at: { type: Date, default: Date.now }
});

// Define Message Schema
const messageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  userId: { type: String, required: true },
  recipientId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// Configure mongoose
mongoose.set('strictQuery', false);

// Function to connect to MongoDB
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    
    // Set connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      family: 4 // Use IPv4, skip trying IPv6
    };
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, options);
    console.log('MongoDB connected successfully');
    
    // Initialize models
    initializeModels();
    
    // Create default user
    await createDefaultUser();
    
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
};

// Function to initialize models
const initializeModels = () => {
  try {
    // Check if models are already defined
    if (mongoose.models.User) {
      User = mongoose.models.User;
    } else {
      User = mongoose.model('User', userSchema);
    }
    
    if (mongoose.models.Message) {
      Message = mongoose.models.Message;
    } else {
      Message = mongoose.model('Message', messageSchema);
    }
    
    console.log('Models initialized successfully');
  } catch (error) {
    console.error('Error initializing models:', error);
  }
};

// Connect to MongoDB
connectDB();

// Set up connection event handlers
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected event fired');
  initializeModels();
  createDefaultUser();
});

// Handle connection errors
mongoose.connection.on('error', async (err) => {
  console.error('MongoDB connection error event:', err);
  
  // Try to reconnect
  console.log('Attempting to reconnect...');
  await connectDB();
});

// Handle disconnection
mongoose.connection.on('disconnected', async () => {
  console.log('MongoDB disconnected, attempting to reconnect...');
  await connectDB();
});

// Add default user if none exists
const createDefaultUser = async () => {
  try {
    if (!User) {
      console.log('User model not defined yet, skipping default user creation');
      return;
    }
    
    console.log('Checking for default user');
    const existingUser = await User.findOne({ username: 'testuser1' });
    if (!existingUser) {
      console.log('Creating default user');
      const passwordHash = await bcrypt.hash('password', 10);
      await User.create({
        username: 'testuser1',
        email: 'user1@example.com',
        password_hash: passwordHash,
        full_name: 'Test User One',
        status: 'online'
      });
      console.log('Default user created');
    } else {
      console.log('Default user already exists');
    }
  } catch (error) {
    console.error('Error creating default user:', error);
  }
};

// We'll call createDefaultUser after the models are defined in the connection event

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_production_jwt_secret_key_here';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Swickr API is running with MongoDB',
    timestamp: new Date().toISOString()
  });
});

// Authentication middleware
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
};

// Helper function to wait for models to be defined
const waitForModels = async (maxAttempts = 10, delay = 1000) => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    if (User && Message) {
      console.log('Models are now ready');
      return true;
    }
    
    // Try to initialize models again
    try {
      if (!User && mongoose.models.User) {
        User = mongoose.models.User;
      } else if (!User) {
        User = mongoose.model('User', userSchema);
      }
      
      if (!Message && mongoose.models.Message) {
        Message = mongoose.models.Message;
      } else if (!Message) {
        Message = mongoose.model('Message', messageSchema);
      }
    } catch (error) {
      console.error(`Error initializing models during wait (attempt ${attempts + 1}):`, error);
    }
    
    console.log(`Models not ready, waiting... (attempt ${attempts + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    attempts++;
  }
  console.error('Failed to initialize models after maximum attempts');
  return false;
};

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    
    // Check if User model is defined, with retry
    if (!User) {
      console.log('User model not defined yet, waiting...');
      const modelsReady = await waitForModels();
      if (!modelsReady) {
        console.error('Models not ready after waiting');
        return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
      }
    }
    
    const { username, email, password, fullName } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ error: { message: 'Please provide username, email, and password' } });
    }
    
    // Check if user already exists
    try {
      // Check connection state
      if (mongoose.connection.readyState !== 1) {
        console.error('MongoDB not connected when checking user. State:', mongoose.connection.readyState);
        return res.status(503).json({ 
          error: { 
            message: 'Database connection not ready', 
            details: `Connection state: ${mongoose.connection.readyState}` 
          } 
        });
      }
      
      console.log('Checking if username exists:', username);
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        console.log('User already exists:', existingUser.username);
        return res.status(409).json({ error: { message: 'Username already taken' } });
      }
      
      console.log('Checking if email exists:', email);
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        console.log('Email already exists:', email);
        return res.status(409).json({ error: { message: 'Email already taken' } });
      }
      
      console.log('Username and email are available');
    } catch (findError) {
      console.error('Error checking existing user:', findError);
      // Try to reconnect to MongoDB
      try {
        console.log('Attempting to reconnect to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Reconnection successful');
      } catch (reconnectError) {
        console.error('Reconnection failed:', reconnectError);
      }
      
      return res.status(500).json({ 
        error: { 
          message: 'Database error when checking user', 
          details: findError.message,
          stack: process.env.NODE_ENV === 'development' ? findError.stack : undefined
        } 
      });
    }
    
    // Hash password
    let passwordHash;
    try {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    } catch (hashError) {
      console.error('Error hashing password:', hashError);
      return res.status(500).json({ error: { message: 'Error processing password', details: hashError.message } });
    }
    
    // Create new user
    let newUser;
    try {
      newUser = await User.create({
        username,
        email,
        password_hash: passwordHash,
        full_name: fullName || username,
        status: 'online'
      });
      console.log('User created successfully:', newUser.username);
    } catch (createError) {
      console.error('Error creating user:', createError);
      return res.status(500).json({ error: { message: 'Error creating user', details: createError.message } });
    }
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId: newUser._id, username: newUser.username, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId: newUser._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return user data and tokens
    res.status(201).json({
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name,
        status: newUser.status
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
        message: 'Registration failed', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } 
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login request received:', { username: req.body.username });
    
    // Check if User model is defined, with retry
    if (!User) {
      console.log('User model not defined yet, waiting...');
      const modelsReady = await waitForModels();
      if (!modelsReady) {
        console.error('Models not ready after waiting');
        return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
      }
    }
    
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ error: { message: 'Please provide username and password' } });
    }
    
    // Find user
    let user;
    try {
      user = await User.findOne({ username });
      if (!user) {
        console.log('User not found:', username);
        return res.status(401).json({ error: { message: 'Invalid credentials' } });
      }
    } catch (findError) {
      console.error('Error finding user:', findError);
      return res.status(500).json({ error: { message: 'Database error when finding user', details: findError.message } });
    }
    
    // Verify password
    let isMatch;
    try {
      isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        console.log('Invalid password for user:', username);
        return res.status(401).json({ error: { message: 'Invalid credentials' } });
      }
    } catch (compareError) {
      console.error('Error comparing passwords:', compareError);
      return res.status(500).json({ error: { message: 'Error verifying password', details: compareError.message } });
    }
    
    // Update user status
    try {
      user.status = 'online';
      await user.save();
    } catch (saveError) {
      console.error('Error updating user status:', saveError);
      // Continue even if status update fails
    }
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user._id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('Login successful for user:', username);
    
    // Return user data and tokens
    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        status: user.status
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
        message: 'Login failed', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } 
    });
  }
});

// Get user profile
app.get('/api/users/me', authenticate, async (req, res) => {
  try {
    // Check if User model is defined, with retry
    if (!User) {
      console.log('User model not defined yet, waiting...');
      const modelsReady = await waitForModels();
      if (!modelsReady) {
        console.error('Models not ready after waiting');
        return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
      }
    }
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      status: user.status
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: { message: 'Failed to get user profile' } });
  }
});

// Get messages
app.get('/api/messages', authenticate, async (req, res) => {
  try {
    // Check if Message model is defined, with retry
    if (!Message) {
      console.log('Message model not defined yet, waiting...');
      const modelsReady = await waitForModels();
      if (!modelsReady) {
        console.error('Models not ready after waiting');
        return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
      }
    }
    
    const messages = await Message.find({
      $or: [
        { userId: req.user.userId },
        { recipientId: req.user.userId }
      ]
    }).sort({ timestamp: 1 });
    
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: { message: 'Failed to get messages' } });
  }
});

// Send message
app.post('/api/messages', authenticate, async (req, res) => {
  try {
    // Check if Message model is defined, with retry
    if (!Message) {
      console.log('Message model not defined yet, waiting...');
      const modelsReady = await waitForModels();
      if (!modelsReady) {
        console.error('Models not ready after waiting');
        return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
      }
    }
    
    const { content, recipientId } = req.body;
    
    if (!content || !recipientId) {
      return res.status(400).json({ error: { message: 'Content and recipientId are required' } });
    }
    
    const newMessage = await Message.create({
      content,
      userId: req.user.userId,
      recipientId,
      timestamp: new Date()
    });
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: { message: 'Failed to send message' } });
  }
});

// Get contacts
app.get('/api/contacts', authenticate, async (req, res) => {
  try {
    // Check if User model is defined, with retry
    if (!User) {
      console.log('User model not defined yet, waiting...');
      const modelsReady = await waitForModels();
      if (!modelsReady) {
        console.error('Models not ready after waiting');
        return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
      }
    }
    
    // Find all users except the current user
    const contacts = await User.find({ _id: { $ne: req.user.userId } })
      .select('_id username full_name status');
    
    res.json(contacts.map(contact => ({
      id: contact._id,
      username: contact.username,
      fullName: contact.full_name,
      status: contact.status
    })));
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: { message: 'Failed to get contacts' } });
  }
});

// Export the Express API
module.exports = app;
