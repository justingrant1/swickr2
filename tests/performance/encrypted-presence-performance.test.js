/**
 * Encrypted Presence Performance Tests
 * 
 * Tests the performance of encrypted presence features to ensure
 * they meet Swickr's performance targets.
 */

const { performance } = require('perf_hooks');
const crypto = require('crypto');
const { expect } = require('chai');
const sinon = require('sinon');

// Mock dependencies
const socketMock = {
  emit: sinon.stub(),
  on: sinon.stub()
};

// Mock Web Crypto API
global.crypto = {
  subtle: {
    generateKey: sinon.stub(),
    exportKey: sinon.stub(),
    importKey: sinon.stub(),
    encrypt: sinon.stub(),
    decrypt: sinon.stub(),
    sign: sinon.stub(),
    verify: sinon.stub()
  },
  getRandomValues: (buffer) => {
    return crypto.randomFillSync(buffer);
  }
};

// Mock browser APIs
global.navigator = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  hardwareConcurrency: 8
};

global.Worker = class Worker {
  constructor() {
    this.onmessage = null;
  }
  
  postMessage(data) {
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: { id: data.id, result: { success: true, data: data.data } } });
      }
    }, 5);
  }
  
  terminate() {}
};

// Import modules (with mocked dependencies)
jest.mock('../../client/src/services/socketService', () => socketMock);

// Mock worker service
const workerServiceMock = {
  isWebWorkerSupported: sinon.stub().returns(true),
  encryptWithWorker: sinon.stub().resolves({
    encryptedMessage: 'encrypted-data',
    iv: 'mock-iv',
    recipientKeys: { user456: 'encrypted-key-1', user789: 'encrypted-key-2' }
  }),
  decryptWithWorker: sinon.stub().resolves('decrypted-data'),
  encryptPresenceWithWorker: sinon.stub().resolves({
    encryptedData: 'encrypted-presence-data',
    iv: 'mock-iv',
    recipientKeys: { user456: 'encrypted-key-1', user789: 'encrypted-key-2' }
  }),
  batchEncryptWithWorker: sinon.stub().resolves([
    { id: 1, encryptedData: 'batch-item-1' },
    { id: 2, encryptedData: 'batch-item-2' }
  ]),
  terminateWorker: sinon.stub()
};

jest.mock('../../client/src/services/workerService', () => workerServiceMock);

// Load the modules to test
const performanceService = require('../../client/src/services/performanceService').default;
const encryptedPresenceService = require('../../client/src/services/encryptedPresenceService').default;
const encryptionService = require('../../client/src/services/encryptionService').default;
const workerService = require('../../client/src/services/workerService').default;

