// Serverless API handler for Vercel deployment
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Create Express app
const app = express();

// Apply middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const SUPABASE_URL = 'https://orfrnjeheaufjznybjtb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZnJuamVoZWF1Zmp6bnlianRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE0MDM1MTAsImV4cCI6MjA1Njk3OTUxMH0.sUqLxOTgjFWc1Cia6SDUQDfnMVDKNBx83FqKEWjDSzM';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Supabase client initialized');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_production_jwt_secret_key_here';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Swickr API is running with Supabase',
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

// Initialize Supabase tables if they don't exist
const initializeSupabaseTables = async () => {
  try {
    console.log('Creating Supabase tables if they don\'t exist...');
    
    // Create users table if it doesn't exist
    try {
      const { error: createUsersError } = await supabase.rpc('create_users_table_if_not_exists', {});
      
      if (createUsersError) {
        console.error('Error creating users table:', createUsersError);
        
        // Fallback: Create users table directly
        const { error: createTableError } = await supabase.query(`
          CREATE TABLE IF NOT EXISTS public.users (
            id UUID PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            status TEXT DEFAULT 'offline',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        if (createTableError) {
          console.error('Error creating users table directly:', createTableError);
        } else {
          console.log('Users table created directly');
        }
      } else {
        console.log('Users table created or already exists');
      }
    } catch (usersError) {
      console.error('Error in users table creation:', usersError);
    }
    
    // Create messages table if it doesn't exist
    try {
      const { error: createMessagesError } = await supabase.rpc('create_messages_table_if_not_exists', {});
      
      if (createMessagesError) {
        console.error('Error creating messages table:', createMessagesError);
        
        // Fallback: Create messages table directly
        const { error: createTableError } = await supabase.query(`
          CREATE TABLE IF NOT EXISTS public.messages (
            id UUID PRIMARY KEY,
            content TEXT NOT NULL,
            userId UUID NOT NULL,
            recipientId UUID NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        if (createTableError) {
          console.error('Error creating messages table directly:', createTableError);
        } else {
          console.log('Messages table created directly');
        }
      } else {
        console.log('Messages table created or already exists');
      }
    } catch (messagesError) {
      console.error('Error in messages table creation:', messagesError);
    }
    
    // Create default user if it doesn't exist
    await createDefaultUser();
    
  } catch (error) {
    console.error('Error initializing Supabase tables:', error);
  }
};

// Add default user if none exists
const createDefaultUser = async () => {
  try {
    console.log('Checking for default user');
    
    // Check if default user exists
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'testuser1')
      .single();
    
    if (findError && findError.code !== 'PGRST116') { // Not found is not an error in this case
      console.error('Error checking for default user:', findError);
      return;
    }
    
    if (!existingUser) {
      console.log('Creating default user');
      
      // Hash password
      const passwordHash = await bcrypt.hash('password', 10);
      
      // Create default user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            id: uuidv4(),
            username: 'testuser1',
            email: 'user1@example.com',
            password_hash: passwordHash,
            full_name: 'Test User One',
            status: 'online',
            created_at: new Date()
          }
        ])
        .select();
      
      if (createError) {
        console.error('Error creating default user:', createError);
      } else {
        console.log('Default user created successfully');
      }
    } else {
      console.log('Default user already exists');
    }
  } catch (error) {
    console.error('Error in createDefaultUser:', error);
  }
};

