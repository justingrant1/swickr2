/**
 * WebSocket Integration Test Script
 * 
 * This script tests the complete WebSocket integration for Swickr's real-time messaging.
 * It tests the following functionality:
 * 1. User registration and authentication
 * 2. WebSocket connection with authentication
 * 3. Direct messaging between users
 * 4. Conversation messaging
 * 5. Typing indicators
 * 6. Read receipts
 * 7. User status updates
 */

const axios = require('axios');
const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';

// Test users
const testUsers = [
  {
    username: `test_user1_${Date.now()}`,
    email: `test_user1_${Date.now()}@example.com`,
    password: 'Password123!',
    fullName: 'Test User 1'
  },
  {
    username: `test_user2_${Date.now()}`,
    email: `test_user2_${Date.now()}@example.com`,
    password: 'Password123!',
    fullName: 'Test User 2'
  }
];

// Test data
let user1 = null;
let user2 = null;
let user1Token = null;
let user2Token = null;
let user1Socket = null;
let user2Socket = null;
let conversationId = null;

// API client
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Set auth token for API requests
const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// Helper to wait for a specific time
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Log with timestamp
const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

// Register a user
const registerUser = async (userData) => {
  try {
    const response = await api.post('/users/register', userData);
    log(`User ${userData.username} registered with status: ${response.status}`);
    return response.data;
  } catch (error) {
    log(`Error registering user ${userData.username}: ${error.message}`);
    if (error.response) {
      log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

// Login a user
const loginUser = async (username, password) => {
  try {
    const response = await api.post('/users/login', { username, password });
    log(`User ${username} login successful with status: ${response.status}`);
    return response.data;
  } catch (error) {
    log(`Error logging in user ${username}: ${error.message}`);
    if (error.response) {
      log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

// Create a direct conversation between two users
const createDirectConversation = async (user1Id, user2Id) => {
  try {
    setAuthToken(user1Token);
    const response = await api.post('/messages/conversations', {
      participantIds: [user2Id]
    });
    log(`Create direct conversation response:`);
    log(`Status: ${response.status}`);
    log(`Data: ${JSON.stringify(response.data, null, 2)}`);
    return response.data;
  } catch (error) {
    log(`Error creating conversation: ${error.message}`);
    if (error.response) {
      log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

// Send a message via REST API
const sendMessage = async (token, conversationId, content) => {
  try {
    setAuthToken(token);
    const response = await api.post('/messages', {
      conversationId,
      content
    });
    log(`Send message response:`);
    log(`Status: ${response.status}`);
    log(`Data: ${JSON.stringify(response.data, null, 2)}`);
    return response.data;
  } catch (error) {
    log(`Error sending message: ${error.message}`);
    if (error.response) {
      log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
};

// Connect to WebSocket
const connectWebSocket = (token) => {
  return new Promise((resolve, reject) => {
    try {
      const socket = io(SOCKET_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });

      socket.on('connect', () => {
        log(`Connected to WebSocket with ID: ${socket.id}`);
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        log(`WebSocket connection error: ${error.message}`);
        reject(error);
      });

      // Set a timeout in case connection hangs
      setTimeout(() => {
        if (!socket.connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    } catch (error) {
      log(`Error creating WebSocket connection: ${error.message}`);
      reject(error);
    }
  });
};

// Setup WebSocket event listeners
const setupSocketListeners = (socket, username) => {
  socket.on('message', (data) => {
    log(`[${username}] Received message: ${JSON.stringify(data)}`);
  });

  socket.on('private-message', (data) => {
    log(`[${username}] Received private message: ${JSON.stringify(data)}`);
  });

  socket.on('conversation-message', (data) => {
    log(`[${username}] Received conversation message: ${JSON.stringify(data)}`);
  });

  socket.on('typing', (data) => {
    log(`[${username}] Typing indicator: ${JSON.stringify(data)}`);
  });

  socket.on('read-receipt', (data) => {
    log(`[${username}] Read receipt: ${JSON.stringify(data)}`);
  });

  socket.on('user-status', (data) => {
    log(`[${username}] User status update: ${JSON.stringify(data)}`);
  });

  socket.on('disconnect', (reason) => {
    log(`[${username}] Disconnected from WebSocket: ${reason}`);
  });

  socket.on('error', (error) => {
    log(`[${username}] WebSocket error: ${error.message}`);
  });
};

// Run the test
const runTest = async () => {
  try {
    log('=== Starting WebSocket Integration Test ===');

    // 1. Register test users
    log('\n1. Registering test users...');
    user1 = await registerUser(testUsers[0]);
    user2 = await registerUser(testUsers[1]);
    log(`User 1 ID: ${user1.id}`);
    log(`User 2 ID: ${user2.id}`);

    // 2. Login with both users
    log('\n2. Logging in with both users...');
    const user1Auth = await loginUser(testUsers[0].username, testUsers[0].password);
    const user2Auth = await loginUser(testUsers[1].username, testUsers[1].password);
    
    user1Token = user1Auth.token;
    user2Token = user2Auth.token;
    log(`User 1 token (first 20 chars): ${user1Token.substring(0, 20)}...`);
    log(`User 2 token (first 20 chars): ${user2Token.substring(0, 20)}...`);

    // 3. Create direct conversation
    log('\n3. Creating direct conversation...');
    const conversation = await createDirectConversation(user1.id, user2.id);
    conversationId = conversation.id;
    log(`Conversation ID: ${conversationId}`);

    // 4. Connect to WebSocket
    log('\n4. Connecting to WebSocket...');
    user1Socket = await connectWebSocket(user1Token);
    user2Socket = await connectWebSocket(user2Token);
    
    // Setup event listeners
    setupSocketListeners(user1Socket, testUsers[0].username);
    setupSocketListeners(user2Socket, testUsers[1].username);

    // 5. Test WebSocket functionality
    log('\n5. Testing WebSocket functionality...');

    // 5.1 Join conversation
    log('\n5.1 Joining conversation...');
    user1Socket.emit('join-conversation', { conversationId });
    user2Socket.emit('join-conversation', { conversationId });
    await wait(1000);

    // 5.2 Send typing indicator
    log('\n5.2 Sending typing indicators...');
    user1Socket.emit('typing', { conversationId, isTyping: true });
    await wait(2000);
    user1Socket.emit('typing', { conversationId, isTyping: false });
    await wait(1000);

    // 5.3 Send message via WebSocket
    log('\n5.3 Sending messages via WebSocket...');
    user1Socket.emit('conversation-message', {
      conversationId,
      content: 'Hello from User 1 via WebSocket!'
    });
    await wait(1000);

    user2Socket.emit('conversation-message', {
      conversationId,
      content: 'Hello from User 2 via WebSocket!'
    });
    await wait(1000);

    // 5.4 Send message via REST API
    log('\n5.4 Sending messages via REST API...');
    const message1 = await sendMessage(user1Token, conversationId, 'Hello from User 1 via REST API!');
    await wait(1000);
    const message2 = await sendMessage(user2Token, conversationId, 'Hello from User 2 via REST API!');
    await wait(1000);

    // 5.5 Send read receipts
    log('\n5.5 Sending read receipts...');
    user1Socket.emit('read-receipt', { messageId: message2.id });
    await wait(1000);
    user2Socket.emit('read-receipt', { messageId: message1.id });
    await wait(1000);

    // 5.6 Mark conversation as read
    log('\n5.6 Marking conversation as read...');
    user1Socket.emit('mark-conversation-read', { conversationId });
    await wait(1000);

    // 5.7 Update user status
    log('\n5.7 Updating user status...');
    user1Socket.emit('status-update', { status: 'away' });
    await wait(1000);
    user1Socket.emit('status-update', { status: 'online' });
    await wait(1000);

    // 6. Cleanup
    log('\n6. Cleaning up...');
    user1Socket.disconnect();
    user2Socket.disconnect();

    log('\n=== WebSocket Integration Test Complete ===');
  } catch (error) {
    log(`Test failed: ${error.message}`);
    if (user1Socket) user1Socket.disconnect();
    if (user2Socket) user2Socket.disconnect();
  }
};

// Run the test
runTest();
