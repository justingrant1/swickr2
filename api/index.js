// Serverless API handler for Vercel deployment
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Create Express app
const app = express();

// Apply middleware
app.use(cors());
app.use(express.json());

// Mock user database for demonstration
const users = [
  {
    id: "6dcbfde7-50a8-4c0c-b5f9-b525bfb3992a",
    username: "testuser1",
    email: "user1@example.com",
    password_hash: "$2b$10$9YvZUKJogb/7bjzuS3Yy8.bJ1gBCuh3WIswv99TTYy.eSSTDf.Ouji", // "password"
    full_name: "Test User One",
    status: "online"
  }
];

// Mock messages database
const messages = [];

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_production_jwt_secret_key_here';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Swickr API is running',
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
    const { username, email, password, fullName } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: { message: 'Please provide username, email, and password' } });
    }
    
    // Check if user already exists
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: { message: 'Username or email already taken' } });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create new user
    const newUser = {
      id: uuidv4(),
      username,
      email,
      password_hash: passwordHash,
      full_name: fullName || username,
      status: 'online'
    };
    
    // Add to mock database
    users.push(newUser);
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId: newUser.id, username: newUser.username, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '15m' }
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
        status: newUser.status
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: { message: 'Registration failed' } });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: { message: 'Please provide username and password' } });
    }
    
    // Find user
    const user = users.find(u => u.username === username);
    if (!user) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '15m' }
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
        status: user.status
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: { message: 'Login failed' } });
  }
});

// Get user profile
app.get('/api/users/me', authenticate, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  
  if (!user) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }
  
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    status: user.status
  });
});

// Get messages
app.get('/api/messages', authenticate, (req, res) => {
  res.json(messages.filter(m => m.userId === req.user.userId || m.recipientId === req.user.userId));
});

// Send message
app.post('/api/messages', authenticate, (req, res) => {
  const { content, recipientId } = req.body;
  
  if (!content || !recipientId) {
    return res.status(400).json({ error: { message: 'Content and recipientId are required' } });
  }
  
  const newMessage = {
    id: uuidv4(),
    content,
    userId: req.user.userId,
    recipientId,
    timestamp: new Date().toISOString()
  };
  
  messages.push(newMessage);
  
  res.status(201).json(newMessage);
});

// Export the Express API
module.exports = app;
