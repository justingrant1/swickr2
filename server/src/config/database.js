const { Pool } = require('pg');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Check if we should use mock database
const useMockDatabase = process.env.USE_MOCK_DB === 'true' || process.env.NODE_ENV === 'development';

// Mock database for development
class MockDatabase {
  constructor() {
    this.tables = {
      users: [],
      contacts: [],
      conversations: [],
      conversation_participants: [],
      messages: [],
      media: []
    };
    logger.warn('Using mock database - for development only');
  }

  async query(text, params = []) {
    logger.debug(`Mock query: ${text}`);
    logger.debug(`Params: ${JSON.stringify(params)}`);
    
    // Handle transaction statements
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }
    
    // Handle CREATE TABLE and CREATE EXTENSION statements
    if (text.includes('CREATE TABLE IF NOT EXISTS') || text.includes('CREATE EXTENSION IF NOT EXISTS')) {
      return { rows: [], rowCount: 0 };
    }
    
    // Handle COUNT queries
    if (text.includes('SELECT COUNT(*)')) {
      let tableName = '';
      if (text.includes('FROM users')) tableName = 'users';
      else if (text.includes('FROM contacts')) tableName = 'contacts';
      else if (text.includes('FROM conversations')) tableName = 'conversations';
      else if (text.includes('FROM messages')) tableName = 'messages';
      else if (text.includes('FROM media')) tableName = 'media';
      
      if (tableName) {
        return { 
          rows: [{ count: this.tables[tableName].length.toString() }],
          rowCount: 1
        };
      }
    }
    
    // Handle SELECT queries
    if (text.includes('SELECT') && !text.includes('INSERT') && !text.includes('UPDATE') && !text.includes('DELETE')) {
      // Simple implementation for SELECT queries
      if (text.includes('FROM users WHERE username = $1 OR email = $1')) {
        const usernameOrEmail = params[0];
        const user = this.tables.users.find(u => 
          u.username === usernameOrEmail || u.email === usernameOrEmail
        );
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }
      
      // Handle username lookup
      if (text.includes('FROM users WHERE username = $1')) {
        const username = params[0];
        logger.debug(`Mock DB: Looking for user with username: ${username}`);
        const user = this.tables.users.find(u => u.username === username);
        logger.debug(`Mock DB: User found: ${user ? 'Yes' : 'No'}`);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }
      
      // Handle email lookup
      if (text.includes('FROM users WHERE email = $1')) {
        const email = params[0];
        logger.debug(`Mock DB: Looking for user with email: ${email}`);
        const user = this.tables.users.find(u => u.email === email);
        logger.debug(`Mock DB: User found: ${user ? 'Yes' : 'No'}`);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }
      
      if (text.includes('FROM users WHERE id = $1')) {
        const userId = params[0];
        const user = this.tables.users.find(u => u.id === userId);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }
      
      // Handle conversation participant queries
      if (text.includes('FROM conversations c') && text.includes('JOIN conversation_participants cp1') && text.includes('JOIN conversation_participants cp2')) {
        // This is likely a query to find a direct conversation between two users
        const user1Id = params[0];
        const user2Id = params[1];
        
        logger.debug(`Looking for conversation between ${user1Id} and ${user2Id}`);
        
        // Find all conversations where both users are participants
        const conversations = this.tables.conversations.filter(c => !c.is_group);
        
        for (const conversation of conversations) {
          const participants = this.tables.conversation_participants.filter(
            cp => cp.conversation_id === conversation.id
          );
          
          // Check if both users are participants and there are exactly 2 participants
          const user1IsParticipant = participants.some(p => p.user_id === user1Id);
          const user2IsParticipant = participants.some(p => p.user_id === user2Id);
          
          if (user1IsParticipant && user2IsParticipant && participants.length === 2) {
            logger.debug(`Found existing conversation: ${conversation.id}`);
            return { rows: [{ id: conversation.id }], rowCount: 1 };
          }
        }
        
        // No matching conversation found
        logger.debug('No existing conversation found');
        return { rows: [], rowCount: 0 };
      }
      
      // Handle conversation by ID query
      if (text.includes('FROM conversations c') && text.includes('WHERE c.id = $1')) {
        const conversationId = params[0];
        const conversation = this.tables.conversations.find(c => c.id === conversationId);
        
        if (!conversation) {
          return { rows: [], rowCount: 0 };
        }
        
        // Get participants
        const participantIds = this.tables.conversation_participants
          .filter(cp => cp.conversation_id === conversationId)
          .map(cp => cp.user_id);
        
        const participants = participantIds.map(id => {
          const user = this.tables.users.find(u => u.id === id);
          return user ? {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            profilePicture: user.profile_picture,
            status: user.status,
            lastReadAt: null
          } : { id };
        });
        
        const result = {
          id: conversation.id,
          name: conversation.name,
          is_group: conversation.is_group,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
          participants: participants
        };
        
        return { rows: [result], rowCount: 1 };
      }
      
      // Handle messages by conversation ID query
      if (text.includes('FROM messages m') && text.includes('WHERE m.conversation_id = $1')) {
        const conversationId = params[0];
        logger.debug(`Mock DB: Looking for messages in conversation: ${conversationId}`);
        
        // Get messages for the conversation
        const messages = this.tables.messages.filter(m => m.conversation_id === conversationId);
        logger.debug(`Mock DB: Found ${messages.length} messages`);
        
        // Sort by created_at in descending order if requested
        if (text.includes('ORDER BY m.created_at DESC')) {
          messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
        // Apply limit and offset if provided
        let result = messages;
        if (text.includes('LIMIT') && params.length >= 2) {
          const limit = parseInt(params[params.length - 2]);
          const offset = parseInt(params[params.length - 1]);
          result = messages.slice(offset, offset + limit);
        }
        
        // Add sender information to each message
        const messagesWithSenders = result.map(message => {
          const sender = this.tables.users.find(u => u.id === message.sender_id) || {};
          return {
            ...message,
            sender_username: sender.username || 'unknown',
            sender_name: sender.full_name || 'Unknown User'
          };
        });
        
        return { rows: messagesWithSenders, rowCount: messagesWithSenders.length };
      }
      
      // Default empty response for SELECT
      return { rows: [], rowCount: 0 };
    }
    
    // Handle INSERT queries
    if (text.includes('INSERT INTO') && text.includes('RETURNING')) {
      const tableMatch = text.match(/INSERT INTO\s+(\w+)/);
      if (!tableMatch) {
        return { rows: [], rowCount: 0 };
      }
      
      const table = tableMatch[1];
      const returnFields = text.match(/RETURNING\s+(.*)/)[1].split(',').map(f => f.trim());
      
      const newRow = {};
      
      // Generate mock data based on params and table
      if (table === 'users') {
        newRow.id = params[0] || uuidv4();
        newRow.username = params[1] || 'mockuser';
        newRow.email = params[2] || 'mock@example.com';
        newRow.password_hash = params[3] || 'mockhash';
        newRow.full_name = params[4] || 'Mock User';
        newRow.profile_picture = null;
        newRow.status = params[5] || 'offline';
        newRow.last_seen = new Date().toISOString();
        newRow.created_at = new Date().toISOString();
        newRow.updated_at = new Date().toISOString();
      } else if (table === 'conversations') {
        newRow.id = params[0] || uuidv4();
        newRow.name = params[2] || null;
        newRow.is_group = params[1] === 'TRUE' || params[1] === true;
        newRow.created_at = new Date().toISOString();
        newRow.updated_at = new Date().toISOString();
      } else if (table === 'messages') {
        newRow.id = params[0] || uuidv4();
        newRow.conversation_id = params[1];
        newRow.sender_id = params[2];
        newRow.content = params[3];
        newRow.media_id = params[4];
        newRow.media_type = params[5];
        newRow.media_url = params[6];
        newRow.is_read = false;
        newRow.created_at = new Date().toISOString();
      } else if (table === 'contacts') {
        newRow.id = uuidv4();
        newRow.user_id = params[0];
        newRow.contact_id = params[1];
        newRow.created_at = new Date().toISOString();
      } else if (table === 'conversation_participants') {
        newRow.id = uuidv4();
        newRow.conversation_id = params[0];
        newRow.user_id = params[1];
        newRow.created_at = new Date().toISOString();
      }
      
      // Add to mock database
      this.tables[table].push(newRow);
      
      // Return only requested fields
      const result = {};
      returnFields.forEach(field => {
        const cleanField = field.split(' ').pop().trim(); // Handle aliases
        result[cleanField] = newRow[cleanField];
      });
      
      return { rows: [result], rowCount: 1 };
    }
    
    // Handle UPDATE queries
    if (text.includes('UPDATE')) {
      // For now, just return a success response
      return { rows: [], rowCount: 1 };
    }
    
    // Handle DELETE queries
    if (text.includes('DELETE')) {
      // For now, just return a success response
      return { rows: [], rowCount: 1 };
    }
    
    // Default empty response
    return { rows: [], rowCount: 0 };
  }
  
