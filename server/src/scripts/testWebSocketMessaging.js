const axios = require('axios');
const io = require('socket.io-client');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

// Test users with unique names to avoid conflicts
const user1 = {
  username: `wsuser1_${Date.now()}`,
  email: `wsuser1_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'WebSocket Test User 1'
};

const user2 = {
  username: `wsuser2_${Date.now()}`,
  email: `wsuser2_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'WebSocket Test User 2'
};

// Helper function to log detailed response information
const logResponse = (response) => {
  console.log(`Status: ${response.status}`);
  console.log(`Data: ${util.inspect(response.data, { depth: null })}`);
};

// Main function
async function testWebSocketMessaging() {
  try {
    console.log('=== Starting WebSocket Messaging Test ===');
    
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
    
    // Login user 1
    const loginResponse1 = await axios.post(`${API_URL}/auth/login`, {
      username: user1.username,
      password: user1.password
    });
    
    console.log(`User 1 login successful with status: ${loginResponse1.status}`);
    const user1Token = loginResponse1.data.tokens.accessToken;
    console.log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
    
    // Login user 2
    const loginResponse2 = await axios.post(`${API_URL}/auth/login`, {
      username: user2.username,
      password: user2.password
    });
    
    console.log(`User 2 login successful with status: ${loginResponse2.status}`);
    const user2Token = loginResponse2.data.tokens.accessToken;
    console.log(`User 2 token (first 20 chars): ${user2Token.substring(0, 20)}...`);
    
    // Step 3: Create direct conversation
    console.log('\n3. Creating direct conversation...');
    
    let conversationId;
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
      
      conversationId = createConversationResponse.data.id;
      console.log(`Conversation ID: ${conversationId}`);
    } catch (error) {
      console.error('Error creating direct conversation:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
      return;
    }
    
    // Step 4: Connect to WebSocket
    console.log('\n4. Connecting to WebSocket...');
    
    // Connect user 1 to WebSocket
    const socket1 = io(SOCKET_URL, {
      auth: {
        token: user1Token
      },
      transports: ['websocket']
    });
    
    // Connect user 2 to WebSocket
    const socket2 = io(SOCKET_URL, {
      auth: {
        token: user2Token
      },
      transports: ['websocket']
    });
    
    // Set up event listeners for user 1
    socket1.on('connect', () => {
      console.log(`User 1 connected to WebSocket with ID: ${socket1.id}`);
    });
    
    socket1.on('connect_error', (error) => {
      console.error('User 1 WebSocket connection error:', error.message);
    });
    
    socket1.on('message', (message) => {
      console.log(`User 1 received message: ${util.inspect(message, { depth: null })}`);
    });
    
    // Set up event listeners for user 2
    socket2.on('connect', () => {
      console.log(`User 2 connected to WebSocket with ID: ${socket2.id}`);
    });
    
    socket2.on('connect_error', (error) => {
      console.error('User 2 WebSocket connection error:', error.message);
    });
    
    socket2.on('message', (message) => {
      console.log(`User 2 received message: ${util.inspect(message, { depth: null })}`);
    });
    
    // Wait for both sockets to connect
    await new Promise((resolve) => {
      let connectedCount = 0;
      
      const checkConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          resolve();
        }
      };
      
      socket1.on('connect', checkConnected);
      socket2.on('connect', checkConnected);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (connectedCount < 2) {
          console.warn(`Only ${connectedCount}/2 users connected to WebSocket`);
          resolve();
        }
      }, 5000);
    });
    
    // Step 5: Send messages via REST API and verify WebSocket notifications
    console.log('\n5. Sending messages via REST API...');
    
    // User 1 sends message
    console.log('\n5.1 User 1 sends message...');
    try {
      const sendMessageResponse1 = await axios({
        method: 'post',
        url: `${API_URL}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user1Token}`
        },
        data: {
          conversationId: conversationId,
          content: 'Hello from User 1 via WebSocket!',
          contentType: 'text'
        }
      });
      
      console.log('User 1 send message response:');
      logResponse(sendMessageResponse1);
    } catch (error) {
      console.error('Error sending message from User 1:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
    }
    
    // Wait for WebSocket notification
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // User 2 sends message
    console.log('\n5.2 User 2 sends message...');
    try {
      const sendMessageResponse2 = await axios({
        method: 'post',
        url: `${API_URL}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user2Token}`
        },
        data: {
          conversationId: conversationId,
          content: 'Hello from User 2 via WebSocket!',
          contentType: 'text'
        }
      });
      
      console.log('User 2 send message response:');
      logResponse(sendMessageResponse2);
    } catch (error) {
      console.error('Error sending message from User 2:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
    }
    
    // Wait for WebSocket notification
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 6: Clean up
    console.log('\n6. Cleaning up...');
    
    socket1.disconnect();
    socket2.disconnect();
    
    console.log('\n=== WebSocket Messaging Test Complete ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testWebSocketMessaging();
