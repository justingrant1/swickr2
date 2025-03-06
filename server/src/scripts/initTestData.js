require('dotenv').config();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool, initDatabase } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Initialize test data for development
 */
const initTestData = async () => {
  try {
    logger.info('Initializing test data...');
    
    // Make sure database tables exist
    await initDatabase();
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create test users
      const passwordHash = await bcrypt.hash('password123', 10);
      
      // Check if users already exist
      const existingUsers = await client.query('SELECT COUNT(*) FROM users');
      
      if (parseInt(existingUsers.rows[0].count) === 0) {
        logger.info('Creating test users...');
        
        // Insert test users
        const users = [
          {
            id: uuidv4(),
            username: 'testuser1',
            email: 'user1@example.com',
            password_hash: passwordHash,
            full_name: 'Test User One',
            status: 'offline'
          },
          {
            id: uuidv4(),
            username: 'testuser2',
            email: 'user2@example.com',
            password_hash: passwordHash,
            full_name: 'Test User Two',
            status: 'offline'
          },
          {
            id: uuidv4(),
            username: 'testuser3',
            email: 'user3@example.com',
            password_hash: passwordHash,
            full_name: 'Test User Three',
            status: 'offline'
          },
          {
            id: uuidv4(),
            username: 'testuser4',
            email: 'user4@example.com',
            password_hash: passwordHash,
            full_name: 'Test User Four',
            status: 'offline'
          }
        ];
        
        for (const user of users) {
          await client.query(
            `INSERT INTO users (id, username, email, password_hash, full_name, status) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [user.id, user.username, user.email, user.password_hash, user.full_name, user.status]
          );
        }
        
        logger.info('Test users created successfully');
      } else {
        logger.info('Users already exist, skipping user creation');
      }
      
      // Get user IDs
      const userResult = await client.query('SELECT id, username FROM users');
      const users = userResult.rows;
      
      // Create contacts between users
      logger.info('Creating test contacts...');
      
      // Make users contacts with each other
      for (let i = 0; i < users.length; i++) {
        for (let j = 0; j < users.length; j++) {
          if (i !== j) { // Don't make a user a contact of themselves
            // Check if contact already exists
            const existingContact = await client.query(
              'SELECT COUNT(*) FROM contacts WHERE user_id = $1 AND contact_id = $2',
              [users[i].id, users[j].id]
            );
            
            if (parseInt(existingContact.rows[0].count) === 0) {
              await client.query(
                'INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2)',
                [users[i].id, users[j].id]
              );
            }
          }
        }
      }
      
      logger.info('Test contacts created successfully');
      
      // Create conversations between users
      logger.info('Creating test conversations...');
      
      for (let i = 0; i < users.length; i++) {
        for (let j = i + 1; j < users.length; j++) {
          // Check if conversation already exists
          const existingConversation = await client.query(
            `SELECT c.id
             FROM conversations c
             JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
             JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
             WHERE cp1.user_id = $1 AND cp2.user_id = $2
             LIMIT 1`,
            [users[i].id, users[j].id]
          );
          
          let conversationId;
          
          if (existingConversation.rows.length === 0) {
            // Create new conversation
            conversationId = uuidv4();
            const newConversation = await client.query(
              'INSERT INTO conversations (id, is_group, name) VALUES ($1, FALSE, NULL) RETURNING id',
              [conversationId]
            );
            
            // Add participants
            await client.query(
              'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
              [conversationId, users[i].id]
            );
            
            await client.query(
              'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
              [conversationId, users[j].id]
            );
          } else {
            conversationId = existingConversation.rows[0].id;
          }
          
          // Check if messages already exist for this conversation
          const existingMessages = await client.query(
            'SELECT COUNT(*) FROM messages WHERE conversation_id = $1',
            [conversationId]
          );
          
          if (parseInt(existingMessages.rows[0].count) === 0) {
            // Create test messages
            const messages = [
              {
                id: uuidv4(),
                sender_id: users[i].id,
                content: `Hello from ${users[i].username}!`,
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) // 2 days ago
              },
              {
                id: uuidv4(),
                sender_id: users[j].id,
                content: `Hi ${users[i].username}, how are you?`,
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 5) // 5 minutes later
              },
              {
                id: uuidv4(),
                sender_id: users[i].id,
                content: 'I\'m doing well, thanks for asking!',
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 10) // 10 minutes later
              },
              {
                id: uuidv4(),
                sender_id: users[j].id,
                content: 'Great! Let\'s catch up soon.',
                created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 15) // 15 minutes later
              }
            ];
            
            for (const message of messages) {
              await client.query(
                `INSERT INTO messages (id, conversation_id, sender_id, content, created_at) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [message.id, conversationId, message.sender_id, message.content, message.created_at]
              );
            }
          }
        }
      }
      
      logger.info('Test conversations and messages created successfully');
      
      await client.query('COMMIT');
      logger.info('Test data initialization completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error initializing test data:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to initialize test data:', error);
    process.exit(1);
  }
};

// Run if this script is executed directly
if (require.main === module) {
  initTestData()
    .then(() => {
      logger.info('Test data initialization script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Test data initialization script failed:', error);
      process.exit(1);
    });
}

module.exports = { initTestData };