  async connect() {
    return {
      query: this.query.bind(this),
      release: () => {},
      on: () => {}
    };
  }
  
  on(event, callback) {
    if (event === 'connect') {
      callback();
    }
  }
}

// Create a PostgreSQL connection pool or mock database
let pool;
let mockPool;

if (useMockDatabase) {
  mockPool = new MockDatabase();
  pool = {
    query: (...args) => mockPool.query(...args),
    connect: () => mockPool.connect(),
    on: (...args) => mockPool.on(...args)
  };
  logger.info('Using mock database for development');
} else {
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'swickr',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
  });

  // Test the database connection
  pool.on('connect', () => {
    logger.info('Connected to PostgreSQL database');
  });

  pool.on('error', (err) => {
    logger.error('PostgreSQL pool error:', err);
  });
}

// Initialize database tables if they don't exist
const initDatabase = async () => {
  if (useMockDatabase) {
    logger.info('Initializing mock database tables...');
    // No need to create tables for mock database
    logger.info('Mock database tables initialized successfully');
    return;
  }
  
  const client = await pool.connect();
  try {
    logger.info('Initializing database tables...');
    
    // Enable UUID extension if not already enabled
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        full_name VARCHAR(100),
        profile_picture VARCHAR(255),
        status VARCHAR(20) DEFAULT 'offline',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create contacts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, contact_id)
      )
    `);
    
    // Create conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100),
        is_group BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create conversation participants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conversation_id, user_id)
      )
    `);
    
    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT,
        media_id VARCHAR(100),
        media_type VARCHAR(50),
        media_url VARCHAR(255),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create media table
    await client.query(`
      CREATE TABLE IF NOT EXISTS media (
        id VARCHAR(36) PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        media_type VARCHAR(20) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        thumbnail_path VARCHAR(255),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add indexes for media table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_media_media_type ON media(media_type)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_media_conversation_id ON media(conversation_id)
    `);
    
    logger.info('Database tables initialized successfully');
  } catch (error) {
    logger.error('Error initializing database tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDatabase
};
