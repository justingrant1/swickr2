const axios = require('axios');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Create a simple in-memory database
const mockDb = {
  users: []
};

// JWT configuration
const JWT_SECRET = 'swickr_test_secret_key';
const JWT_ACCESS_EXPIRY = '15m';
const JWT_REFRESH_EXPIRY = '7d';

// Create Express app for the test server
const app = express();
const PORT = 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY }
  );
  
  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );
  
  return { accessToken, refreshToken };
};

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    
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
      full_name: displayName || username,
      profile_picture: null,
      status: 'offline',
      created_at: new Date().toISOString()
    };
    
    // Add to mock database
    mockDb.users.push(newUser);
    
    console.log(`User created successfully with ID: ${newUser.id}`);
    
    // Generate tokens
    const tokens = generateTokens(newUser);
    
    // Return user data and tokens
    res.status(201).json({
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name,
        profilePicture: newUser.profile_picture
      },
      tokens
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

// Login endpoint
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
    
    // Generate tokens
    const tokens = generateTokens(user);
    
    // Return user data and tokens
    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        profilePicture: user.profile_picture
      },
      tokens
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    users: mockDb.users.length
  });
});

// Test client function to register a user
async function testRegister() {
  try {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Test@123',
      displayName: 'Test User'
    };
    
    console.log('Attempting to register user with data:', userData);
    
    const response = await axios.post('http://localhost:3003/api/auth/register', userData);
    
    console.log('Registration successful!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Registration failed:');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Network error?');
    } else {
      console.error('Error:', error.message);
    }
    return null;
  }
}

// Test client function to login a user
async function testLogin(username, password) {
  try {
    const credentials = { username, password };
    
    console.log('Attempting to login with credentials:', credentials);
    
    const response = await axios.post('http://localhost:3003/api/auth/login', credentials);
    
    console.log('Login successful!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Login failed:');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Network error?');
    } else {
      console.error('Error:', error.message);
    }
    return null;
  }
}

// Start the server and run tests
async function runTests() {
  // Start the server
  const server = app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log(`Using mock database with ${mockDb.users.length} users`);
    console.log(`JWT_SECRET is set to ${JWT_SECRET}`);
  });
  
  try {
    // Wait a moment for the server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test registration
    console.log('\n--- TESTING REGISTRATION ---');
    const registrationResult = await testRegister();
    
    if (registrationResult) {
      // Test login with the registered user
      console.log('\n--- TESTING LOGIN ---');
      await testLogin('testuser', 'Test@123');
      
      // Test login with wrong password
      console.log('\n--- TESTING LOGIN WITH WRONG PASSWORD ---');
      await testLogin('testuser', 'wrongpassword');
    }
    
    console.log('\n--- TESTS COMPLETED ---');
    console.log(`Users in database: ${mockDb.users.length}`);
  } catch (error) {
    console.error('Error during tests:', error);
  } finally {
    // Close the server
    server.close(() => {
      console.log('Test server closed');
    });
  }
}

// Run the tests
runTests();
