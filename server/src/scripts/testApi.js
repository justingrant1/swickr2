require('dotenv').config();
const axios = require('axios');
const WebSocket = require('ws');
const logger = require('../utils/logger');

// Configuration
const API_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';
let authToken = '';
let userId = '';
let testUserId = '';
let conversationId = '';

// Test user credentials
const testUser = {
  username: 'apitestuser',
  email: 'apitest@example.com',
  password: 'password123',
  fullName: 'API Test User'
};

// Axios instance with auth header
const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests when available
api.interceptors.request.use(config => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  logger.debug(`Making ${config.method.toUpperCase()} request to ${config.url}`);
  if (config.data) {
    logger.debug(`Request payload: ${JSON.stringify(config.data)}`);
  }
  return config;
});

// Add response interceptor for debugging
api.interceptors.response.use(
  response => {
    logger.debug(`Response status: ${response.status}`);
    return response;
  },
  error => {
    if (error.response) {
      logger.debug(`Error response status: ${error.response.status}`);
      logger.debug(`Error response data: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      logger.debug('No response received from server');
    } else {
      logger.debug(`Error setting up request: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

/**
 * Run all API tests
 */
const runTests = async () => {
  try {
    logger.info('Starting API tests...');
    
    // Authentication tests
    await testRegister();
    await testLogin();
    
    // User profile test
    await testGetProfile();
    
    // Get test users for subsequent tests
    await getTestUsers();
    
    // Contact tests
    await testAddContact();
    await testGetContacts();
    
    // Conversation and message tests
    await testCreateConversation();
    await testSendMessage();
    await testGetConversations();
    await testGetMessages();
    
    logger.info('All tests completed successfully!');
  } catch (error) {
    logger.error('Test failed:', error.message);
    process.exit(1);
  }
};

/**
 * Get test users for subsequent tests
 */
const getTestUsers = async () => {
  try {
    logger.info('Getting test users...');
    
    // First try to get existing users from the database
    const response = await api.get('/users/profile');
    
    if (response.status === 200) {
      // We have our own user ID
      const currentUser = response.data;
      userId = currentUser.id;
      
      // Now let's try to get contacts to find another user
      const contactsResponse = await api.get('/contacts');
      
      if (contactsResponse.status === 200 && Array.isArray(contactsResponse.data) && contactsResponse.data.length > 0) {
        // Use the first contact as our test user
        testUserId = contactsResponse.data[0].id;
        logger.info(`Using existing contact as test user ID: ${testUserId}`);
        return;
      }
      
      // If we don't have contacts, let's try to create a test user
      logger.info('No existing contacts found, creating a test user...');
      
      // Generate a random username and email
      const randomSuffix = Math.floor(Math.random() * 10000);
      const testUsername = `testcontact${randomSuffix}`;
      const testEmail = `testcontact${randomSuffix}@example.com`;
      
      // Register a test user
      const registerResponse = await axios.post(`${API_URL}/auth/register`, {
        username: testUsername,
        email: testEmail,
        password: 'password123',
        fullName: `Test Contact ${randomSuffix}`
      });
      
      if (registerResponse.status === 201) {
        testUserId = registerResponse.data.user.id;
        logger.info(`Created new test user with ID: ${testUserId}`);
      } else {
        throw new Error('Failed to create test user');
      }
    } else {
      throw new Error('Failed to get current user profile');
    }
  } catch (error) {
    logger.error('Error getting test users:', error.message);
    
    // As a fallback, use a hardcoded test user ID from one of the test users
    // This is not ideal but will allow tests to continue
    logger.info('Using fallback approach to find a test user...');
    
    try {
      // Try to login as one of the test users
      const loginResponse = await axios.post(`${API_URL}/auth/login`, {
        username: 'testuser2',
        password: 'password123'
      });
      
      if (loginResponse.status === 200 && loginResponse.data.user) {
        testUserId = loginResponse.data.user.id;
        logger.info(`Using test user with ID: ${testUserId}`);
      } else {
        throw new Error('Failed to login as test user');
      }
    } catch (innerError) {
      logger.error('Error with fallback approach:', innerError.message);
      throw new Error('Could not find a valid test user');
    }
  }
};

/**
 * Test user registration
 */
const testRegister = async () => {
  try {
    logger.info('Testing user registration...');
    
    // Check if test user already exists
    try {
      const response = await api.post('/auth/login', {
        username: testUser.username,
        password: testUser.password
      });
      
      if (response.status === 200) {
        logger.info('Test user already exists, skipping registration');
        return;
      }
    } catch (error) {
      logger.info('Test user does not exist, creating new user');
    }
    
    // Register new user
    const response = await api.post('/auth/register', testUser);
    
    if (response.status === 201) {
      logger.info(' User registration successful');
    } else {
      throw new Error('User registration failed');
    }
  } catch (error) {
    logger.error(' User registration test failed:', error.message);
    if (error.response) {
      logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      logger.error('Response status:', error.response.status);
      logger.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
};

/**
 * Test user login
 */
const testLogin = async () => {
  try {
    logger.info('Testing user login...');
    logger.info(`Attempting to login with username: ${testUser.username}`);
    
    const response = await api.post('/auth/login', {
      username: testUser.username,
      password: testUser.password
    });
    
    logger.info('Full login response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200) {
      logger.info('Login successful');
      
      // Extract tokens if available
      if (response.data.tokens && response.data.tokens.accessToken) {
        logger.info('Access token received');
        authToken = response.data.tokens.accessToken;
      } else if (response.data.token) {
        // Some implementations might return token directly
        logger.info('Access token received (direct format)');
        authToken = response.data.token;
      } else {
        throw new Error('No access token in response');
      }
      
      // Extract user ID
      if (response.data.user && response.data.user.id) {
        userId = response.data.user.id;
        logger.info(`User ID: ${userId}`);
      } else {
        throw new Error('No user ID in response');
      }
    } else {
      throw new Error('User login failed');
    }
  } catch (error) {
    logger.error(' User login test failed:', error.message);
    if (error.response) {
      logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      logger.error('Response status:', error.response.status);
      logger.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
};

/**
 * Test getting user profile
 */
const testGetProfile = async () => {
  try {
    logger.info('Testing get user profile...');
    logger.info(`Using auth token: ${authToken ? authToken.substring(0, 15) + '...' : 'No token'}`);
    logger.info(`User ID: ${userId}`);
    
    try {
      // Make the API call with explicit error handling
      const response = await axios({
        method: 'get',
        url: `${API_URL}/users/profile`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        validateStatus: false // Don't throw on any status code
      });
      
      logger.info('Profile response status:', response.status);
      logger.info('Profile response headers:', JSON.stringify(response.headers, null, 2));
      logger.info('Profile response data:', JSON.stringify(response.data, null, 2));
      
      if (response.status === 200 && response.data.id === userId) {
        logger.info(' Get profile successful');
      } else {
        throw new Error(`Get profile failed with status ${response.status}`);
      }
    } catch (axiosError) {
      logger.error('Axios error:', axiosError.message);
      if (axiosError.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        logger.error('Response status:', axiosError.response.status);
        logger.error('Response headers:', JSON.stringify(axiosError.response.headers, null, 2));
        logger.error('Response data:', JSON.stringify(axiosError.response.data, null, 2));
      } else if (axiosError.request) {
        // The request was made but no response was received
        logger.error('No response received, request:', axiosError.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        logger.error('Error details:', axiosError.message);
      }
      throw axiosError;
    }
  } catch (error) {
    logger.error(' Get profile test failed:', error.message);
    throw error;
  }
};

/**
 * Test searching for users
 */
const testSearchUsers = async () => {
  try {
    logger.info('Testing search users...');
    
    // Log the request URL for debugging
    const requestUrl = '/users/search?query=test';
    logger.info(`Making request to: ${requestUrl}`);
    
    const response = await api.get(requestUrl);
    
    logger.info('Search response status:', response.status);
    logger.info('Search response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && Array.isArray(response.data)) {
      logger.info(` Search users successful, found ${response.data.length} users`);
      
      // Save a test user ID for contact tests
      if (response.data.length > 0) {
        const otherUser = response.data.find(user => user.id !== userId);
        if (otherUser) {
          testUserId = otherUser.id;
          logger.info(`Selected test user ID: ${testUserId}`);
        }
      }
    } else {
      throw new Error('Search users failed');
    }
  } catch (error) {
    logger.error(' Search users test failed:', error.message);
    if (error.response) {
      logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      logger.error('Response status:', error.response.status);
      logger.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
};

/**
 * Test adding a contact
 */
const testAddContact = async () => {
  try {
    logger.info('Testing add contact...');
    
    if (!testUserId) {
      logger.warn(' Skipping add contact test - no test user found');
      return;
    }
    
    logger.info(`Attempting to add contact with ID: ${testUserId}`);
    
    // Make sure we're sending the correct data format
    const payload = { contactId: testUserId };
    logger.info(`Request payload: ${JSON.stringify(payload)}`);
    
    // Log the full request details
    logger.info(`Making POST request to: ${API_URL}/contacts`);
    logger.info(`With headers: ${JSON.stringify({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }, null, 2)}`);
    
    // Try with explicit headers to ensure content type is set correctly
    const response = await api.post('/contacts', payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    logger.info(`Add contact response status: ${response.status}`);
    logger.info(`Add contact response data: ${JSON.stringify(response.data, null, 2)}`);
    
    if (response.status === 201) {
      logger.info(' Add contact successful');
    } else {
      throw new Error(`Add contact failed with status ${response.status}`);
    }
  } catch (error) {
    // If contact already exists, that's fine
    if (error.response && error.response.status === 409) {
      logger.info(' Contact already exists, test passed');
    } else {
      logger.error(` Add contact test failed: ${error.message}`);
      if (error.response) {
        logger.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response headers: ${JSON.stringify(error.response.headers, null, 2)}`);
        logger.error(`Request data: ${JSON.stringify(error.config.data, null, 2)}`);
        logger.error(`Request URL: ${error.config.url}`);
        logger.error(`Request method: ${error.config.method}`);
        logger.error(`Request headers: ${JSON.stringify(error.config.headers, null, 2)}`);
      } else if (error.request) {
        logger.error('No response received. This could indicate a network issue or server not running.');
        logger.error(`Request details: ${JSON.stringify(error.request._currentUrl || error.request, null, 2)}`);
      } else {
        logger.error(`Error details: ${error}`);
      }
      throw error;
    }
  }
};

/**
 * Test getting contacts
 */
const testGetContacts = async () => {
  try {
    logger.info('Testing get contacts...');
    
    const response = await api.get('/contacts');
    
    logger.info('Get contacts response status:', response.status);
    logger.info('Get contacts response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && Array.isArray(response.data)) {
      logger.info(` Get contacts successful, found ${response.data.length} contacts`);
    } else {
      throw new Error('Get contacts failed');
    }
  } catch (error) {
    logger.error(' Get contacts test failed:', error.message);
    if (error.response) {
      logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      logger.error('Response status:', error.response.status);
      logger.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
};

/**
 * Test creating a conversation
 */
const testCreateConversation = async () => {
  try {
    logger.info('Testing create conversation...');
    
    if (!testUserId) {
      logger.warn(' Skipping create conversation test - no test user found');
      return;
    }
    
    const response = await api.post('/conversations', {
      participantIds: [testUserId]
    });
    
    logger.info('Create conversation response status:', response.status);
    logger.info('Create conversation response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 201 && response.data.id) {
      logger.info(' Create conversation successful');
      conversationId = response.data.id;
    } else {
      throw new Error('Create conversation failed');
    }
  } catch (error) {
    logger.error(' Create conversation test failed:', error.message);
    if (error.response) {
      logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      logger.error('Response status:', error.response.status);
      logger.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
};

/**
 * Test sending a message
 */
const testSendMessage = async () => {
  try {
    logger.info('Testing send message...');
    
    if (!conversationId) {
      logger.warn(' Skipping send message test - no conversation created');
      return;
    }
    
    const message = {
      conversationId,
      content: 'This is a test message from the API test script'
    };
    
    const response = await api.post('/messages', message);
    
    logger.info('Send message response status:', response.status);
    logger.info('Send message response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 201 && response.data.id) {
      logger.info(' Send message successful');
    } else {
      throw new Error('Send message failed');
    }
  } catch (error) {
    logger.error(' Send message test failed:', error.message);
    if (error.response) {
      logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      logger.error('Response status:', error.response.status);
      logger.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
};

/**
 * Test getting conversations
 */
const testGetConversations = async () => {
  try {
    logger.info('Testing get conversations...');
    
    const response = await api.get('/conversations');
    
    logger.info('Get conversations response status:', response.status);
    logger.info('Get conversations response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && Array.isArray(response.data)) {
      logger.info(` Get conversations successful, found ${response.data.length} conversations`);
    } else {
      throw new Error('Get conversations failed');
    }
  } catch (error) {
    logger.error(' Get conversations test failed:', error.message);
    if (error.response) {
      logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      logger.error('Response status:', error.response.status);
      logger.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
};

/**
 * Test getting messages
 */
const testGetMessages = async () => {
  try {
    logger.info('Testing get messages...');
    
    if (!conversationId) {
      logger.warn(' Skipping get messages test - no conversation created');
      return;
    }
    
    const response = await api.get(`/messages/${conversationId}`);
    
    logger.info('Get messages response status:', response.status);
    logger.info('Get messages response data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && Array.isArray(response.data)) {
      logger.info(` Get messages successful, found ${response.data.length} messages`);
    } else {
      throw new Error('Get messages failed');
    }
  } catch (error) {
    logger.error(' Get messages test failed:', error.message);
    if (error.response) {
      logger.error('Response data:', JSON.stringify(error.response.data, null, 2));
      logger.error('Response status:', error.response.status);
      logger.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
    }
    throw error;
  }
};

// Start the tests
runTests();
