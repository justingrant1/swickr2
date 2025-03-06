const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test user credentials
const testUser = {
  username: 'testuser1',
  password: 'password123'
};

// Main function
async function verifyContactsAPI() {
  try {
    console.log('=== Starting Contacts API Verification ===');
    
    // Step 1: Login to get auth token
    console.log('\n1. Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      username: testUser.username,
      password: testUser.password
    });
    
    console.log('Login successful');
    
    // Extract user ID and token
    const userId = loginResponse.data.user.id;
    const authToken = loginResponse.data.tokens?.accessToken || loginResponse.data.token;
    
    console.log(`User ID: ${userId}`);
    console.log(`Auth token (first 20 chars): ${authToken.substring(0, 20)}...`);
    
    // Step 2: Try to add a contact with a UUID (camelCase)
    console.log('\n2. Adding contact with UUID (camelCase)...');
    
    // Generate a test UUID
    const testContactId = '00000000-0000-0000-0000-000000000001';
    
    try {
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { contactId: testContactId }
      });
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response data: ${util.inspect(response.data, { depth: null })}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
    }
    
    // Step 3: Try to add a contact with a UUID (snake_case)
    console.log('\n3. Adding contact with UUID (snake_case)...');
    
    try {
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { contact_id: testContactId }
      });
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response data: ${util.inspect(response.data, { depth: null })}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
    }
    
    // Step 4: Try to add a contact with a username
    console.log('\n4. Adding contact with username...');
    
    try {
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { username: 'testuser' }
      });
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response data: ${util.inspect(response.data, { depth: null })}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
    }
    
    console.log('\n=== Contacts API Verification Complete ===');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
    }
  }
}

// Run the test
verifyContactsAPI();
