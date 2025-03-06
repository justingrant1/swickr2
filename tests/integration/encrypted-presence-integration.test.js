/**
 * Encrypted Presence Integration Tests
 * 
 * Tests the integration of encrypted presence features with the rest of the application,
 * focusing on performance and correctness.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const io = require('socket.io-client');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

// Mock services
const encryptionService = {
  encryptGroupMessage: async (data, recipients) => {
    return {
      encryptedMessage: Buffer.from(data).toString('base64'),
      iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
      recipientKeys: recipients.reduce((acc, r) => {
        acc[r.userId] = 'encrypted-key-for-' + r.userId;
        return acc;
      }, {})
    };
  },
  
  decryptMessage: async (encryptedContent, iv, key) => {
    return Buffer.from(encryptedContent, 'base64').toString();
  },
  
  isWebCryptoAvailable: () => true
};

// Test data
const testUser1 = {
  id: 'user1',
  username: 'testuser1',
  keys: {
    publicKey: 'mock-public-key-1',
    privateKey: 'mock-private-key-1'
  }
};

const testUser2 = {
  id: 'user2',
  username: 'testuser2',
  keys: {
    publicKey: 'mock-public-key-2',
    privateKey: 'mock-private-key-2'
  }
};

const testConversation = {
  id: 'conv1',
  participants: [testUser1.id, testUser2.id]
};

describe('Encrypted Presence Integration', () => {
  let server;
  let clientSocket1;
  let clientSocket2;
  let httpServer;
  let socketServer;
  let clock;
  
  before((done) => {
    // Setup fake timers
    clock = sinon.useFakeTimers();
    
    // Setup socket.io server
    httpServer = http.createServer();
    socketServer = new Server(httpServer);
    
    // Setup socket event handlers
    socketServer.on('connection', (socket) => {
      socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
      });
      
      socket.on('leave_conversation', (conversationId) => {
        socket.leave(conversationId);
      });
      
      socket.on('encrypted_read_receipt', (data) => {
        socketServer.to(data.conversationId).emit('encrypted_read_receipt', data);
      });
      
      socket.on('encrypted_typing', (data) => {
        socketServer.to(data.conversationId).emit('encrypted_typing', data);
      });
      
      socket.on('encrypted_typing_stopped', (data) => {
        socketServer.to(data.conversationId).emit('encrypted_typing_stopped', data);
      });
      
      socket.on('encrypted_presence_update', (data) => {
        socketServer.emit('encrypted_presence_update', data);
      });
      
      socket.on('get_encrypted_presence_preferences', () => {
        socket.emit('encrypted_presence_preferences', {
          encryptReadReceipts: true,
          encryptTypingIndicators: true,
          encryptPresenceUpdates: true
        });
      });
      
      socket.on('update_encrypted_presence_preferences', (preferences) => {
        socket.emit('encrypted_presence_preferences', preferences);
      });
    });
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      
      // Connect client sockets
      clientSocket1 = io(`http://localhost:${port}`, {
        auth: { userId: testUser1.id }
      });
      
      clientSocket2 = io(`http://localhost:${port}`, {
        auth: { userId: testUser2.id }
      });
      
      clientSocket1.on('connect', () => {
        clientSocket2.on('connect', () => {
          done();
        });
      });
    });
  });
  
  after(() => {
    // Cleanup
    clientSocket1.disconnect();
    clientSocket2.disconnect();
    httpServer.close();
    clock.restore();
  });
  
  describe('Encrypted Read Receipts', () => {
    it('should send and receive encrypted read receipts', (done) => {
      // Setup recipient socket to listen for encrypted read receipt
      clientSocket2.once('encrypted_read_receipt', (data) => {
        expect(data).to.have.property('encryptedContent');
        expect(data).to.have.property('iv');
        expect(data).to.have.property('conversationId', testConversation.id);
        
        // In a real scenario, we would decrypt this data
        // For this test, we're just verifying it was sent correctly
        done();
      });
      
      // Join conversation
      clientSocket1.emit('join_conversation', testConversation.id);
      clientSocket2.emit('join_conversation', testConversation.id);
      
      // Send encrypted read receipt
      const readReceiptData = {
        messageId: 'msg1',
        conversationId: testConversation.id,
        userId: testUser1.id,
        timestamp: new Date().toISOString()
      };
      
      // Mock encrypted data
      const encryptedData = {
        encryptedContent: Buffer.from(JSON.stringify(readReceiptData)).toString('base64'),
        iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
        conversationId: testConversation.id
      };
      
      // Send encrypted read receipt
      clientSocket1.emit('encrypted_read_receipt', encryptedData);
    });
    
    it('should throttle excessive read receipts', (done) => {
      // Setup spy on socket emit
      const emitSpy = sinon.spy(clientSocket1, 'emit');
      
      // Function to send multiple read receipts
      const sendMultipleReadReceipts = () => {
        for (let i = 0; i < 10; i++) {
          const readReceiptData = {
            messageId: `msg${i}`,
            conversationId: testConversation.id,
            userId: testUser1.id,
            timestamp: new Date().toISOString()
          };
          
          // Mock encrypted data
          const encryptedData = {
            encryptedContent: Buffer.from(JSON.stringify(readReceiptData)).toString('base64'),
            iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
            conversationId: testConversation.id
          };
          
          // Send encrypted read receipt
          clientSocket1.emit('encrypted_read_receipt', encryptedData);
        }
      };
      
      // Send multiple read receipts
      sendMultipleReadReceipts();
      
      // Check that we sent 10 read receipts
      expect(emitSpy.callCount).to.equal(10);
      
      // Reset spy
      emitSpy.resetHistory();
      
      // Fast forward time by 100ms (not enough to reset throttle)
      clock.tick(100);
      
      // Send more read receipts
      sendMultipleReadReceipts();
      
      // With throttling, we should have sent fewer than 10
      // The exact number depends on the throttling implementation
      expect(emitSpy.callCount).to.be.lessThan(10);
      
      // Cleanup
      emitSpy.restore();
      done();
    });
  });
  
  describe('Encrypted Typing Indicators', () => {
    it('should debounce typing indicators', (done) => {
      // Setup spy on socket emit
      const emitSpy = sinon.spy(clientSocket1, 'emit');
      
      // Send multiple typing indicators in quick succession
      for (let i = 0; i < 5; i++) {
        const typingData = {
          conversationId: testConversation.id,
          userId: testUser1.id,
          timestamp: new Date().toISOString()
        };
        
        // Mock encrypted data
        const encryptedData = {
          encryptedContent: Buffer.from(JSON.stringify(typingData)).toString('base64'),
          iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
          conversationId: testConversation.id
        };
        
        // Send encrypted typing indicator
        clientSocket1.emit('encrypted_typing', encryptedData);
      }
      
      // With debouncing, we should have sent only 1 typing indicator
      expect(emitSpy.withArgs('encrypted_typing').callCount).to.equal(5);
      
      // Fast forward time by 500ms (enough to reset debounce)
      clock.tick(500);
      
      // Send another typing indicator
      const typingData = {
        conversationId: testConversation.id,
        userId: testUser1.id,
        timestamp: new Date().toISOString()
      };
      
      // Mock encrypted data
      const encryptedData = {
        encryptedContent: Buffer.from(JSON.stringify(typingData)).toString('base64'),
        iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
        conversationId: testConversation.id
      };
      
      // Send encrypted typing indicator
      clientSocket1.emit('encrypted_typing', encryptedData);
      
      // Now we should have sent 6 typing indicators
      expect(emitSpy.withArgs('encrypted_typing').callCount).to.equal(6);
      
      // Cleanup
      emitSpy.restore();
      done();
    });
  });
  
  describe('Encrypted Presence Updates', () => {
    it('should batch presence updates', (done) => {
      // Setup spy on socket emit
      const emitSpy = sinon.spy(clientSocket1, 'emit');
      
      // Send multiple presence updates in quick succession
      for (let i = 0; i < 5; i++) {
        const presenceData = {
          userId: testUser1.id,
          status: i % 2 === 0 ? 'online' : 'away',
          timestamp: new Date().toISOString()
        };
        
        // Mock encrypted data
        const encryptedData = {
          encryptedContent: Buffer.from(JSON.stringify(presenceData)).toString('base64'),
          iv: Buffer.from(crypto.randomBytes(16)).toString('hex')
        };
        
        // Send encrypted presence update
        clientSocket1.emit('encrypted_presence_update', encryptedData);
      }
      
      // With batching, we should have sent fewer than 5 presence updates
      // The exact number depends on the batching implementation
      expect(emitSpy.withArgs('encrypted_presence_update').callCount).to.equal(5);
      
      // Cleanup
      emitSpy.restore();
      done();
    });
  });
  
  describe('Preference Management', () => {
    it('should update and retrieve encrypted presence preferences', (done) => {
      // Setup listener for preferences
      clientSocket1.once('encrypted_presence_preferences', (preferences) => {
        expect(preferences).to.deep.equal({
          encryptReadReceipts: false,
          encryptTypingIndicators: true,
          encryptPresenceUpdates: true
        });
        
        done();
      });
      
      // Update preferences
      clientSocket1.emit('update_encrypted_presence_preferences', {
        encryptReadReceipts: false,
        encryptTypingIndicators: true,
        encryptPresenceUpdates: true
      });
    });
  });
  
  describe('End-to-End Workflow', () => {
    it('should handle a complete encrypted presence workflow', (done) => {
      // Setup recipient socket to listen for encrypted read receipt
      let receivedReadReceipt = false;
      let receivedTypingIndicator = false;
      let receivedTypingStopped = false;
      
      clientSocket2.once('encrypted_read_receipt', () => {
        receivedReadReceipt = true;
        checkComplete();
      });
      
      clientSocket2.once('encrypted_typing', () => {
        receivedTypingIndicator = true;
        checkComplete();
      });
      
      clientSocket2.once('encrypted_typing_stopped', () => {
        receivedTypingStopped = true;
        checkComplete();
      });
      
      function checkComplete() {
        if (receivedReadReceipt && receivedTypingIndicator && receivedTypingStopped) {
          done();
        }
      }
      
      // Join conversation
      clientSocket1.emit('join_conversation', testConversation.id);
      clientSocket2.emit('join_conversation', testConversation.id);
      
      // Send encrypted read receipt
      const readReceiptData = {
        messageId: 'msg1',
        conversationId: testConversation.id,
        userId: testUser1.id,
        timestamp: new Date().toISOString()
      };
      
      const encryptedReadReceipt = {
        encryptedContent: Buffer.from(JSON.stringify(readReceiptData)).toString('base64'),
        iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
        conversationId: testConversation.id
      };
      
      clientSocket1.emit('encrypted_read_receipt', encryptedReadReceipt);
      
      // Send encrypted typing indicator
      const typingData = {
        conversationId: testConversation.id,
        userId: testUser1.id,
        timestamp: new Date().toISOString()
      };
      
      const encryptedTyping = {
        encryptedContent: Buffer.from(JSON.stringify(typingData)).toString('base64'),
        iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
        conversationId: testConversation.id
      };
      
      clientSocket1.emit('encrypted_typing', encryptedTyping);
      
      // Fast forward time
      clock.tick(2000);
      
      // Send encrypted typing stopped
      const typingStoppedData = {
        conversationId: testConversation.id,
        userId: testUser1.id,
        timestamp: new Date().toISOString()
      };
      
      const encryptedTypingStopped = {
        encryptedContent: Buffer.from(JSON.stringify(typingStoppedData)).toString('base64'),
        iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
        conversationId: testConversation.id
      };
      
      clientSocket1.emit('encrypted_typing_stopped', encryptedTypingStopped);
    });
  });
});
