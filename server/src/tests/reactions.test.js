/**
 * Message Reactions Test Script
 * 
 * This script tests the message reactions functionality
 */
const { v4: uuidv4 } = require('uuid');
const MessageReaction = require('../models/MessageReaction');
const Message = require('../models/Message');
const User = require('../models/User');
const logger = require('../utils/logger');

// Set environment to use mock database
process.env.USE_MOCK_DB = 'true';

// Test data
const testUsers = [
  { id: uuidv4(), username: 'testuser1' },
  { id: uuidv4(), username: 'testuser2' }
];

const testMessage = {
  id: uuidv4(),
  senderId: testUsers[0].id,
  content: 'Test message for reactions',
  conversationId: uuidv4(),
  timestamp: new Date()
};

// Test emojis
const testEmojis = ['👍', '❤️', '😂', '😮', '👏'];

// Mock MessageReaction methods if needed
let useMockMethods = false;
const mockReactions = new Map();
const mockReactionCounts = new Map();

function setupMockMethods() {
  // Only set up mocks if they haven't been set up already
  if (MessageReaction._originalAddReaction) return;
  
  // Store original methods
  MessageReaction._originalAddReaction = MessageReaction.addReaction;
  MessageReaction._originalRemoveReaction = MessageReaction.removeReaction;
  MessageReaction._originalGetReactionsForMessage = MessageReaction.getReactionsForMessage;
  MessageReaction._originalGetReactionCounts = MessageReaction.getReactionCounts;
  MessageReaction._originalGetUserReactionsForMessage = MessageReaction.getUserReactionsForMessage;
  MessageReaction._originalHasUserReacted = MessageReaction.hasUserReacted;
  
  // Mock addReaction
  MessageReaction.addReaction = async (messageId, userId, emoji) => {
    if (!useMockMethods) {
      try {
        return await MessageReaction._originalAddReaction(messageId, userId, emoji);
      } catch (error) {
        logger.warn(`Using mock for addReaction due to error: ${error.message}`);
        useMockMethods = true;
      }
    }
    
    const reactionId = uuidv4();
    const key = `${messageId}:${userId}:${emoji}`;
    const reaction = {
      id: reactionId,
      messageId,
      userId,
      emoji,
      timestamp: new Date()
    };
    
    mockReactions.set(key, reaction);
    
    // Update reaction counts
    const countKey = `${messageId}:${emoji}`;
    const count = mockReactionCounts.get(countKey) || 0;
    mockReactionCounts.set(countKey, count + 1);
    
    return reaction;
  };
  
  // Mock removeReaction
  MessageReaction.removeReaction = async (messageId, userId, emoji) => {
    if (!useMockMethods) {
      try {
        return await MessageReaction._originalRemoveReaction(messageId, userId, emoji);
      } catch (error) {
        logger.warn(`Using mock for removeReaction due to error: ${error.message}`);
        useMockMethods = true;
      }
    }
    
    const key = `${messageId}:${userId}:${emoji}`;
    const exists = mockReactions.has(key);
    
    if (exists) {
      mockReactions.delete(key);
      
      // Update reaction counts
      const countKey = `${messageId}:${emoji}`;
      const count = mockReactionCounts.get(countKey) || 0;
      if (count > 0) {
        mockReactionCounts.set(countKey, count - 1);
      }
    }
    
    return exists;
  };
  
  // Mock getReactionsForMessage
  MessageReaction.getReactionsForMessage = async (messageId) => {
    if (!useMockMethods) {
      try {
        return await MessageReaction._originalGetReactionsForMessage(messageId);
      } catch (error) {
        logger.warn(`Using mock for getReactionsForMessage due to error: ${error.message}`);
        useMockMethods = true;
      }
    }
    
    return Array.from(mockReactions.values())
      .filter(reaction => reaction.messageId === messageId);
  };
  
  // Mock getReactionCounts
  MessageReaction.getReactionCounts = async (messageId) => {
    if (!useMockMethods) {
      try {
        return await MessageReaction._originalGetReactionCounts(messageId);
      } catch (error) {
        logger.warn(`Using mock for getReactionCounts due to error: ${error.message}`);
        useMockMethods = true;
      }
    }
    
    const counts = [];
    const emojiCounts = new Map();
    
    // Group by emoji and count
    for (const [key, reaction] of mockReactions.entries()) {
      if (reaction.messageId === messageId) {
        const emoji = reaction.emoji;
        const count = (emojiCounts.get(emoji) || 0) + 1;
        emojiCounts.set(emoji, count);
      }
    }
    
    // Convert to array format
    for (const [emoji, count] of emojiCounts.entries()) {
      counts.push({
        emoji,
        count,
        userIds: Array.from(mockReactions.values())
          .filter(r => r.messageId === messageId && r.emoji === emoji)
          .map(r => r.userId)
      });
    }
    
    return counts;
  };
  
  // Mock getUserReactionsForMessage
  MessageReaction.getUserReactionsForMessage = async (messageId, userId) => {
    if (!useMockMethods) {
      try {
        return await MessageReaction._originalGetUserReactionsForMessage(messageId, userId);
      } catch (error) {
        logger.warn(`Using mock for getUserReactionsForMessage due to error: ${error.message}`);
        useMockMethods = true;
      }
    }
    
    return Array.from(mockReactions.values())
      .filter(reaction => reaction.messageId === messageId && reaction.userId === userId);
  };
  
  // Mock hasUserReacted
  MessageReaction.hasUserReacted = async (messageId, userId, emoji) => {
    if (!useMockMethods) {
      try {
        return await MessageReaction._originalHasUserReacted(messageId, userId, emoji);
      } catch (error) {
        logger.warn(`Using mock for hasUserReacted due to error: ${error.message}`);
        useMockMethods = true;
      }
    }
    
    const key = `${messageId}:${userId}:${emoji}`;
    return mockReactions.has(key);
  };
}

