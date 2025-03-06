const axios = require('axios');
const util = require('util');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test users with unique names to avoid conflicts
const user1 = {
  username: `flowuser1_${Date.now()}`,
  email: `flowuser1_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Flow Test User 1'
};

const user2 = {
  username: `flowuser2_${Date.now()}`,
  email: `flowuser2_${Date.now()}@example.com`,
  password: 'password123',
  fullName: 'Flow Test User 2'
};

// Helper function to log detailed response information
const logResponse = (response) => {
  console.log(`Status: ${response.status}`);
  console.log(`Data: ${util.inspect(response.data, { depth: null })}`);
};

// Main function
async function testFullMessagingFlow() {
  try {
    console.log('=== Starting Full Messaging Flow Test ===');
    
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
    
    // Step 3: Add contacts
    console.log('\n3. Adding contacts...');
    
    // User 1 adds User 2 by ID
    console.log('\n3.1 User 1 adds User 2 by ID...');
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
    
    // User 2 adds User 1 by username
    console.log('\n3.2 User 2 adds User 1 by username...');
    try {
      const addContactByUsernameResponse = await axios({
        method: 'post',
        url: `${API_URL}/contacts`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user2Token}`
        },
        data: { username: user1.username }
      });
      
      console.log('Add contact by username response:');
      logResponse(addContactByUsernameResponse);
    } catch (error) {
      console.error('Error adding contact by username:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
    }
    
    // Step 4: Get contacts
    console.log('\n4. Getting contacts...');
    
    // User 1 gets contacts
    console.log('\n4.1 User 1 gets contacts...');
    try {
      const getContactsResponse1 = await axios({
        method: 'get',
        url: `${API_URL}/contacts`,
        headers: {
          'Authorization': `Bearer ${user1Token}`
        }
      });
      
      console.log('User 1 contacts:');
      logResponse(getContactsResponse1);
    } catch (error) {
      console.error('Error getting contacts for User 1:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
    }
    
    // User 2 gets contacts
    console.log('\n4.2 User 2 gets contacts...');
    try {
      const getContactsResponse2 = await axios({
        method: 'get',
        url: `${API_URL}/contacts`,
        headers: {
          'Authorization': `Bearer ${user2Token}`
        }
      });
      
      console.log('User 2 contacts:');
      logResponse(getContactsResponse2);
    } catch (error) {
      console.error('Error getting contacts for User 2:', error.response?.status || error.message);
      console.error('Response data:', error.response?.data);
    }
    
    // Step 5: Create direct conversation
    console.log('\n5. Creating direct conversation...');
    
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
    }
    
    // Step 6: Send a message in the conversation
    if (conversationId) {
      console.log('\n6. Sending messages...');
      
      // User 1 sends message
      console.log('\n6.1 User 1 sends message...');
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
            content: 'Hello from User 1!',
            contentType: 'text'
          }
        });
        
        console.log('User 1 send message response:');
        logResponse(sendMessageResponse1);
      } catch (error) {
        console.error('Error sending message from User 1:', error.response?.status || error.message);
        console.error('Response data:', error.response?.data);
      }
      
      // User 2 sends message
      console.log('\n6.2 User 2 sends message...');
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
            content: 'Hello from User 2!',
            contentType: 'text'
          }
        });
        
        console.log('User 2 send message response:');
        logResponse(sendMessageResponse2);
      } catch (error) {
        console.error('Error sending message from User 2:', error.response?.status || error.message);
        console.error('Response data:', error.response?.data);
      }
      
      // Step 7: Get messages
      console.log('\n7. Getting messages...');
      
      try {
        const getMessagesResponse = await axios({
          method: 'get',
          url: `${API_URL}/messages/${conversationId}`,
          headers: {
            'Authorization': `Bearer ${user1Token}`
          }
        });
        
        console.log('Get messages response:');
        logResponse(getMessagesResponse);
      } catch (error) {
        console.error('Error getting messages:', error.response?.status || error.message);
        console.error('Response data:', error.response?.data);
      }
    }
    
    console.log('\n=== Full Messaging Flow Test Complete ===');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testFullMessagingFlow();
