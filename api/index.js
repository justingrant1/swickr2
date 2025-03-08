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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jgrant:Bowery85!@cluster1.cftfrg0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  // Don't throw error in serverless environment
  if (!process.env.VERCEL) {
    throw err;
  }
});

// Define schemas and models
let User, Message;

// Initialize models after connection is established
mongoose.connection.on('connected', () => {
  console.log('Mongoose connection established, defining models');
  
  // Define User Schema if not already defined
  if (!mongoose.models.User) {
    const userSchema = new mongoose.Schema({
      username: { type: String, required: true },
      email: { type: String, required: true },
      password_hash: { type: String, required: true },
      full_name: { type: String },
      status: { type: String, default: 'online' },
      created_at: { type: Date, default: Date.now }
    });
    
    // Remove unique index which can cause issues in serverless environments
    userSchema.index({ username: 1 }, { unique: true });
    userSchema.index({ email: 1 }, { unique: true });
    
    User = mongoose.model('User', userSchema);
  } else {
    User = mongoose.models.User;
  }
  
  // Define Message Schema if not already defined
  if (!mongoose.models.Message) {
    const messageSchema = new mongoose.Schema({
      content: { type: String, required: true },
      userId: { type: String, required: true },
      recipientId: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    });
    
    Message = mongoose.model('Message', messageSchema);
  } else {
    Message = mongoose.models.Message;
  }
  
  // Create default user after models are defined
  createDefaultUser();
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

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    
    // Check if User model is defined
    if (!User) {
      console.error('User model not defined yet');
      return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
    }
    
    const { username, email, password, fullName } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ error: { message: 'Please provide username, email, and password' } });
    }
    
    // Check if user already exists
    try {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        console.log('User already exists:', existingUser.username);
        return res.status(409).json({ error: { message: 'Username already taken' } });
      }
      
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        console.log('Email already exists:', email);
        return res.status(409).json({ error: { message: 'Email already taken' } });
      }
    } catch (findError) {
      console.error('Error checking existing user:', findError);
      return res.status(500).json({ error: { message: 'Database error when checking user', details: findError.message } });
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
    
    // Check if User model is defined
    if (!User) {
      console.error('User model not defined yet');
      return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
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
    // Check if User model is defined
    if (!User) {
      console.error('User model not defined yet');
      return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
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
    // Check if Message model is defined
    if (!Message) {
      console.error('Message model not defined yet');
      return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
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
    // Check if Message model is defined
    if (!Message) {
      console.error('Message model not defined yet');
      return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
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
    // Check if User model is defined
    if (!User) {
      console.error('User model not defined yet');
      return res.status(503).json({ error: { message: 'Database not ready, please try again in a moment' } });
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