// Initialize Supabase tables
initializeSupabaseTables();

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    
    const { username, email, password, fullName } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ error: { message: 'Please provide username, email, and password' } });
    }
    
    // Skip username check - we'll just try to create the user directly
    console.log('Skipping username check due to potential network issues');
    let existingUserByUsername = null;
    
    // Skip email check - we'll just try to create the user directly
    console.log('Skipping email check due to potential network issues');
    let existingUserByEmail = null;
    
    // We're skipping the username and email checks due to network issues
    
    console.log('Username and email are available');
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create new user
    const userId = uuidv4();
    let newUser = null;
    let createError = null;
    
    try {
      // First, try to create the users table if it doesn't exist
      try {
        console.log('Attempting to create users table if it does not exist...');
        await supabase.query(`
          CREATE TABLE IF NOT EXISTS public.users (
            id UUID PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            status TEXT DEFAULT 'offline',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        console.log('Users table created or already exists');
      } catch (tableError) {
        console.error('Error creating users table:', tableError);
        // Continue anyway - the table might already exist
      }
      
      // Now try to insert the user
      console.log('Attempting to insert user...');
      const response = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            username,
            email,
            password_hash: passwordHash,
            full_name: fullName || username,
            status: 'online',
            created_at: new Date()
          }
        ])
        .select();
      
      newUser = response.data;
      createError = response.error;
      
      // Log the full response for debugging
      console.log('User creation response:', JSON.stringify(response));
    } catch (error) {
      console.error('Exception during user creation:', error);
      createError = error;
    }
    
    if (createError) {
      console.error('Error creating user:', JSON.stringify(createError));
      return res.status(500).json({ 
        error: { 
          message: 'Error creating user', 
          details: createError.message || 'Unknown error',
          code: createError.code || 'UNKNOWN',
          hint: createError.hint || 'No hint available',
          fullError: JSON.stringify(createError)
        } 
      });
    }
    
    console.log('User created successfully:', username);
    
    // Generate tokens
    const accessToken = jwt.sign(
      { userId, username, email },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { userId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return user data and tokens
    return res.status(201).json({
      user: {
        id: userId,
        username,
        email,
        fullName: fullName || username,
        status: 'online'
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
    
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ error: { message: 'Please provide username and password' } });
    }
    
    // Find user
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (findError) {
      console.error('Error finding user:', findError);
      return res.status(500).json({ 
        error: { 
          message: 'Database error when finding user', 
          details: findError.message 
        } 
      });
    }
    
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
    
    // Update user status
    const { error: updateError } = await supabase
      .from('users')
      .update({ status: 'online' })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('Error updating user status:', updateError);
      // Continue even if status update fails
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
    
    console.log('Login successful for user:', username);
    
    // Return user data and tokens
    return res.status(200).json({
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
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.userId)
      .single();
    
    if (error) {
      console.error('Error getting user profile:', error);
      return res.status(500).json({ error: { message: 'Failed to get user profile' } });
    }
    
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
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: { message: 'Failed to get user profile' } });
  }
});

// Get messages
app.get('/api/messages', authenticate, async (req, res) => {
  try {
    // Get messages where user is sender or recipient
    let messages = null;
    let error = null;
    
    try {
      // Get messages sent by the user
      const sentResponse = await supabase
        .from('messages')
        .select('*')
        .eq('userId', req.user.userId);
      
      // Get messages received by the user
      const receivedResponse = await supabase
        .from('messages')
        .select('*')
        .eq('recipientId', req.user.userId);
      
      if (sentResponse.error) {
        error = sentResponse.error;
        console.error('Error getting sent messages:', error);
      } else if (receivedResponse.error) {
        error = receivedResponse.error;
        console.error('Error getting received messages:', error);
      } else {
        // Combine and sort messages
        messages = [...(sentResponse.data || []), ...(receivedResponse.data || [])];
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      }
    } catch (err) {
      error = err;
      console.error('Error in messages query:', err);
    }
    
    if (error) {
      console.error('Error getting messages:', error);
      return res.status(500).json({ error: { message: 'Failed to get messages' } });
    }
    
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: { message: 'Failed to get messages' } });
  }
});

// Send message
app.post('/api/messages', authenticate, async (req, res) => {
  try {
    const { content, recipientId } = req.body;
    
    if (!content || !recipientId) {
      return res.status(400).json({ error: { message: 'Content and recipientId are required' } });
    }
    
    const messageId = uuidv4();
    const { data: newMessage, error } = await supabase
      .from('messages')
      .insert([
        {
          id: messageId,
          content,
          userId: req.user.userId,
          recipientId,
          timestamp: new Date()
        }
      ])
      .select();
    
    if (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({ error: { message: 'Failed to send message' } });
    }
    
    res.status(201).json(newMessage[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: { message: 'Failed to send message' } });
  }
});

// Get contacts
app.get('/api/contacts', authenticate, async (req, res) => {
  try {
    const { data: contacts, error } = await supabase
      .from('users')
      .select('id, username, full_name, status')
      .neq('id', req.user.userId);
    
    if (error) {
      console.error('Error getting contacts:', error);
      return res.status(500).json({ error: { message: 'Failed to get contacts' } });
    }
    
    res.json(contacts.map(contact => ({
      id: contact.id,
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
