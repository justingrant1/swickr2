const axios = require('axios');
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
  password: 'password123'
};

// Global variables
let authToken = null;
let userId = null;
let testUserId = null;
let testUsername = null;

/**
 * Login and get auth token
 */
const login = async () => {
  try {
    console.log('Logging in...');
    
    const response = await api.post('/auth/login', {
      username: testUser.username,
      password: testUser.password
    });
    
    if (response.status === 200) {
      console.log('Login successful');
      
      // Extract user data
      userId = response.data.user.id;
      console.log(`User ID: ${userId}`);
      
      // Extract tokens
      if (response.data.tokens && response.data.tokens.accessToken) {
        authToken = response.data.tokens.accessToken;
        console.log('Access token received');
      } else if (response.data.token) {
        authToken = response.data.token;
        console.log('Access token received (direct format)');
      } else {
        throw new Error('No access token in response');
      }
      
      // Set auth header for subsequent requests
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    } else {
      throw new Error('Login failed');
    }
  } catch (error) {
    console.error('Login failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

/**
 * Create a test user to add as a contact
 */
const createTestUser = async () => {
  try {
    console.log('Creating test user...');
    
    // Generate unique username
    const uniqueId = Date.now();
    testUsername = `testuser_${uniqueId}`;
    
    const response = await api.post('/auth/register', {
      username: testUsername,
      password: 'password123',
      email: `${testUsername}@example.com`,
      fullName: 'Test Contact User'
    });
    
    if (response.status === 201) {
      testUserId = response.data.user.id;
      console.log(`Created test user with ID: ${testUserId} and username: ${testUsername}`);
    } else {
      throw new Error('Failed to create test user');
    }
  } catch (error) {
    console.error('Error creating test user:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

/**
 * Test adding a contact by ID
 */
const testAddContactById = async () => {
  try {
    console.log('Testing add contact by ID...');
    
    // Make sure we have a test user ID
    if (!testUserId) {
      throw new Error('No test user ID available');
    }
    
    // Prepare request payload
    const payload = { contactId: testUserId };
    console.log(`Request payload: ${JSON.stringify(payload)}`);
    console.log(`Authorization header: Bearer ${authToken.substring(0, 20)}...`);
    
    // Send request
    const response = await api.post('/contacts', payload);
    
    if (response.status === 201) {
      console.log('Add contact by ID successful');
      console.log('Contact data:', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      throw new Error(`Add contact by ID failed with status ${response.status}`);
    }
  } catch (error) {
    // If contact already exists, that's fine for testing
    if (error.response && error.response.status === 409) {
      console.log('Contact already exists, which is fine for testing');
      return true;
    }
    
    console.error('Error adding contact by ID:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Request config:', JSON.stringify({
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers,
        data: error.config.data
      }, null, 2));
    }
    return false;
  }
};

/**
 * Test adding a contact by username
 */
const testAddContactByUsername = async () => {
  try {
    console.log('Testing add contact by username...');
    
    // Make sure we have a test username
    if (!testUsername) {
      throw new Error('No test username available');
    }
    
    // Prepare request payload
    const payload = { username: testUsername };
    console.log(`Request payload: ${JSON.stringify(payload)}`);
    
    // Send request
    const response = await api.post('/contacts', payload);
    
    if (response.status === 201) {
      console.log('Add contact by username successful');
      console.log('Contact data:', JSON.stringify(response.data, null, 2));
      return true;
    } else {
      throw new Error(`Add contact by username failed with status ${response.status}`);
    }
  } catch (error) {
    // If contact already exists, that's fine for testing
    if (error.response && error.response.status === 409) {
      console.log('Contact already exists, which is fine for testing');
      return true;
    }
    
    console.error('Error adding contact by username:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
    return false;
  }
};

/**
 * Get and display contacts
 */
const getContacts = async () => {
  try {
    console.log('Getting contacts...');
    
    const response = await api.get('/contacts');
    
    if (response.status === 200) {
      console.log(`Found ${response.data.length} contacts`);
      if (response.data.length > 0) {
        console.log('First contact:', JSON.stringify(response.data[0], null, 2));
      }
      return true;
    } else {
      throw new Error(`Get contacts failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('Error getting contacts:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
};

/**
 * Run all tests
 */
const runTests = async () => {
  try {
    console.log('=== Starting Contacts API Tests ===');
    
    // Login
    await login();
    
    // Get initial contacts
    console.log('\n--- Initial Contacts ---');
    await getContacts();
    
    // Create test user
    console.log('\n--- Creating Test User ---');
    await createTestUser();
    
    // Test add contact by ID
    console.log('\n--- Testing Add Contact by ID ---');
    const idTestResult = await testAddContactById();
    
    // Test add contact by username
    console.log('\n--- Testing Add Contact by Username ---');
    const usernameTestResult = await testAddContactByUsername();
    
    // Get updated contacts
    console.log('\n--- Updated Contacts ---');
    await getContacts();
    
    // Summary
    console.log('\n=== Test Results ===');
    console.log(`Add contact by ID: ${idTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Add contact by username: ${usernameTestResult ? 'PASSED' : 'FAILED'}`);
    
    if (idTestResult && usernameTestResult) {
      console.log('\n✅ All tests passed!');
    } else {
      console.log('\n❌ Some tests failed.');
    }
  } catch (error) {
    console.error('Test suite failed:', error.message);
  }
};

// Run tests
runTests();
