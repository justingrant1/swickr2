const axios = require('axios');

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

// Main function
async function testSimpleContact() {
  try {
    console.log('=== Starting Simple Contact Test ===');
    
    // Step 1: Login to get auth token
    console.log('\n1. Logging in...');
    const loginResponse = await api.post('/auth/login', {
      username: testUser.username,
      password: testUser.password
    });
    
    console.log('Login response status:', loginResponse.status);
    
    // Extract user ID and token
    const userId = loginResponse.data.user.id;
    const authToken = loginResponse.data.tokens?.accessToken || loginResponse.data.token;
    
    console.log('User ID:', userId);
    console.log('Auth token (first 20 chars):', authToken.substring(0, 20) + '...');
    
    // Set auth header for subsequent requests
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    
    // Step 2: Try to add a contact with a UUID
    console.log('\n2. Adding contact with UUID...');
    
    // Generate a random UUID for testing
    const testContactId = '00000000-0000-0000-0000-000000000001';
    
    try {
      const response = await api.post('/contacts', { contactId: testContactId });
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        console.error('Request data:', error.config.data);
      }
    }
    
    // Step 3: Try to add a contact with a username
    console.log('\n3. Adding contact with username...');
    
    try {
      const response = await api.post('/contacts', { username: 'testuser' });
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        console.error('Request data:', error.config.data);
      }
    }
    
    console.log('\n=== Simple Contact Test Complete ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the test
testSimpleContact();
