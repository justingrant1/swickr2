const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test users with unique names to avoid conflicts
const user1 = {
  username: `directuser1_${Date.now()}`,
  email: `directuser1_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Direct Test User 1'
};

const user2 = {
  username: `directuser2_${Date.now()}`,
  email: `directuser2_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Direct Test User 2'
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
    
    // Step 2: Login with user 1
    console.log('\n2. Logging in with user 1...');
    
    const loginResponse1 = await axios.post(`${API_URL}/auth/login`, {
      username: user1.username,
      password: user1.password
    });
    
    console.log(`User 1 login successful: ${user1.username}`);
    const user1Token = loginResponse1.data.tokens?.accessToken || loginResponse1.data.token;
    console.log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
    
    // Step 3: Create direct conversation
    console.log('\n3. Creating direct conversation...');
    
    try {
      const createDirectConvResponse = await axios({
        method: 'post',
        url: `${API_URL}/conversations/direct`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user1Token}`
        },
        data: { userId: user2Id }
      });
      
      console.log('Direct conversation creation response:');
      logResponse(createDirectConvResponse);
      
      if (createDirectConvResponse.data && createDirectConvResponse.data.id) {
        const conversationId = createDirectConvResponse.data.id;
        console.log(`Created direct conversation ID: ${conversationId}`);
        
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
          
          // Step 5: Send a message in the conversation
          console.log('\n5. Sending a message in the conversation...');
          
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
                content: 'Hello from the direct conversation test!'
              }
            });
            
            console.log('Send message response:');
            logResponse(sendMessageResponse);
            
            console.log('\nDirect conversation test completed successfully!');
          } catch (error) {
            console.error('Error sending message:', error.response?.status || error.message);
            console.error('Response data:', error.response?.data);
          }
        } catch (error) {
          console.error('Error getting conversation details:', error.response?.status || error.message);
          console.error('Response data:', error.response?.data);
        }
      } else {
        console.error('Direct conversation creation succeeded but no conversation ID was returned');
      }
    } catch (error) {
      console.error('Error creating direct conversation:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
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
