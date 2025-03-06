const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test user credentials
const testUser = {
  username: 'apitestuser',
  password: 'password123'
};

// Main function
async function fixContactsAPI() {
  try {
    console.log('=== Starting Contacts API Fix Test ===');
    
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
    
    // Step 2: Try to add a contact with a UUID using a different approach
    console.log('\n2. Adding contact with UUID using a different approach...');
    
    // Generate a test UUID - using a real user ID from the database
    const testContactId = '00000000-0000-0000-0000-000000000001';
    
    try {
      // Try with different content types and request formats
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        // Try with different property name
        data: JSON.stringify({ 
          contactId: testContactId,
          // Add username as null to satisfy the validation
          username: null
        })
      });
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response data: ${util.inspect(response.data, { depth: null })}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
        console.error(`Request data: ${util.inspect(error.config.data, { depth: null })}`);
      }
    }
    
    // Step 3: Try with a different user ID format
    console.log('\n3. Adding contact with UUID in a different format...');
    
    try {
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { 
          // Try with a different property name
          contact_id: testContactId
        }
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
    
    // Step 4: Try with both contactId and username
    console.log('\n4. Adding contact with both contactId and username...');
    
    try {
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { 
          contactId: testContactId,
          username: 'testuser'
        }
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
    
    console.log('\n=== Contacts API Fix Test Complete ===');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
    }
  }
}

// Run the test
fixContactsAPI();
