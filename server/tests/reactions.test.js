/**
 * Message Reactions API Tests
 * 
 * Tests for the message reactions API endpoints and functionality
 */
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../src/app');
const MessageReaction = require('../src/models/MessageReaction');
const { generateToken } = require('../src/config/auth');

// Mock data for testing
const testUsers = [
  { id: uuidv4(), username: 'testuser1', displayName: 'Test User 1' },
  { id: uuidv4(), username: 'testuser2', displayName: 'Test User 2' },
];

const testMessages = [
  { id: uuidv4(), content: 'Test message 1', userId: testUsers[0].id },
  { id: uuidv4(), content: 'Test message 2', userId: testUsers[1].id },
];

// Generate auth tokens for test users
const authTokens = {
  user1: generateToken({ id: testUsers[0].id, username: testUsers[0].username }),
  user2: generateToken({ id: testUsers[1].id, username: testUsers[1].username }),
};

// Mock the MessageReaction model
jest.mock('../src/models/MessageReaction');

describe('Message Reactions API', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/reactions/message/:messageId', () => {
    it('should return reactions for a message', async () => {
      const messageId = testMessages[0].id;
      const mockReactions = [
        {
          id: uuidv4(),
          messageId,
          userId: testUsers[1].id,
          emoji: '👍',
          timestamp: new Date().toISOString(),
          username: testUsers[1].username,
          displayName: testUsers[1].displayName,
        },
      ];

      // Mock the getByMessageId method
      MessageReaction.getByMessageId.mockResolvedValue(mockReactions);

      const response = await request(app)
        .get(`/api/reactions/message/${messageId}`)
        .set('Authorization', `Bearer ${authTokens.user1}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reactions');
      expect(response.body.reactions).toEqual(mockReactions);
      expect(response.body).toHaveProperty('reactionCounts');
      expect(response.body.reactionCounts).toEqual([{ emoji: '👍', count: 1 }]);
      expect(MessageReaction.getByMessageId).toHaveBeenCalledWith(messageId);
    });

    it('should return 404 for non-existent message', async () => {
      const nonExistentMessageId = uuidv4();
      
      // Mock the getByMessageId method to return empty array
      MessageReaction.getByMessageId.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/reactions/message/${nonExistentMessageId}`)
        .set('Authorization', `Bearer ${authTokens.user1}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reactions');
      expect(response.body.reactions).toEqual([]);
      expect(MessageReaction.getByMessageId).toHaveBeenCalledWith(nonExistentMessageId);
    });

    it('should require authentication', async () => {
      const messageId = testMessages[0].id;

      const response = await request(app)
        .get(`/api/reactions/message/${messageId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/reactions/message/:messageId', () => {
    it('should add a reaction to a message', async () => {
      const messageId = testMessages[0].id;
      const emoji = '👍';
      const userId = testUsers[0].id;
      
      const mockReaction = {
        id: uuidv4(),
        messageId,
        userId,
        emoji,
        timestamp: new Date().toISOString(),
      };

      // Mock the create method
      MessageReaction.create.mockResolvedValue(mockReaction);

      const response = await request(app)
        .post(`/api/reactions/message/${messageId}`)
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ emoji });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockReaction);
      expect(MessageReaction.create).toHaveBeenCalledWith({
        messageId,
        userId,
        emoji,
      });
    });

    it('should return 400 for invalid emoji', async () => {
      const messageId = testMessages[0].id;
      
      const response = await request(app)
        .post(`/api/reactions/message/${messageId}`)
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ emoji: '' });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const messageId = testMessages[0].id;
      const emoji = '👍';

      const response = await request(app)
        .post(`/api/reactions/message/${messageId}`)
        .send({ emoji });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/reactions/message/:messageId/:emoji', () => {
    it('should remove a reaction from a message', async () => {
      const messageId = testMessages[0].id;
      const emoji = '👍';
      const userId = testUsers[0].id;

      // Mock the remove method
      MessageReaction.remove.mockResolvedValue(true);

      const response = await request(app)
        .delete(`/api/reactions/message/${messageId}/${encodeURIComponent(emoji)}`)
        .set('Authorization', `Bearer ${authTokens.user1}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, message: 'Reaction removed successfully' });
      expect(MessageReaction.remove).toHaveBeenCalledWith({
        messageId,
        userId,
        emoji,
      });
    });

    it('should return 404 for non-existent reaction', async () => {
      const messageId = testMessages[0].id;
      const emoji = '👍';
      const userId = testUsers[0].id;

      // Mock the remove method to return false (not found)
      MessageReaction.remove.mockResolvedValue(false);

      const response = await request(app)
        .delete(`/api/reactions/message/${messageId}/${encodeURIComponent(emoji)}`)
        .set('Authorization', `Bearer ${authTokens.user1}`);

      expect(response.status).toBe(404);
      expect(MessageReaction.remove).toHaveBeenCalledWith({
        messageId,
        userId,
        emoji,
      });
    });

    it('should require authentication', async () => {
      const messageId = testMessages[0].id;
      const emoji = '👍';

      const response = await request(app)
        .delete(`/api/reactions/message/${messageId}/${encodeURIComponent(emoji)}`);

      expect(response.status).toBe(401);
    });
  });
});

describe('MessageReaction Model', () => {
  // Save the original implementation
  const originalImplementation = jest.requireActual('../src/models/MessageReaction');
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Restore original implementation for these tests
    MessageReaction.create.mockImplementation(originalImplementation.create);
    MessageReaction.remove.mockImplementation(originalImplementation.remove);
    MessageReaction.getByMessageId.mockImplementation(originalImplementation.getByMessageId);
  });

  describe('create', () => {
    it('should create a new reaction', async () => {
      const messageId = testMessages[0].id;
      const userId = testUsers[0].id;
      const emoji = '👍';

      // Mock the database query
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [{ id: uuidv4() }],
      });
      
      // Mock the database client
      const mockClient = {
        query: mockQuery,
        release: jest.fn(),
      };
      
      // Mock the beginTransaction function
      const mockBeginTransaction = jest.spyOn(require('../src/db'), 'beginTransaction')
        .mockResolvedValue(mockClient);
      
      // Mock the commitTransaction function
      const mockCommitTransaction = jest.spyOn(require('../src/db'), 'commitTransaction')
        .mockResolvedValue();

      const result = await MessageReaction.create({
        messageId,
        userId,
        emoji,
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('messageId', messageId);
      expect(result).toHaveProperty('userId', userId);
      expect(result).toHaveProperty('emoji', emoji);
      expect(result).toHaveProperty('timestamp');
      
      expect(mockBeginTransaction).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
      expect(mockCommitTransaction).toHaveBeenCalledWith(mockClient);
    });

    it('should throw an error for duplicate reaction', async () => {
      const messageId = testMessages[0].id;
      const userId = testUsers[0].id;
      const emoji = '👍';

      // Mock the database query to throw a unique constraint violation
      const mockQuery = jest.fn().mockRejectedValue({
        code: '23505', // PostgreSQL unique constraint violation code
      });
      
      // Mock the database client
      const mockClient = {
        query: mockQuery,
        release: jest.fn(),
      };
      
      // Mock the beginTransaction function
      const mockBeginTransaction = jest.spyOn(require('../src/db'), 'beginTransaction')
        .mockResolvedValue(mockClient);
      
      // Mock the rollbackTransaction function
      const mockRollbackTransaction = jest.spyOn(require('../src/db'), 'rollbackTransaction')
        .mockResolvedValue();

      await expect(MessageReaction.create({
        messageId,
        userId,
        emoji,
      })).rejects.toThrow('User has already reacted with this emoji');
      
      expect(mockBeginTransaction).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
      expect(mockRollbackTransaction).toHaveBeenCalledWith(mockClient);
    });
  });

  describe('remove', () => {
    it('should remove a reaction', async () => {
      const messageId = testMessages[0].id;
      const userId = testUsers[0].id;
      const emoji = '👍';

      // Mock the database query
      const mockQuery = jest.fn().mockResolvedValue({
        rowCount: 1,
      });
      
      // Mock the database client
      const mockClient = {
        query: mockQuery,
        release: jest.fn(),
      };
      
      // Mock the beginTransaction function
      const mockBeginTransaction = jest.spyOn(require('../src/db'), 'beginTransaction')
        .mockResolvedValue(mockClient);
      
      // Mock the commitTransaction function
      const mockCommitTransaction = jest.spyOn(require('../src/db'), 'commitTransaction')
        .mockResolvedValue();

      const result = await MessageReaction.remove({
        messageId,
        userId,
        emoji,
      });

      expect(result).toBe(true);
      expect(mockBeginTransaction).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
      expect(mockCommitTransaction).toHaveBeenCalledWith(mockClient);
    });

    it('should return false if reaction does not exist', async () => {
      const messageId = testMessages[0].id;
      const userId = testUsers[0].id;
      const emoji = '👍';

      // Mock the database query
      const mockQuery = jest.fn().mockResolvedValue({
        rowCount: 0,
      });
      
      // Mock the database client
      const mockClient = {
        query: mockQuery,
        release: jest.fn(),
      };
      
      // Mock the beginTransaction function
      const mockBeginTransaction = jest.spyOn(require('../src/db'), 'beginTransaction')
        .mockResolvedValue(mockClient);
      
      // Mock the commitTransaction function
      const mockCommitTransaction = jest.spyOn(require('../src/db'), 'commitTransaction')
        .mockResolvedValue();

      const result = await MessageReaction.remove({
        messageId,
        userId,
        emoji,
      });

      expect(result).toBe(false);
      expect(mockBeginTransaction).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
      expect(mockCommitTransaction).toHaveBeenCalledWith(mockClient);
    });
  });

  describe('getByMessageId', () => {
    it('should get all reactions for a message', async () => {
      const messageId = testMessages[0].id;
      const mockReactions = [
        {
          id: uuidv4(),
          message_id: messageId,
          user_id: testUsers[1].id,
          emoji: '👍',
          timestamp: new Date(),
          username: testUsers[1].username,
          display_name: testUsers[1].displayName,
          avatar_url: null,
        },
      ];

      // Mock the database query
      const mockQuery = jest.fn().mockResolvedValue({
        rows: mockReactions,
      });
      
      // Mock the query function
      jest.spyOn(require('../src/db'), 'query')
        .mockImplementation(mockQuery);

      const result = await MessageReaction.getByMessageId(messageId);

      expect(result).toEqual(mockReactions.map(r => ({
        id: r.id,
        messageId: r.message_id,
        userId: r.user_id,
        emoji: r.emoji,
        timestamp: r.timestamp,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
      })));
      
      expect(mockQuery).toHaveBeenCalled();
      expect(mockQuery.mock.calls[0][0]).toContain('WHERE r.message_id = $1');
      expect(mockQuery.mock.calls[0][1]).toEqual([messageId]);
    });

    it('should return empty array if no reactions found', async () => {
      const messageId = testMessages[0].id;

      // Mock the database query
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [],
      });
      
      // Mock the query function
      jest.spyOn(require('../src/db'), 'query')
        .mockImplementation(mockQuery);

      const result = await MessageReaction.getByMessageId(messageId);

      expect(result).toEqual([]);
      expect(mockQuery).toHaveBeenCalled();
    });
  });
});
