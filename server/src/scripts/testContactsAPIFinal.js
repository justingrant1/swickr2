const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test users with unique names to avoid conflicts
const user1 = {
  username: `contactuser1_${Date.now()}`,
  email: `contactuser1_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Contact Test User 1'
};

const user2 = {
  username: `contactuser2_${Date.now()}`,
  email: `contactuser2_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Contact Test User 2'
};

// Helper function to log detailed response information
const logResponse = (response) => {
  console.log(`Status: ${response.status}`);
  console.log(`Data: ${util.inspect(response.data, { depth: null })}`);
};

// Main function
async function testContactsAPI() {
  try {
    console.log('=== Starting Contacts API Test ===');
    
    // Step 1: Register test users
    console.log('\n1. Registering test users...');
    
    // Register user 1
    const registerResponse1 = await axios.post(`${API_URL}/auth/register`, user1);
    console.log(`User 1 registered with status: ${registerResponse1.status}`);
    const user1Id = registerResponse1.data.user.id;
    console.log(`User 1 ID: ${user1Id}`);
    
    // Register user 2
    const registerResponse2 = await axios.post(`${API_URL}/auth/register`, user2);
    console.log(`User 2 registered with status: ${registerResponse2.status}`);
    const user2Id = registerResponse2.data.user.id;
    console.log(`User 2 ID: ${user2Id}`);
    
    // Step 2: Login with user 1
    console.log('\n2. Logging in with user 1...');
    
    const loginResponse1 = await axios.post(`${API_URL}/auth/login`, {
      username: user1.username,
      password: user1.password
    });
    
    console.log(`User 1 login successful: ${user1.username}`);
    const user1Token = loginResponse1.data.tokens?.accessToken || loginResponse1.data.token;
    console.log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
    
    // Step 3: Add contact by ID
    console.log('\n3. Adding contact by ID...');
    
    try {
      const addContactByIdResponse = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user1Token}`
        },
        data: { contactId: user2Id }
      });
      
      console.log('Add contact by ID response:');
      logResponse(addContactByIdResponse);
    } catch (error) {
      console.error('Error adding contact by ID:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
    }
    
    // Step 4: Add contact by username
    console.log('\n4. Adding contact by username...');
    
    try {
      const addContactByUsernameResponse = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user1Token}`
        },
        data: { username: user2.username }
      });
      
      console.log('Add contact by username response:');
      logResponse(addContactByUsernameResponse);
    } catch (error) {
      console.error('Error adding contact by username:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
    }
    
    // Step 5: Get contacts
    console.log('\n5. Getting contacts...');
    
    try {
      const getContactsResponse = await axios({
        method: 'get',
        url: `${API_URL}/contacts`,
        headers: {
          'Authorization': `Bearer ${user1Token}`
        }
      });
      
      console.log('Get contacts response:');
      logResponse(getContactsResponse);
    } catch (error) {
      console.error('Error getting contacts:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
    }
    
    console.log('\n=== Contacts API Test Complete ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testContactsAPI();
