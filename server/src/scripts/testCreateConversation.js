const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test users - using existing test users from the database
const user1 = {
  username: 'testuser1',
  password: 'password123'
};

const user2 = {
  username: 'testuser2',
  password: 'password123'
};

// Main function
async function testCreateConversation() {
  try {
    console.log('=== Starting Conversation Creation Test ===');
    
    // Step 1: Login with both users
    console.log('\n1. Logging in with test users...');
    
    // Login user 1
    const loginResponse1 = await axios.post(`${API_URL}/auth/login`, {
      username: user1.username,
      password: user1.password
    });
    
    console.log(`User 1 login successful: ${user1.username}`);
    const user1Id = loginResponse1.data.user.id;
    const user1Token = loginResponse1.data.tokens?.accessToken || loginResponse1.data.token;
    
    console.log(`User 1 ID: ${user1Id}`);
    console.log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
    
    // Login user 2
    const loginResponse2 = await axios.post(`${API_URL}/auth/login`, {
      username: user2.username,
      password: user2.password
    });
    
    console.log(`User 2 login successful: ${user2.username}`);
    const user2Id = loginResponse2.data.user.id;
    
    console.log(`User 2 ID: ${user2Id}`);
    
    // Step 2: Create conversation between users
    console.log('\n2. Creating conversation between users...');
    
    try {
      const createConvResponse = await axios({
        method: 'post',
        url: `${API_URL}/conversations`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user1Token}`
        },
        data: {
          participantIds: [user2Id],
          isGroup: false
        }
      });
      
      console.log(`Response status: ${createConvResponse.status}`);
      console.log(`Response data: ${util.inspect(createConvResponse.data, { depth: null })}`);
      
      const conversationId = createConvResponse.data.id;
      console.log(`Created conversation ID: ${conversationId}`);
      
      // Step 3: Get conversation details
      console.log('\n3. Getting conversation details...');
      
      const getConvResponse = await axios({
        method: 'get',
        url: `${API_URL}/conversations/${conversationId}`,
        headers: {
          'Authorization': `Bearer ${user1Token}`
        }
      });
      
      console.log(`Response status: ${getConvResponse.status}`);
      console.log(`Response data: ${util.inspect(getConvResponse.data, { depth: null })}`);
      
    } catch (error) {
      console.error('Error creating or getting conversation:', error.message);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
    }
    
    console.log('\n=== Conversation Creation Test Complete ===');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
    }
  }
}

// Run the test
testCreateConversation();
