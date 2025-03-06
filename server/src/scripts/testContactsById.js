const axios = require('axios');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test user credentials
const testUser = {
  username: 'apitestuser',
  password: 'password123'
};

// Main function
async function testContactsById() {
  try {
    console.log('=== Starting Contacts By ID Test ===');
    
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
    
    // Step 2: Try to add a contact with a UUID using the new endpoint
    console.log('\n2. Adding contact with UUID using /byid endpoint...');
    
    // Generate a test UUID
    const testContactId = '00000000-0000-0000-0000-000000000001';
    
    try {
      const response = await axios({
        method: 'post',
        url: `${API_URL}/contacts/byid`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        data: { contactId: testContactId }
      });
      
      console.log(`Response status: ${response.status}`);
      console.log(`Response data: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
    
    console.log('\n=== Contacts By ID Test Complete ===');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Run the test
testContactsById();
