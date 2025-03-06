const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test users with unique names to avoid conflicts
const user1 = {
  username: `debuguser1_${Date.now()}`,
  email: `debuguser1_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Debug Test User 1'
};

const user2 = {
  username: `debuguser2_${Date.now()}`,
  email: `debuguser2_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Debug Test User 2'
};

// Helper function to log detailed response information
const logResponse = (response) => {
  console.log(`Status: ${response.status}`);
  console.log(`Headers: ${util.inspect(response.headers, { depth: null })}`);
  console.log(`Data: ${util.inspect(response.data, { depth: null })}`);
};

// Helper function to log detailed error information
const logError = (error) => {
  console.error(`Error: ${error.message}`);
  
  if (error.response) {
    console.error(`Response status: ${error.response.status}`);
    console.error(`Response headers: ${util.inspect(error.response.headers, { depth: null })}`);
    console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
  }
  
  if (error.request) {
    console.error('Request was made but no response was received');
  }
  
  console.error(`Error stack: ${error.stack}`);
};

// Main function
async function debugConversationCreation() {
  try {
    console.log('=== Starting Conversation Creation Debug ===');
    
    // Step 1: Register test users
    console.log('\n1. Registering test users...');
    
    let user1Id, user2Id, user1Token;
    
    try {
      // Register user 1
      const registerResponse1 = await axios.post(`${API_URL}/auth/register`, user1);
      console.log(`User 1 registered with status: ${registerResponse1.status}`);
      user1Id = registerResponse1.data.user.id;
      console.log(`User 1 ID: ${user1Id}`);
    } catch (error) {
      console.error('Error registering user 1:');
      logError(error);
      return;
    }
    
    try {
      // Register user 2
      const registerResponse2 = await axios.post(`${API_URL}/auth/register`, user2);
      console.log(`User 2 registered with status: ${registerResponse2.status}`);
      user2Id = registerResponse2.data.user.id;
      console.log(`User 2 ID: ${user2Id}`);
    } catch (error) {
      console.error('Error registering user 2:');
      logError(error);
      return;
    }
    
    // Step 2: Login with user 1
    console.log('\n2. Logging in with user 1...');
    
    try {
      const loginResponse1 = await axios.post(`${API_URL}/auth/login`, {
        username: user1.username,
        password: user1.password
      });
      
      console.log(`User 1 login successful: ${user1.username}`);
      user1Token = loginResponse1.data.tokens?.accessToken || loginResponse1.data.token;
      console.log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
    } catch (error) {
      console.error('Error logging in user 1:');
      logError(error);
      return;
    }
    
    // Step 3: Create conversation between users
    console.log('\n3. Creating conversation between users...');
    
    try {
      console.log(`Request data: ${util.inspect({
        participantIds: [user2Id],
        isGroup: false
      }, { depth: null })}`);
      
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
      
      console.log('Conversation creation response:');
      logResponse(createConvResponse);
      
      if (createConvResponse.data && createConvResponse.data.id) {
        const conversationId = createConvResponse.data.id;
        console.log(`Created conversation ID: ${conversationId}`);
        
        // Step 4: Get conversation details
        console.log('\n4. Getting conversation details...');
        
        try {
          const getConvResponse = await axios({
            method: 'get',
            url: `${API_URL}/conversations/${conversationId}`,
            headers: {
              'Authorization': `Bearer ${user1Token}`
            }
          });
          
          console.log('Conversation details response:');
          logResponse(getConvResponse);
        } catch (error) {
          console.error('Error getting conversation details:');
          logError(error);
        }
      } else {
        console.error('Conversation creation succeeded but no conversation ID was returned');
        console.log(`Response data: ${util.inspect(createConvResponse.data, { depth: null })}`);
      }
    } catch (error) {
      console.error('Error creating conversation:');
      logError(error);
    }
    
    console.log('\n=== Conversation Creation Debug Complete ===');
  } catch (error) {
    console.error(`Test failed with unexpected error: ${error.message}`);
    console.error(error.stack);
  }
}

// Run the debug function
debugConversationCreation();
