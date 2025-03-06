const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Create an axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Test user credentials
const testUser = {
  username: 'apitestuser',
  password: 'password123',
  email: 'apitest@example.com',
  fullName: 'API Test User'
};

// Global variables
let authToken = null;
let userId = null;
let testUserId = null;

/**
 * Login user and get auth token
 */
const login = async () => {
  try {
    console.log('Logging in...');
    
    const response = await api.post('/auth/login', {
      username: testUser.username,
      password: testUser.password
    });
    
    console.log('Login response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200) {
      console.log('Login successful');
      
      // Extract tokens
      if (response.data.tokens && response.data.tokens.accessToken) {
        console.log('Access token received');
        authToken = response.data.tokens.accessToken;
      } else if (response.data.token) {
        console.log('Access token received (direct format)');
        authToken = response.data.token;
      } else {
        throw new Error('No access token in response');
      }
      
      // Set auth header for subsequent requests
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      
      // Extract user ID
      if (response.data.user && response.data.user.id) {
        userId = response.data.user.id;
        console.log(`User ID: ${userId}`);
      } else {
        throw new Error('No user ID in response');
      }
    } else {
      throw new Error('Login failed');
    }
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
};

/**
 * Get a test user to add as a contact
 */
const getTestUser = async () => {
  try {
    console.log('Getting test users...');
    
    // Get all users
    const response = await api.get('/users/profile');
    
    console.log('Users response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.length > 0) {
      // Find a user that is not the current user
      const otherUsers = response.data.filter(user => user.id !== userId);
      
      if (otherUsers.length > 0) {
        testUserId = otherUsers[0].id;
        console.log(`Found test user with ID: ${testUserId}`);
        return;
      }
    }
    
    // If no users found, create a new test user
    console.log('No other users found, creating a new test user...');
    
    const registerResponse = await api.post('/auth/register', {
      username: `testuser_${Date.now()}`,
      password: 'password123',
      email: `testuser_${Date.now()}@example.com`,
      fullName: 'Test User'
    });
    
    if (registerResponse.status === 201) {
      testUserId = registerResponse.data.user.id;
      console.log(`Created new test user with ID: ${testUserId}`);
    } else {
      throw new Error('Failed to create test user');
    }
  } catch (error) {
    console.error('Error getting test user:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
};

/**
 * Test adding a contact
 */
const addContact = async () => {
  try {
    console.log('Testing add contact...');
    console.log(`Attempting to add contact with ID: ${testUserId}`);
    
    // Make sure we're sending the correct data format
    const payload = { contactId: testUserId };
    console.log(`Request payload:`, payload);
    
    // Log request details
    console.log(`Making POST request to: ${API_URL}/contacts`);
    console.log(`With headers:`, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    });
    
    // Send the request
    const response = await api.post('/contacts', payload);
    
    console.log(`Add contact response status: ${response.status}`);
    console.log(`Add contact response data:`, response.data);
    
    if (response.status === 201) {
      console.log('Add contact successful');
    } else {
      throw new Error(`Add contact failed with status ${response.status}`);
    }
  } catch (error) {
    // If contact already exists, that's fine
    if (error.response && error.response.status === 409) {
      console.log('Contact already exists, test passed');
    } else {
      console.error(`Add contact test failed: ${error.message}`);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        console.error('Request data:', error.config.data);
        console.error('Request URL:', error.config.url);
        console.error('Request method:', error.config.method);
        console.error('Request headers:', error.config.headers);
      }
      throw error;
    }
  }
};

/**
 * Main function to run all tests
 */
const runTests = async () => {
  try {
    console.log('Starting add contact test...');
    
    // Login
    await login();
    
    // Get test user
    await getTestUser();
    
    // Test add contact
    await addContact();
    
    console.log('All tests completed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
};

// Run tests
runTests();
