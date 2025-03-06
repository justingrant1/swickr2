const axios = require('axios');
const util = require('util');

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

// Enable request and response logging
api.interceptors.request.use(request => {
  console.log('Request:', {
    method: request.method,
    url: request.url,
    headers: request.headers,
    data: request.data
  });
  return request;
});

api.interceptors.response.use(
  response => {
    console.log('Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    });
    return response;
  },
  error => {
    console.log('Error:', {
      message: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data
      } : 'No response',
      request: error.config ? {
        method: error.config.method,
        url: error.config.url,
        headers: error.config.headers,
        data: error.config.data
      } : 'No request config'
    });
    return Promise.reject(error);
  }
);

// Test user credentials
const testUser = {
  username: 'apitestuser',
  password: 'password123'
};

// Main function
async function debugContactsRequest() {
  try {
    console.log('=== Starting Contacts Request Debug ===');
    
    // Step 1: Login to get auth token
    console.log('\n1. Logging in...');
    const loginResponse = await api.post('/auth/login', {
      username: testUser.username,
      password: testUser.password
    });
    
    // Extract user ID and token
    const userId = loginResponse.data.user.id;
    const authToken = loginResponse.data.tokens?.accessToken || loginResponse.data.token;
    
    console.log(`User ID: ${userId}`);
    console.log(`Auth token (first 20 chars): ${authToken.substring(0, 20)}...`);
    
    // Set auth header for subsequent requests
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    
    // Step 2: Try to add a contact with a UUID directly
    console.log('\n2. Adding contact with UUID directly...');
    
    // Generate a random UUID for testing
    const testContactId = '00000000-0000-0000-0000-000000000001';
    
    try {
      // Make the request with explicit JSON content type and stringify the payload
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: JSON.stringify({ contactId: testContactId }),
        validateStatus: () => true // Don't throw on any status code
      });
      
      console.log('Direct axios response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
    } catch (error) {
      console.error('Direct axios error:', error.message);
    }
    
    // Step 3: Try to add a contact with a username directly
    console.log('\n3. Adding contact with username directly...');
    
    try {
      // Make the request with explicit JSON content type and stringify the payload
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: JSON.stringify({ username: 'testuser' }),
        validateStatus: () => true // Don't throw on any status code
      });
      
      console.log('Direct axios response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
    } catch (error) {
      console.error('Direct axios error:', error.message);
    }
    
    console.log('\n=== Contacts Request Debug Complete ===');
  } catch (error) {
    console.error('Debug script failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', util.inspect(error.response.data, { depth: null }));
    }
  }
}

// Run the debug function
debugContactsRequest();
