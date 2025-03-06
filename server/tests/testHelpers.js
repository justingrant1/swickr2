const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');
const Conversation = require('../src/models/Conversation');
const ConversationMember = require('../src/models/ConversationMember');

/**
 * Create a test user
 * 
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} name - User name
 * @returns {Promise<Object>} - Created user object
 */
const createUser = async (email, password, name) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  
  const user = new User({
    id: userId,
    email,
    password: hashedPassword,
    name,
    avatar: null,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  await user.save();
  return user;
};

/**
 * Create a test conversation
 * 
 * @param {string} creatorId - ID of the conversation creator
 * @param {string} name - Conversation name
 * @returns {Promise<Object>} - Created conversation object
 */
const createConversation = async (creatorId, name) => {
  const conversationId = uuidv4();
  
  const conversation = new Conversation({
    id: conversationId,
    name,
    type: 'group',
    createdBy: creatorId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  await conversation.save();
  
  // Add creator as a member
  const member = new ConversationMember({
    id: uuidv4(),
    conversationId,
    userId: creatorId,
    role: 'admin',
    joinedAt: new Date()
  });
  
  await member.save();
  
  return conversation;
};

/**
 * Add a user to a conversation
 * 
 * @param {string} conversationId - ID of the conversation
 * @param {string} userId - ID of the user to add
 * @param {string} role - User role in the conversation (default: 'member')
 * @returns {Promise<Object>} - Created conversation member object
 */
const addUserToConversation = async (conversationId, userId, role = 'member') => {
  const member = new ConversationMember({
    id: uuidv4(),
    conversationId,
    userId,
    role,
    joinedAt: new Date()
  });
  
  await member.save();
  return member;
};

/**
 * Create a test fixtures directory
 * 
 * @param {string} dirPath - Path to create
 * @returns {void}
 */
const createFixturesDir = (dirPath) => {
  const fs = require('fs');
  const path = require('path');
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Clean up test data
 * 
 * @param {Object} options - Cleanup options
 * @param {Array<string>} options.userIds - User IDs to delete
 * @param {Array<string>} options.conversationIds - Conversation IDs to delete
 * @returns {Promise<void>}
 */
const cleanupTestData = async ({ userIds = [], conversationIds = [] }) => {
  if (userIds.length > 0) {
    await User.deleteMany({ id: { $in: userIds } });
  }
  
  if (conversationIds.length > 0) {
    await Conversation.deleteMany({ id: { $in: conversationIds } });
    await ConversationMember.deleteMany({ conversationId: { $in: conversationIds } });
  }
};

module.exports = {
  createUser,
  createConversation,
  addUserToConversation,
  createFixturesDir,
  cleanupTestData
};
