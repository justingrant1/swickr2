const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test users with unique names to avoid conflicts
const user1 = {
  username: `convuser1_${Date.now()}`,
  email: `convuser1_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Conversation Test User 1'
};

const user2 = {
  username: `convuser2_${Date.now()}`,
  email: `convuser2_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Conversation Test User 2'
};

// Helper function to log detailed response information
const logResponse = (response) => {
  console.log(`Status: ${response.status}`);
  console.log(`Data: ${util.inspect(response.data, { depth: null })}`);
};

// Main function
async function testDirectConversation() {
  try {
    console.log('=== Starting Direct Conversation Test ===');
    
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
    
    // Step 2: Login with both users
    console.log('\n2. Logging in with both users...');
    
    try {
      console.log(`Attempting to login user 1: ${user1.username}`);
      const loginResponse1 = await axios.post(`${API_URL}/auth/login`, {
        username: user1.username,
        password: user1.password
      });
      
      console.log(`User 1 login response status: ${loginResponse1.status}`);
      console.log(`User 1 login response data: ${JSON.stringify(loginResponse1.data, null, 2)}`);
      
      // Extract token from response
      const user1Token = loginResponse1.data.tokens.accessToken;
      console.log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
      
      console.log(`Attempting to login user 2: ${user2.username}`);
      const loginResponse2 = await axios.post(`${API_URL}/auth/login`, {
        username: user2.username,
        password: user2.password
      });
      
      console.log(`User 2 login response status: ${loginResponse2.status}`);
      console.log(`User 2 login response data: ${JSON.stringify(loginResponse2.data, null, 2)}`);
      
      // Extract token from response
      const user2Token = loginResponse2.data.tokens.accessToken;
      console.log(`User 2 token (first 20 chars): ${user2Token.substring(0, 20)}...`);
      
      // Step 3: Add each other as contacts
      console.log('\n3. Adding contacts...');
      
      // User 1 adds User 2
      try {
        const addContactResponse1 = await axios({
          method: 'post',
          url: `${API_URL}/contacts`,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user1Token}`
          },
          data: { contactId: user2Id }
        });
        
        console.log('User 1 added User 2 as contact:');
        logResponse(addContactResponse1);
      } catch (error) {
        console.error('Error adding contact for User 1:', error.response?.status || error.message);
        console.error('Response data:', error.response?.data);
      }
      
      // User 2 adds User 1
      try {
        const addContactResponse2 = await axios({
          method: 'post',
          url: `${API_URL}/contacts`,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user2Token}`
          },
          data: { contactId: user1Id }
        });
        
        console.log('User 2 added User 1 as contact:');
        logResponse(addContactResponse2);
      } catch (error) {
        console.error('Error adding contact for User 2:', error.response?.status || error.message);
        console.error('Response data:', error.response?.data);
      }
      
      // Step 4: Create direct conversation
      console.log('\n4. Creating direct conversation...');
      
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
        
        // Step 5: Send a message in the conversation
        if (conversationId) {
          console.log('\n5. Sending a message...');
          
          try {
            const sendMessageResponse = await axios({
              method: 'post',
              url: `${API_URL}/messages`,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user1Token}`
              },
              data: {
                conversationId: conversationId,
                content: 'Hello from User 1!',
                contentType: 'text'
              }
            });
            
            console.log('Send message response:');
            logResponse(sendMessageResponse);
          } catch (error) {
            console.error('Error sending message:', error.response?.status || error.message);
            console.error('Response data:', error.response?.data);
          }
        }
      } catch (error) {
        console.error('Error creating direct conversation:', error.response?.status || error.message);
        console.error('Response data:', error.response?.data);
      }
    } catch (error) {
      console.error('Login error:', error.message);
      if (error.response) {
        console.error('Login response status:', error.response.status);
        console.error('Login response data:', error.response.data);
      }
    }
    
    console.log('\n=== Direct Conversation Test Complete ===');
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