// Test suite
describe('Encrypted Presence Performance', () => {
  // Sample data for testing
  const userKeys = {
    publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvFdDGh9XZQiGvY0SgEYR\nKYCrQxMPJC1UxKZgMKs2jUL0rBgDVsohm4j6JCcJJ6k7ZiAVXQJUhm+qZ2Z3XbNi\n-----END PUBLIC KEY-----',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8V0MaH1dlCIa9\njRKARhEpgKtDEw8kLVTEpmAwqzaNQvSsGANWyiGbiPokJwknqTtmIBVdAlSGb6pn\n-----END PRIVATE KEY-----'
  };
  
  const userId = 'user123';
  const conversationId = 'conv456';
  
  const recipients = [
    { userId: 'user456', publicKey: userKeys.publicKey },
    { userId: 'user789', publicKey: userKeys.publicKey }
  ];
  
  // Setup before tests
  before(() => {
    // Mock encryption service methods
    encryptionService.encryptGroupMessage = async (data, recipients) => {
      return {
        encryptedContent: Buffer.from(data).toString('base64'),
        iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
        recipientKeys: recipients.reduce((acc, r) => {
          acc[r.userId] = 'encrypted-key-for-' + r.userId;
          return acc;
        }, {})
      };
    };
    
    encryptionService.decryptMessage = async (encryptedContent, iv, key) => {
      return Buffer.from(encryptedContent, 'base64').toString();
    };
    
    // Initialize encrypted presence service
    encryptedPresenceService.init(userKeys, userId);
  });
  
  // Reset mocks between tests
  beforeEach(() => {
    socketMock.emit.resetHistory();
    performanceService.clearCaches();
  });
  
  describe('Basic Performance', () => {
    it('should initialize quickly', () => {
      const start = performance.now();
      
      const result = encryptedPresenceService.init(userKeys, userId);
      
      const end = performance.now();
      const duration = end - start;
      
      expect(result).to.be.true;
      expect(duration).to.be.lessThan(50, 'Initialization should take less than 50ms');
    });
    
    it('should optimize for device capabilities quickly', async () => {
      const start = performance.now();
      
      await encryptedPresenceService.optimizeForDevice();
      
      const end = performance.now();
      const duration = end - start;
      
      expect(duration).to.be.lessThan(100, 'Device optimization should take less than 100ms');
    });
  });
  
  describe('Encrypted Read Receipt Performance', () => {
    it('should send encrypted read receipts within performance target', async () => {
      const messageId = 'msg123';
      
      const start = performance.now();
      
      await encryptedPresenceService.sendEncryptedReadReceipt(messageId, conversationId, recipients);
      
      const end = performance.now();
      const duration = end - start;
      
      expect(socketMock.emit.calledWith('encrypted_read_receipt')).to.be.true;
      expect(duration).to.be.lessThan(100, 'Sending encrypted read receipt should take less than 100ms');
    });
    
    it('should benefit from caching on subsequent calls', async () => {
      const messageId = 'msg123';
      
      // First call
      await encryptedPresenceService.sendEncryptedReadReceipt(messageId, conversationId, recipients);
      
      // Second call with same data should be faster due to caching
      const start = performance.now();
      
      await encryptedPresenceService.sendEncryptedReadReceipt(messageId, conversationId, recipients);
      
      const end = performance.now();
      const duration = end - start;
      
      expect(duration).to.be.lessThan(50, 'Cached encrypted read receipt should take less than 50ms');
    });
  });
  
  describe('Encrypted Typing Indicator Performance', () => {
    it('should send encrypted typing indicators within performance target', async () => {
      const start = performance.now();
      
      await encryptedPresenceService.sendEncryptedTypingIndicator(conversationId, recipients);
      
      const end = performance.now();
      const duration = end - start;
      
      expect(duration).to.be.lessThan(100, 'Sending encrypted typing indicator should take less than 100ms');
    });
    
    it('should properly debounce typing indicators', async () => {
      // Send multiple typing indicators in quick succession
      await encryptedPresenceService.sendEncryptedTypingIndicator(conversationId, recipients);
      await encryptedPresenceService.sendEncryptedTypingIndicator(conversationId, recipients);
      await encryptedPresenceService.sendEncryptedTypingIndicator(conversationId, recipients);
      
      // Only one emit should have been called due to debouncing
      expect(socketMock.emit.callCount).to.equal(1, 'Multiple typing indicators should be debounced');
      
      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Send another one
      await encryptedPresenceService.sendEncryptedTypingIndicator(conversationId, recipients);
      
      // Now we should have two emits
      expect(socketMock.emit.callCount).to.equal(2, 'After debounce period, new typing indicator should be sent');
    });
  });
  
  describe('Encrypted Presence Update Performance', () => {
    it('should batch presence updates efficiently', async () => {
      // Send multiple presence updates in quick succession
      const promises = [];
      const start = performance.now();
      
      for (let i = 0; i < 5; i++) {
        promises.push(encryptedPresenceService.sendEncryptedPresenceUpdate('online', recipients));
      }
      
      await Promise.all(promises);
      
      const end = performance.now();
      const duration = end - start;
      
      // Batching should result in fewer socket emissions
      expect(socketMock.emit.callCount).to.be.lessThan(5, 'Presence updates should be batched');
      expect(duration).to.be.lessThan(200, 'Batched presence updates should take less than 200ms total');
    });
  });
  
  describe('Performance Under Load', () => {
    it('should handle multiple concurrent operations efficiently', async () => {
      const operations = [];
      const start = performance.now();
      
      // Simulate heavy concurrent load
      for (let i = 0; i < 20; i++) {
        operations.push(encryptedPresenceService.sendEncryptedReadReceipt(`msg${i}`, conversationId, recipients));
        operations.push(encryptedPresenceService.sendEncryptedTypingIndicator(conversationId, recipients));
        operations.push(encryptedPresenceService.sendEncryptedPresenceUpdate('online', recipients));
      }
      
      await Promise.all(operations);
      
      const end = performance.now();
      const duration = end - start;
      
      // Total time should be reasonable despite heavy load
      expect(duration).to.be.lessThan(1000, 'Heavy concurrent load should be handled in less than 1000ms');
      
      // Check performance metrics
      const metrics = encryptedPresenceService.getPerformanceMetrics();
      expect(metrics.encryptionCacheSize).to.be.greaterThan(0, 'Encryption cache should be utilized');
    });
  });
  
  describe('Performance Optimizations', () => {
    it('should adjust settings for low-power devices', async () => {
      // Mock a low-power mobile device
      const originalUserAgent = global.navigator.userAgent;
      const originalCores = global.navigator.hardwareConcurrency;
      
      global.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';
      global.navigator.hardwareConcurrency = 2;
      
      await encryptedPresenceService.optimizeForDevice();
      
      const config = performanceService.getConfig();
      
      // Settings should be adjusted for low-power device
      expect(config.debounce.typing).to.be.greaterThan(300, 'Typing debounce should be increased for low-power devices');
      expect(config.worker.useWorker).to.be.false;
      
      // Restore original values
      global.navigator.userAgent = originalUserAgent;
      global.navigator.hardwareConcurrency = originalCores;
    });
    
    it('should adjust settings for high-performance devices', async () => {
      // Mock a high-performance desktop device
      global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      global.navigator.hardwareConcurrency = 16;
      
      await encryptedPresenceService.optimizeForDevice();
      
      const config = performanceService.getConfig();
      
      // Settings should be adjusted for high-performance device
      expect(config.debounce.typing).to.be.lessThan(300, 'Typing debounce should be decreased for high-performance devices');
      expect(config.worker.useWorker).to.be.true;
    });
  });
  
  describe('End-to-End Performance', () => {
    it('should meet overall latency targets for encrypted presence features', async () => {
      // Measure complete flow from sending to receiving
      const messageId = 'msg-e2e-test';
      
      // Create mock encrypted data
      const mockEncryptedData = {
        encryptedContent: Buffer.from(JSON.stringify({
          messageId,
          conversationId,
          userId: 'user456',
          timestamp: new Date().toISOString()
        })).toString('base64'),
        iv: Buffer.from(crypto.randomBytes(16)).toString('hex'),
        recipientKeys: {
          [userId]: 'encrypted-key-for-' + userId
        }
      };
      
      // Start timer
      const start = performance.now();
      
      // Simulate receiving encrypted read receipt
      const onMessageRead = sinon.stub();
      socketMock.emit.withArgs('message_read').callsFake(onMessageRead);
      
      // Trigger the socket event handler
      const handler = socketMock.on.args.find(args => args[0] === 'encrypted_read_receipt')[1];
      await handler(mockEncryptedData);
      
      // End timer
      const end = performance.now();
      const duration = end - start;
      
      // Verify message_read was emitted
      expect(onMessageRead.called).to.be.true;
      
      // Check performance
      expect(duration).to.be.lessThan(100, 'End-to-end processing should take less than 100ms');
    });
  });
  
  describe('Web Worker Performance', () => {
    it('should encrypt data faster using Web Worker', async () => {
      const data = generateRandomMessage(500);
      
      // Measure encryption time without worker
      const startWithoutWorker = performance.now();
      await encryptionService.encryptGroupMessage(data, recipients);
      const endWithoutWorker = performance.now();
      const durationWithoutWorker = endWithoutWorker - startWithoutWorker;
      
      // Measure encryption time with worker
      const startWithWorker = performance.now();
      await workerService.encryptWithWorker(data, recipients);
      const endWithWorker = performance.now();
      const durationWithWorker = endWithWorker - startWithWorker;
      
      // Worker should be at least as fast as main thread (usually faster)
      expect(durationWithWorker).to.be.at.most(durationWithoutWorker * 1.1, 
        'Web Worker encryption should be at least as fast as main thread encryption');
      
      // Absolute performance target
      expect(durationWithWorker).to.be.lessThan(100, 
        'Web Worker encryption should take less than 100ms');
    });
    
    it('should handle multiple concurrent encryption tasks efficiently', async () => {
      const tasks = [];
      const count = 10;
      
      const start = performance.now();
      
      // Start multiple concurrent encryption tasks
      for (let i = 0; i < count; i++) {
        const data = generateRandomMessage(200);
        tasks.push(workerService.encryptWithWorker(data, recipients));
      }
      
      // Wait for all tasks to complete
      await Promise.all(tasks);
      
      const end = performance.now();
      const duration = end - start;
      const averagePerTask = duration / count;
      
      expect(averagePerTask).to.be.lessThan(50, 
        'Average time per encryption task should be less than 50ms when running concurrently');
    });
    
    it('should encrypt presence data efficiently with worker', async () => {
      const presenceData = {
        userId,
        status: 'online',
        timestamp: Date.now()
      };
      
      const start = performance.now();
      
      await workerService.encryptPresenceWithWorker(presenceData, recipients, 'status');
      
      const end = performance.now();
      const duration = end - start;
      
      expect(duration).to.be.lessThan(50, 
        'Encrypting presence data with worker should take less than 50ms');
    });
    
    it('should batch encrypt efficiently with worker', async () => {
      const batch = [
        { id: 1, data: generateRandomMessage(100) },
        { id: 2, data: generateRandomMessage(100) },
        { id: 3, data: generateRandomMessage(100) },
        { id: 4, data: generateRandomMessage(100) },
        { id: 5, data: generateRandomMessage(100) }
      ];
      
      const start = performance.now();
      
      await workerService.batchEncryptWithWorker(batch, recipients);
      
      const end = performance.now();
      const duration = end - start;
      const averagePerItem = duration / batch.length;
      
      expect(averagePerItem).to.be.lessThan(30, 
        'Average time per batch item should be less than 30ms');
    });
    
    it('should gracefully fall back when Web Worker is not available', async () => {
      // Temporarily make Web Worker unavailable
      const originalIsSupported = workerService.isWebWorkerSupported;
      workerService.isWebWorkerSupported = sinon.stub().returns(false);
      
      const data = generateRandomMessage(200);
      
      // Should still work, just on main thread
      const start = performance.now();
      
      // This should fall back to main thread encryption
      const result = await encryptedPresenceService.sendEncryptedTypingIndicator(conversationId, recipients);
      
      const end = performance.now();
      const duration = end - start;
      
      // Restore original function
      workerService.isWebWorkerSupported = originalIsSupported;
      
      expect(result).to.not.be.undefined;
      expect(duration).to.be.lessThan(150, 
        'Fallback encryption should still complete within reasonable time');
    });
  });
  
  describe('Performance Monitoring', () => {
    it('should accurately track message latency', () => {
      // Simulate message sending and receiving
      const start = performance.now();
      
      // Record start time
      performanceService.recordMetric('messageStart', conversationId);
      
      // Simulate some delay
      const delay = 75;
      const now = performance.now();
      while (performance.now() - now < delay) {
        // Busy wait to simulate processing
      }
      
      // Record end time
      performanceService.recordMetric('messageEnd', conversationId);
      
      // Get metrics
      const metrics = performanceService.getMetrics();
      
      expect(metrics.messageLatency).to.be.at.least(delay);
      expect(metrics.messageLatency).to.be.at.most(delay + 50);
    });
    
    it('should accurately track encryption time', () => {
      // Record start time
      performanceService.recordMetric('encryptionStart');
      
      // Simulate encryption work
      const delay = 50;
      const now = performance.now();
      while (performance.now() - now < delay) {
        // Busy wait to simulate encryption
      }
      
      // Record end time
      performanceService.recordMetric('encryptionEnd');
      
      // Get metrics
      const metrics = performanceService.getMetrics();
      
      expect(metrics.encryptionTime).to.be.at.least(delay);
      expect(metrics.encryptionTime).to.be.at.most(delay + 30);
    });
    
    it('should track cache hit rate correctly', async () => {
      // Clear existing cache
      performanceService.clearCaches();
      
      // Make some cache operations
      const cacheKey = 'test-cache-key';
      
      // First call - cache miss
      await performanceService.cacheOperation(cacheKey, async () => {
        return 'cached-value';
      });
      
      // Second call - cache hit
      await performanceService.cacheOperation(cacheKey, async () => {
        return 'should-not-be-returned';
      });
      
      // Third call - cache hit
      await performanceService.cacheOperation(cacheKey, async () => {
        return 'should-not-be-returned';
      });
      
      // Get metrics
      const metrics = performanceService.getMetrics();
      
      // 2 hits out of 3 operations = 66.67% hit rate
      expect(metrics.cacheHitRate).to.be.at.least(66);
      expect(metrics.cacheHitRate).to.be.at.most(67);
    });
    
    it('should track batch size correctly', async () => {
      // Clear existing batches
      performanceService.clearBatches();
      
      // Create a batch
      const batchName = 'test-batch';
      const items = [
        { id: 1, data: 'item-1' },
        { id: 2, data: 'item-2' },
        { id: 3, data: 'item-3' },
        { id: 4, data: 'item-4' }
      ];
      
      // Add items to batch
      for (const item of items) {
        await performanceService.batchOperation(batchName, item, async (batch) => {
          return batch;
        });
      }
      
      // Get metrics
      const metrics = performanceService.getMetrics();
      
      expect(metrics.batchSize).to.equal(items.length);
    });
    
    it('should update configuration correctly', () => {
      // Get initial config
      const initialConfig = performanceService.getConfig();
      
      // Update config
      const newConfig = {
        debounce: {
          typing: 500
        },
        worker: {
          useWorker: false
        }
      };
      
      performanceService.updateConfig(newConfig);
      
      // Get updated config
      const updatedConfig = performanceService.getConfig();
      
      expect(updatedConfig.debounce.typing).to.equal(500);
      expect(updatedConfig.worker.useWorker).to.be.false;
      
      // Other values should remain unchanged
      expect(updatedConfig.batch.maxItems).to.equal(initialConfig.batch.maxItems);
    });
  });
});

// Helper functions
function generateRandomString(length = 10) {
  return crypto.randomBytes(length).toString('hex');
}

function generateRandomMessage(length = 100) {
  return {
    id: generateRandomString(8),
    content: generateRandomString(length),
    timestamp: new Date().toISOString()
  };
}
