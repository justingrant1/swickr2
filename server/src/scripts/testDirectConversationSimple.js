const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test users with unique names to avoid conflicts
const user1 = {
  username: `simpleuser1_${Date.now()}`,
  email: `simpleuser1_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Simple Test User 1'
};

const user2 = {
  username: `simpleuser2_${Date.now()}`,
  email: `simpleuser2_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Simple Test User 2'
};

// Helper function to log detailed response information
const logResponse = (response) => {
  console.log(`Status: ${response.status}`);
  console.log(`Data: ${util.inspect(response.data, { depth: null })}`);
};

// Main function
async function testDirectConversation() {
  try {
    console.log('=== Starting Simple Direct Conversation Test ===');
    
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
    
    console.log(`User 1 login successful with status: ${loginResponse1.status}`);
    const user1Token = loginResponse1.data.tokens.accessToken;
    console.log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
    
    // Step 3: Create direct conversation
    console.log('\n3. Creating direct conversation...');
    
    try {
      const createConversationResponse = await axios({
        method: 'post',
        url: `${API_URL}/conversations/direct`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user1Token}`
        },
        data: { userId: user2Id }
      });
      
      console.log('Create direct conversation response:');
      logResponse(createConversationResponse);
      
      const conversationId = createConversationResponse.data.id;
      console.log(`Conversation ID: ${conversationId}`);
      
      console.log('\n=== Simple Direct Conversation Test Complete ===');
    } catch (error) {
      console.error('Error creating direct conversation:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testDirectConversation();
