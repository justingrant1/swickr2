const axios = require('axios');
const WebSocket = require('ws');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';

// Test users
const user1 = {
  username: 'contacttestuser',
  password: 'password123'
};

const user2 = {
  username: 'contactuser',
  password: 'password123'
};

// Main function
async function testMessaging() {
  try {
    console.log('=== Starting Real-time Messaging Test ===');
    
    // Step 1: Login with both test users
    console.log('\n1. Logging in with test users...');
    
    // Login user 1
    const loginResponse1 = await axios.post(`${API_URL}/auth/login`, {
      username: user1.username,
      password: user1.password
    });
    
    console.log(`User 1 login successful: ${user1.username}`);
    const user1Id = loginResponse1.data.user.id;
    const user1Token = loginResponse1.data.tokens?.accessToken || loginResponse1.data.token;
    
    // Login user 2
    const loginResponse2 = await axios.post(`${API_URL}/auth/login`, {
      username: user2.username,
      password: user2.password
    });
    
    console.log(`User 2 login successful: ${user2.username}`);
    const user2Id = loginResponse2.data.user.id;
    const user2Token = loginResponse2.data.tokens?.accessToken || loginResponse2.data.token;
    
    // Step 2: Get or create conversation between users
    console.log('\n2. Getting or creating conversation...');
    
    let conversationId;
    
    try {
      // Get user 1's conversations
      const conversationsResponse = await axios({
        method: 'get',
        url: `${API_URL}/conversations`,
        headers: {
          'Authorization': `Bearer ${user1Token}`
        }
      });
      
      console.log(`Found ${conversationsResponse.data.length} conversations for user 1`);
      
      // Look for conversation with user 2
      const existingConversation = conversationsResponse.data.find(conv => {
        // Check if participants array exists and contains user2Id
        return conv.participants && 
               Array.isArray(conv.participants) && 
               conv.participants.some(p => p.id === user2Id);
      });
      
      if (existingConversation) {
        conversationId = existingConversation.id;
        console.log(`Found existing conversation: ${conversationId}`);
      } else {
        // Create new conversation
        console.log(`Creating new conversation with participant: ${user2Id}`);
        const createConvResponse = await axios({
          method: 'post',
          url: `${API_URL}/conversations`,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user1Token}`
          },
          data: {
            participantIds: [user2Id]
          }
        });
        
        conversationId = createConvResponse.data.id;
        console.log(`Created new conversation: ${conversationId}`);
      }
    } catch (error) {
      console.error('Error with conversation:', error.message);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
      
      // Try the getOrCreateConversation endpoint directly if available
      try {
        console.log('Attempting to use getOrCreateConversation directly...');
        const directCreateResponse = await axios({
          method: 'post',
          url: `${API_URL}/conversations/direct`,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user1Token}`
          },
          data: {
            userId: user2Id
          }
        });
        
        conversationId = directCreateResponse.data.id;
        console.log(`Created conversation directly: ${conversationId}`);
      } catch (directError) {
        console.error('Direct conversation creation also failed:', directError.message);
        return;
      }
    }
    
    if (!conversationId) {
      console.error('Failed to get or create a conversation. Exiting test.');
      return;
    }
    
    // Step 3: Connect to WebSocket for both users
    console.log('\n3. Connecting to WebSocket...');
    
    // Connect user 1 to WebSocket
    const ws1 = new WebSocket(`${WS_URL}?token=${user1Token}`);
    
    ws1.on('open', () => {
      console.log('User 1 WebSocket connected');
    });
    
    ws1.on('message', (data) => {
      console.log(`User 1 received message: ${data}`);
    });
    
    ws1.on('error', (error) => {
      console.error(`User 1 WebSocket error: ${error.message}`);
    });
    
    // Connect user 2 to WebSocket
    const ws2 = new WebSocket(`${WS_URL}?token=${user2Token}`);
    
    ws2.on('open', () => {
      console.log('User 2 WebSocket connected');
    });
    
    ws2.on('message', (data) => {
      console.log(`User 2 received message: ${data}`);
    });
    
    ws2.on('error', (error) => {
      console.error(`User 2 WebSocket error: ${error.message}`);
    });
    
    // Wait for WebSocket connections to establish
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 4: Send messages between users
    console.log('\n4. Sending messages between users...');
    
    // User 1 sends message to user 2
    try {
      const sendMessageResponse = await axios({
        method: 'post',
        url: `${API_URL}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user1Token}`
        },
        data: {
          conversationId,
          content: 'Hello from User 1!',
          type: 'text'
        }
      });
      
      console.log(`User 1 sent message: ${sendMessageResponse.status}`);
    } catch (error) {
      console.error('Error sending message from user 1:', error.message);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
    }
    
    // Wait for message to be received
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // User 2 sends message to user 1
    try {
      const sendMessageResponse = await axios({
        method: 'post',
        url: `${API_URL}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user2Token}`
        },
        data: {
          conversationId,
          content: 'Hello from User 2!',
          type: 'text'
        }
      });
      
      console.log(`User 2 sent message: ${sendMessageResponse.status}`);
    } catch (error) {
      console.error('Error sending message from user 2:', error.message);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
    }
    
    // Wait for message to be received
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Close WebSocket connections
    ws1.close();
    ws2.close();
    
    console.log('\n=== Real-time Messaging Test Complete ===');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
    }
  }
}

// Run the test
testMessaging();
