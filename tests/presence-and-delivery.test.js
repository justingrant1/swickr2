/**
 * Presence and Message Delivery Status Tests
 * 
 * This test suite validates the real-time presence indicators and message delivery
 * status features of the Swickr messaging application.
 */

const { io } = require('socket.io-client');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { expect } = require('chai');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 10000; // 10 seconds

// Test users
let user1 = {
  username: `test-user-${uuidv4().substring(0, 8)}`,
  password: 'TestPassword123!',
  email: `test-${uuidv4().substring(0, 8)}@example.com`
};

let user2 = {
  username: `test-user-${uuidv4().substring(0, 8)}`,
  password: 'TestPassword123!',
  email: `test-${uuidv4().substring(0, 8)}@example.com`
};

// Test data
let user1Token;
let user2Token;
let user1Socket;
let user2Socket;
let user1Id;
let user2Id;
let conversationId;

describe('Presence and Message Delivery Status Tests', function() {
  this.timeout(TEST_TIMEOUT);

  before(async function() {
    // Register test users
    const registerUser1 = await axios.post(`${API_URL}/api/auth/register`, user1);
    user1Id = registerUser1.data.userId;
    
    const registerUser2 = await axios.post(`${API_URL}/api/auth/register`, user2);
    user2Id = registerUser2.data.userId;
    
    // Login test users
    const loginUser1 = await axios.post(`${API_URL}/api/auth/login`, {
      username: user1.username,
      password: user1.password
    });
    user1Token = loginUser1.data.token;
    
    const loginUser2 = await axios.post(`${API_URL}/api/auth/login`, {
      username: user2.username,
      password: user2.password
    });
    user2Token = loginUser2.data.token;
    
    // Add users as contacts
    await axios.post(`${API_URL}/api/contacts/add`, 
      { username: user2.username },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    await axios.post(`${API_URL}/api/contacts/add`, 
      { username: user1.username },
      { headers: { Authorization: `Bearer ${user2Token}` } }
    );
    
    // Create a conversation between users
    const createConversation = await axios.post(`${API_URL}/api/conversations`, 
      { participantIds: [user2Id] },
      { headers: { Authorization: `Bearer ${user1Token}` } }
    );
    
    conversationId = createConversation.data.id;
  });
  
  after(async function() {
    // Disconnect sockets if connected
    if (user1Socket && user1Socket.connected) {
      user1Socket.disconnect();
    }
    
    if (user2Socket && user2Socket.connected) {
      user2Socket.disconnect();
    }
    
    // Clean up test data (optional, depending on your test environment)
    try {
      // Delete conversation
      await axios.delete(`${API_URL}/api/conversations/${conversationId}`, 
        { headers: { Authorization: `Bearer ${user1Token}` } }
      );
      
      // Remove contacts
      await axios.delete(`${API_URL}/api/contacts/${user2Id}`, 
        { headers: { Authorization: `Bearer ${user1Token}` } }
      );
      
      await axios.delete(`${API_URL}/api/contacts/${user1Id}`, 
        { headers: { Authorization: `Bearer ${user2Token}` } }
      );
      
      // Delete test users (if your API supports this)
      await axios.delete(`${API_URL}/api/users/${user1Id}`, 
        { headers: { Authorization: `Bearer ${user1Token}` } }
      );
      
      await axios.delete(`${API_URL}/api/users/${user2Id}`, 
        { headers: { Authorization: `Bearer ${user2Token}` } }
      );
    } catch (error) {
      console.error('Error cleaning up test data:', error.message);
    }
  });
  
  describe('Presence Indicators', function() {
    it('should broadcast online status when a user connects', function(done) {
      // Connect user1
      user1Socket = io(SOCKET_URL, {
        auth: { token: user1Token }
      });
      
      // Connect user2 and listen for user1's status
      user2Socket = io(SOCKET_URL, {
        auth: { token: user2Token }
      });
      
      user2Socket.on('user_status', (data) => {
        if (data.userId === user1Id && data.status === 'online') {
          expect(data).to.have.property('userId', user1Id);
          expect(data).to.have.property('status', 'online');
          expect(data).to.have.property('timestamp');
          done();
        }
      });
      
      // Wait for connection to establish
      user1Socket.on('connect', () => {
        console.log('User 1 connected');
      });
      
      user2Socket.on('connect', () => {
        console.log('User 2 connected');
      });
    });
    
    it('should update status when user manually changes it', function(done) {
      user2Socket.on('user_status', (data) => {
        if (data.userId === user1Id && data.status === 'busy') {
          expect(data).to.have.property('userId', user1Id);
          expect(data).to.have.property('status', 'busy');
          done();
        }
      });
      
      // User1 changes status to busy
      user1Socket.emit('status', 'busy');
    });
    
    it('should update to away status after inactivity', function(done) {
      this.timeout(15000); // Increase timeout for this test
      
      // For testing, we'll temporarily override the AWAY_TIMEOUT in the server
      // In a real test, you might mock the server's setTimeout or use a test-specific timeout
      
      // This is a simplified test that assumes the server is configured with a short
      // timeout for testing purposes (e.g., 2 seconds instead of 10 minutes)
      user2Socket.on('user_status', (data) => {
        if (data.userId === user1Id && data.status === 'away') {
          expect(data).to.have.property('userId', user1Id);
          expect(data).to.have.property('status', 'away');
          done();
        }
      });
      
      // No activity from user1 should eventually trigger away status
      // In a real test environment, you would configure the server with a short timeout
    });
    
    it('should return to online status after activity', function(done) {
      user2Socket.on('user_status', (data) => {
        if (data.userId === user1Id && data.status === 'online') {
          expect(data).to.have.property('userId', user1Id);
          expect(data).to.have.property('status', 'online');
          done();
        }
      });
      
      // Simulate user activity
      user1Socket.emit('user_activity');
    });
  });
  
  describe('Message Delivery Status', function() {
    it('should mark message as sent when server receives it', function(done) {
      let messageId;
      
      user1Socket.on('message_sent', (data) => {
        expect(data).to.have.property('messageId');
        expect(data).to.have.property('timestamp');
        messageId = data.messageId;
        done();
      });
      
      // Send a test message
      user1Socket.emit('message', {
        conversationId,
        content: 'Test message for delivery status',
        isEncrypted: false
      });
    });
    
    it('should mark message as delivered when recipient receives it', function(done) {
      let messageContent = `Test delivery ${Date.now()}`;
      
      user1Socket.on('message_delivered', (data) => {
        expect(data).to.have.property('messageId');
        expect(data).to.have.property('userId', user2Id);
        expect(data).to.have.property('timestamp');
        done();
      });
      
      // Send a test message
      user1Socket.emit('message', {
        conversationId,
        content: messageContent,
        isEncrypted: false
      });
    });
    
    it('should mark message as read when recipient reads it', function(done) {
      let messageContent = `Test read receipt ${Date.now()}`;
      let messageId;
      
      // Listen for read receipt
      user1Socket.on('message_read', (data) => {
        expect(data).to.have.property('conversationId', conversationId);
        expect(data).to.have.property('userId', user2Id);
        expect(data).to.have.property('timestamp');
        done();
      });
      
      // First, send a message
      user1Socket.emit('message', {
        conversationId,
        content: messageContent,
        isEncrypted: false
      });
      
      // When message is sent, capture its ID
      user1Socket.once('message_sent', (data) => {
        messageId = data.messageId;
        
        // After message is delivered, have user2 read it
        user1Socket.once('message_delivered', () => {
          // User2 sends read receipt
          user2Socket.emit('read_receipt', {
            messageId,
            conversationId
          });
        });
      });
    });
  });
  
  describe('Typing Indicators', function() {
    it('should broadcast typing status when user starts typing', function(done) {
      user2Socket.on('typing', (data) => {
        if (data.conversationId === conversationId && data.userId === user1Id) {
          expect(data).to.have.property('conversationId', conversationId);
          expect(data).to.have.property('userId', user1Id);
          expect(data).to.have.property('username');
          done();
        }
      });
      
      // User1 starts typing
      user1Socket.emit('typing', { conversationId });
    });
    
    it('should broadcast typing stopped when user stops typing', function(done) {
      user2Socket.on('typing_stopped', (data) => {
        if (data.conversationId === conversationId && data.userId === user1Id) {
          expect(data).to.have.property('conversationId', conversationId);
          expect(data).to.have.property('userId', user1Id);
          done();
        }
      });
      
      // User1 stops typing
      user1Socket.emit('typing_stopped', { conversationId });
    });
    
    it('should automatically clear typing status when message is sent', function(done) {
      let typingStopped = false;
      
      user2Socket.on('typing_stopped', (data) => {
        if (data.conversationId === conversationId && data.userId === user1Id) {
          typingStopped = true;
        }
      });
      
      user2Socket.on('new_message', (data) => {
        if (data.conversationId === conversationId && data.senderId === user1Id) {
          // Verify typing stopped was sent before or with the message
          expect(typingStopped).to.be.true;
          done();
        }
      });
      
      // User1 starts typing
      user1Socket.emit('typing', { conversationId });
      
      // Short delay to ensure typing event is processed
      setTimeout(() => {
        // User1 sends a message
        user1Socket.emit('message', {
          conversationId,
          content: 'This should clear typing status',
          isEncrypted: false
        });
      }, 500);
    });
  });
  
  describe('Conversation Presence', function() {
    it('should notify participants when a user joins a conversation', function(done) {
      user2Socket.on('conversation_presence', (data) => {
        if (data.conversationId === conversationId && 
            data.userId === user1Id && 
            data.action === 'join') {
          expect(data).to.have.property('conversationId', conversationId);
          expect(data).to.have.property('userId', user1Id);
          expect(data).to.have.property('action', 'join');
          expect(data).to.have.property('activeUsers').that.includes(user1Id);
          done();
        }
      });
      
      // User1 joins conversation
      user1Socket.emit('join_conversation', conversationId);
    });
    
    it('should mark messages as read when joining a conversation', function(done) {
      let messageContent = `Test auto-read on join ${Date.now()}`;
      
      user1Socket.on('message_read', (data) => {
        if (data.conversationId === conversationId && data.userId === user2Id) {
          expect(data).to.have.property('conversationId', conversationId);
          expect(data).to.have.property('userId', user2Id);
          expect(data).to.have.property('timestamp');
          done();
        }
      });
      
      // First, send a message from user1 to user2
      user1Socket.emit('message', {
        conversationId,
        content: messageContent,
        isEncrypted: false
      });
      
      // When message is delivered, have user2 join the conversation
      user1Socket.once('message_delivered', () => {
        // User2 joins conversation, which should mark messages as read
        user2Socket.emit('join_conversation', conversationId);
      });
    });
    
    it('should notify participants when a user leaves a conversation', function(done) {
      user2Socket.on('conversation_presence', (data) => {
        if (data.conversationId === conversationId && 
            data.userId === user1Id && 
            data.action === 'leave') {
          expect(data).to.have.property('conversationId', conversationId);
          expect(data).to.have.property('userId', user1Id);
          expect(data).to.have.property('action', 'leave');
          expect(data).to.have.property('activeUsers').that.does.not.include(user1Id);
          done();
        }
      });
      
      // User1 leaves conversation
      user1Socket.emit('leave_conversation', conversationId);
    });
  });
  
  describe('Offline Status', function() {
    it('should mark user as offline when disconnected', function(done) {
      user2Socket.on('user_status', (data) => {
        if (data.userId === user1Id && data.status === 'offline') {
          expect(data).to.have.property('userId', user1Id);
          expect(data).to.have.property('status', 'offline');
          done();
        }
      });
      
      // Disconnect user1
      user1Socket.disconnect();
    });
  });
});
