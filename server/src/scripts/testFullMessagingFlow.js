const axios = require('axios');
const WebSocket = require('ws');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3001';

// Test users
const user1 = {
  username: 'messagetestuser1',
  email: 'messagetest1@example.com',
  password: 'password123',
  fullName: 'Message Test User 1'
};

const user2 = {
  username: 'messagetestuser2',
  email: 'messagetest2@example.com',
  password: 'password123',
  fullName: 'Message Test User 2'
};

// Main function
async function testFullMessagingFlow() {
  try {
    console.log('=== Starting Full Messaging Flow Test ===');
    
    // Step 1: Register test users
    console.log('\n1. Registering test users...');
    
    let user1Id, user2Id, user1Token, user2Token;
    
    try {
      // Register user 1
      const registerResponse1 = await axios.post(`${API_URL}/auth/register`, user1);
      
      console.log(`User 1 registered with status: ${registerResponse1.status}`);
      user1Id = registerResponse1.data.user.id;
      console.log(`User 1 ID: ${user1Id}`);
      
      // Register user 2
      const registerResponse2 = await axios.post(`${API_URL}/auth/register`, user2);
      
      console.log(`User 2 registered with status: ${registerResponse2.status}`);
      user2Id = registerResponse2.data.user.id;
      console.log(`User 2 ID: ${user2Id}`);
    } catch (error) {
      // If registration fails due to user already existing, proceed with login
      if (error.response && error.response.status === 409) {
        console.log('One or both users already exist, proceeding with login');
      } else {
        console.error('Error registering users:', error.message);
        
        if (error.response) {
          console.error(`Response status: ${error.response.status}`);
          console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
        }
      }
    }
    
    // Step 2: Login with both users
    console.log('\n2. Logging in with test users...');
    
    try {
      // Login user 1
      const loginResponse1 = await axios.post(`${API_URL}/auth/login`, {
        username: user1.username,
        password: user1.password
      });
      
      console.log(`User 1 login successful: ${user1.username}`);
      user1Id = loginResponse1.data.user.id;
      user1Token = loginResponse1.data.tokens?.accessToken || loginResponse1.data.token;
      
      console.log(`User 1 ID: ${user1Id}`);
      console.log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
      
      // Login user 2
      const loginResponse2 = await axios.post(`${API_URL}/auth/login`, {
        username: user2.username,
        password: user2.password
      });
      
      console.log(`User 2 login successful: ${user2.username}`);
      user2Id = loginResponse2.data.user.id;
      user2Token = loginResponse2.data.tokens?.accessToken || loginResponse2.data.token;
      
      console.log(`User 2 ID: ${user2Id}`);
      console.log(`User 2 token (first 20 chars): ${user2Token.substring(0, 20)}...`);
    } catch (error) {
      console.error('Error logging in:', error.message);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
      return;
    }
    
    // Step 3: Add users as contacts
    console.log('\n3. Adding users as contacts...');
    
    try {
      // User 1 adds User 2 as contact
      const addContactResponse1 = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user1Token}`
        },
        data: { contactId: user2Id }
      });
      
      console.log(`User 1 added User 2 as contact: ${addContactResponse1.status}`);
      
      // User 2 adds User 1 as contact
      const addContactResponse2 = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user2Token}`
        },
        data: { contactId: user1Id }
      });
      
      console.log(`User 2 added User 1 as contact: ${addContactResponse2.status}`);
    } catch (error) {
      // If contacts already exist, that's okay
      if (error.response && error.response.status === 409) {
        console.log('Contacts already exist, proceeding with conversation');
      } else {
        console.error('Error adding contacts:', error.message);
        
        if (error.response) {
          console.error(`Response status: ${error.response.status}`);
          console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
        }
      }
    }
    
    // Step 4: Create conversation between users
    console.log('\n4. Creating conversation between users...');
    
    let conversationId;
    
    try {
      // Create conversation
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
      
      conversationId = createConvResponse.data.id;
      console.log(`Created conversation: ${conversationId}`);
    } catch (error) {
      console.error('Error creating conversation:', error.message);
      
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
      }
      
      // Try to get existing conversations
      try {
        console.log('Attempting to find existing conversation...');
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
          if (!conv.participants || !Array.isArray(conv.participants)) {
            return false;
          }
          
          return conv.participants.some(p => p.id === user2Id);
        });
        
        if (existingConversation) {
          conversationId = existingConversation.id;
          console.log(`Found existing conversation: ${conversationId}`);
        } else {
          console.error('No existing conversation found');
          return;
        }
      } catch (getError) {
        console.error('Error getting conversations:', getError.message);
        return;
      }
    }
    
    // Step 5: Connect to WebSocket for both users
    console.log('\n5. Connecting to WebSocket...');
    
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
    
    // Step 6: Send messages between users
    console.log('\n6. Sending messages between users...');
    
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
    
    console.log('\n=== Full Messaging Flow Test Complete ===');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
    }
  }
}

// Run the test
testFullMessagingFlow();