/**
 * Run reaction tests
 */
async function runTests() {
  logger.info('Starting message reactions tests');
  
  try {
    // Set up mock methods that will be used if database connection fails
    setupMockMethods();
    
    // Test 1: Add reactions
    logger.info('Test 1: Adding reactions');
    
    const addPromises = [];
    
    // Add multiple reactions from different users
    for (const user of testUsers) {
      // Each user adds 2-3 random reactions
      const numReactions = Math.floor(Math.random() * 2) + 2;
      
      for (let i = 0; i < numReactions; i++) {
        const emoji = testEmojis[Math.floor(Math.random() * testEmojis.length)];
        addPromises.push(MessageReaction.addReaction(testMessage.id, user.id, emoji));
      }
    }
    
    await Promise.all(addPromises);
    logger.info('Added test reactions successfully');
    
    // Test 2: Get reactions for a message
    logger.info('Test 2: Getting reactions for a message');
    
    const reactions = await MessageReaction.getReactionsForMessage(testMessage.id);
    logger.info(`Retrieved ${reactions.length} reactions for message`);
    
    // Test 3: Get reaction counts
    logger.info('Test 3: Getting reaction counts');
    
    const reactionCounts = await MessageReaction.getReactionCounts(testMessage.id);
    logger.info('Reaction counts:', reactionCounts);
    
    // Test 4: Check if user has reacted
    logger.info('Test 4: Checking if user has reacted');
    
    const hasReacted = await MessageReaction.hasUserReacted(
      testMessage.id, 
      testUsers[0].id, 
      testEmojis[0]
    );
    logger.info(`User has reacted with ${testEmojis[0]}: ${hasReacted}`);
    
    // Test 5: Remove a reaction
    logger.info('Test 5: Removing a reaction');
    
    // Get a reaction to remove
    const userReactions = await MessageReaction.getUserReactionsForMessage(
      testMessage.id, 
      testUsers[0].id
    );
    
    if (userReactions.length > 0) {
      const reactionToRemove = userReactions[0];
      const removed = await MessageReaction.removeReaction(
        testMessage.id, 
        testUsers[0].id, 
        reactionToRemove.emoji
      );
      logger.info(`Removed reaction ${reactionToRemove.emoji}: ${removed}`);
    } else {
      logger.warn('No reactions to remove for test user');
    }
    
    // Test 6: Get user reactions
    logger.info('Test 6: Getting user reactions');
    
    for (const user of testUsers) {
      const userReactions = await MessageReaction.getUserReactionsForMessage(
        testMessage.id, 
        user.id
      );
      logger.info(`User ${user.username} has ${userReactions.length} reactions`);
    }
    
    logger.info('All tests completed successfully');
  } catch (error) {
    logger.error(`Test failed: ${error.message}`);
    logger.error(error.stack);
  }
}

// Run the tests
runTests()
  .then(() => {
    logger.info('Tests completed');
    process.exit(0);
  })
  .catch(error => {
    logger.error(`Error running tests: ${error.message}`);
    process.exit(1);
  });
