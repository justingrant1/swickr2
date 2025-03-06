/**
 * Swickr Messaging Test Script
 * 
 * This script tests the messaging functionality by:
 * 1. Creating two test users
 * 2. Establishing WebSocket connections for both users
 * 3. Sending messages between the users
 * 4. Verifying message delivery
 */

const axios = require('axios');
const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_URL = 'http://localhost:3004/api';
const SOCKET_URL = 'http://localhost:3004';

// Test users
const user1 = {
  username: 'testuser1',
  email: 'testuser1@example.com',
  password: 'Test@123',
  displayName: 'Test User 1'
};

const user2 = {
  username: 'testuser2',
  email: 'testuser2@example.com',
  password: 'Test@123',
  displayName: 'Test User 2'
};

// Store user tokens and socket connections
let user1Token = null;
let user2Token = null;
let user1Socket = null;
let user2Socket = null;
let user1Id = null;
let user2Id = null;

// Test messages
const testMessages = [
  'Hello from User 1!',
  'Hi there, User 1! How are you?',
  'I\'m doing great! Just testing this messaging app.',
  'It seems to be working well!'
];

// Helper function to register a user
async function registerUser(userData) {
  try {
    console.log(`Attempting to register user: ${userData.username}`);
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    console.log(`User registered successfully: ${userData.username}`);
    return response.data;
  } catch (error) {
    console.error(`Registration error for ${userData.username}:`, error.response?.data || error.message);
    throw error;
  }
}

// Helper function to login a user
async function loginUser(credentials) {
  try {
    console.log(`Attempting to login user: ${credentials.username}`);
    const response = await axios.post(`${API_URL}/auth/login`, credentials);
    console.log(`User logged in successfully: ${credentials.username}`);
    return response.data;
  } catch (error) {
    console.error(`Login error for ${credentials.username}:`, error.response?.data || error.message);
    throw error;
  }
}

// Helper function to connect to WebSocket
function connectSocket(token, userId, username) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log(`Socket connected for user: ${username}`);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error(`Socket connection error for ${username}:`, error);
      reject(error);
    });

    // Set a timeout in case connection takes too long
    setTimeout(() => {
      if (!socket.connected) {
        reject(new Error(`Connection timeout for ${username}`));
      }
    }, 5000);
  });
}

// Helper function to send a message
function sendMessage(socket, senderId, recipientId, content) {
  return new Promise((resolve) => {
    const messageId = uuidv4();
    console.log(`Sending message from ${senderId} to ${recipientId}: ${content}`);
    
    socket.emit('message:send', {
      messageId,
      recipientId,
      content,
      messageType: 'text'
    });
    
    resolve(messageId);
  });
}

// Main test function
async function runTest() {
  try {
    console.log('=== Starting Swickr Messaging Test ===');
    
    // Step 1: Register users or login if they already exist
    try {
      const user1Data = await registerUser(user1);
      user1Id = user1Data.user.id;
      user1Token = user1Data.tokens.accessToken;
    } catch (error) {
      // If registration fails, try logging in
      const user1Data = await loginUser({ username: user1.username, password: user1.password });
      user1Id = user1Data.user.id;
      user1Token = user1Data.tokens.accessToken;
    }
    
    try {
      const user2Data = await registerUser(user2);
      user2Id = user2Data.user.id;
      user2Token = user2Data.tokens.accessToken;
    } catch (error) {
      // If registration fails, try logging in
      const user2Data = await loginUser({ username: user2.username, password: user2.password });
      user2Id = user2Data.user.id;
      user2Token = user2Data.tokens.accessToken;
    }
    
    console.log('Users registered/logged in successfully');
    console.log(`User 1 ID: ${user1Id}`);
    console.log(`User 2 ID: ${user2Id}`);
    
    // Step 2: Connect to WebSocket
    try {
      user1Socket = await connectSocket(user1Token, user1Id, user1.username);
      user2Socket = await connectSocket(user2Token, user2Id, user2.username);
      console.log('WebSocket connections established for both users');
    } catch (error) {
      console.error('Failed to establish WebSocket connections:', error);
      process.exit(1);
    }
    
    // Step 3: Set up message listeners
    const receivedMessages = {
      user1: [],
      user2: []
    };
    
    user1Socket.on('message:received', (message) => {
      console.log(`User 1 received message: ${message.content}`);
      receivedMessages.user1.push(message);
    });
    
    user2Socket.on('message:received', (message) => {
      console.log(`User 2 received message: ${message.content}`);
      receivedMessages.user2.push(message);
    });
    
    // Step 4: Send test messages
    console.log('=== Sending Test Messages ===');
    
    // User 1 sends a message to User 2
    await sendMessage(user1Socket, user1Id, user2Id, testMessages[0]);
    
    // Wait for message to be delivered
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // User 2 sends a message to User 1
    await sendMessage(user2Socket, user2Id, user1Id, testMessages[1]);
    
    // Wait for message to be delivered
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // User 1 sends another message to User 2
    await sendMessage(user1Socket, user1Id, user2Id, testMessages[2]);
    
    // Wait for message to be delivered
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // User 2 sends another message to User 1
    await sendMessage(user2Socket, user2Id, user1Id, testMessages[3]);
    
    // Wait for all messages to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 5: Verify message delivery
    console.log('=== Verifying Message Delivery ===');
    console.log(`User 1 received ${receivedMessages.user1.length} messages`);
    console.log(`User 2 received ${receivedMessages.user2.length} messages`);
    
    const expectedMessagesUser1 = [testMessages[1], testMessages[3]];
    const expectedMessagesUser2 = [testMessages[0], testMessages[2]];
    
    const user1Success = receivedMessages.user1.length === expectedMessagesUser1.length;
    const user2Success = receivedMessages.user2.length === expectedMessagesUser2.length;
    
    if (user1Success && user2Success) {
      console.log('✅ All messages were delivered successfully!');
    } else {
      console.log('❌ Some messages were not delivered correctly.');
      if (!user1Success) {
        console.log(`User 1 should have received ${expectedMessagesUser1.length} messages but got ${receivedMessages.user1.length}`);
      }
      if (!user2Success) {
        console.log(`User 2 should have received ${expectedMessagesUser2.length} messages but got ${receivedMessages.user2.length}`);
      }
    }
    
    // Step 6: Disconnect sockets
    user1Socket.disconnect();
    user2Socket.disconnect();
    console.log('WebSocket connections closed');
    
    console.log('=== Messaging Test Completed ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
runTest();
