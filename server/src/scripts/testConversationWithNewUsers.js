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

// Main function
async function testConversationWithNewUsers() {
  try {
    console.log('=== Starting Conversation Test with New Users ===');
    
    // Step 1: Register test users
    console.log('\n1. Registering test users...');
    
    let user1Id, user2Id, user1Token;
    
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
    
    // Step 2: Login with user 1
    console.log('\n2. Logging in with user 1...');
    
    const loginResponse1 = await axios.post(`${API_URL}/auth/login`, {
      username: user1.username,
      password: user1.password
    });
    
    console.log(`User 1 login successful: ${user1.username}`);
    user1Token = loginResponse1.data.tokens?.accessToken || loginResponse1.data.token;
    
    console.log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
    
    // Step 3: Add users as contacts
    console.log('\n3. Adding users as contacts...');
    
    // User 1 adds User 2 as contact
    const addContactResponse = await axios({
      method: 'post',
      url: `${API_URL}/contacts`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      data: { contactId: user2Id }
    });
    
    console.log(`User 1 added User 2 as contact: ${addContactResponse.status}`);
    
    // Step 4: Create conversation between users
    console.log('\n4. Creating conversation between users...');
    
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
    
    // Step 5: Get conversation details
    console.log('\n5. Getting conversation details...');
    
    const getConvResponse = await axios({
      method: 'get',
      url: `${API_URL}/conversations/${conversationId}`,
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    
    console.log(`Response status: ${getConvResponse.status}`);
    console.log(`Response data: ${util.inspect(getConvResponse.data, { depth: null })}`);
    
    // Step 6: Send a message in the conversation
    console.log('\n6. Sending a message in the conversation...');
    
    const sendMessageResponse = await axios({
      method: 'post',
      url: `${API_URL}/messages`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      data: {
        conversationId,
        content: 'Hello! This is a test message.',
        type: 'text'
      }
    });
    
    console.log(`Message sent with status: ${sendMessageResponse.status}`);
    console.log(`Message data: ${util.inspect(sendMessageResponse.data, { depth: null })}`);
    
    // Step 7: Get messages in the conversation
    console.log('\n7. Getting messages in the conversation...');
    
    const getMessagesResponse = await axios({
      method: 'get',
      url: `${API_URL}/messages/${conversationId}`,
      headers: {
        'Authorization': `Bearer ${user1Token}`
      }
    });
    
    console.log(`Got messages with status: ${getMessagesResponse.status}`);
    console.log(`Messages: ${util.inspect(getMessagesResponse.data, { depth: null })}`);
    
    console.log('\n=== Conversation Test with New Users Complete ===');
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${util.inspect(error.response.data, { depth: null })}`);
    }
  }
}

// Run the test
testConversationWithNewUsers();
