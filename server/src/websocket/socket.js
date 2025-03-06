const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const MessageReaction = require('../models/MessageReaction');
const { JWT_SECRET } = require('../config/auth');

// Map of userId to socketId
const userSockets = new Map();

// Map of userId to presence data
const userPresence = new Map();

// Map of conversationId to set of active user IDs
const activeConversations = new Map();

// Map of userId to typing status by conversation
const typingStatus = new Map();

// Map of userId to inactivity timeout
const inactivityTimeouts = new Map();

// Map of userId to encrypted presence preferences
const encryptedPresencePreferences = new Map();

// Constants
const AWAY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const OFFLINE_GRACE_PERIOD = 5 * 1000; // 5 seconds

// Initialize socket.io server
function initializeSocketServer(server) {
  const io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token not provided'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      logger.error(`Socket authentication error: ${error.message}`);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`User connected: ${userId}`);

    // Store socket connection
    userSockets.set(userId, socket.id);
    
    // Initialize user presence
    userPresence.set(userId, {
      status: 'online',
      lastActive: new Date(),
      device: socket.handshake.headers['user-agent'] || 'unknown'
    });
    
    // Clear any existing inactivity timeout
    if (inactivityTimeouts.has(userId)) {
      clearTimeout(inactivityTimeouts.get(userId));
      inactivityTimeouts.delete(userId);
    }
    
    // Set inactivity timeout to automatically set status to away
    const inactivityTimeout = setTimeout(() => {
      if (userPresence.has(userId) && userPresence.get(userId).status === 'online') {
        userPresence.set(userId, {
          ...userPresence.get(userId),
          status: 'away',
          lastActive: new Date()
        });
        
        // Broadcast away status
        broadcastUserStatus(io, userId, 'away');
      }
    }, AWAY_TIMEOUT);
    
    inactivityTimeouts.set(userId, inactivityTimeout);
    
    // Broadcast user's online status to their contacts
    broadcastUserStatus(io, userId, 'online');

    // Handle user status
    socket.on('status', async (status) => {
      try {
        // Validate status
        if (!['online', 'away', 'busy', 'offline'].includes(status)) {
          socket.emit('error', { message: 'Invalid status' });
          return;
        }
        
        // Update user status in database
        await User.updateStatus(userId, status);
        
        // Update presence cache
        userPresence.set(userId, {
          ...userPresence.get(userId),
          status,
          lastActive: new Date()
        });

        // Broadcast status to all connected users who are contacts
        broadcastUserStatus(io, userId, status);
      } catch (error) {
        logger.error(`Error updating user status: ${error.message}`);
      }
    });

    // Handle user activity
    socket.on('user_activity', () => {
      try {
        // Update last active timestamp
        if (userPresence.has(userId)) {
          userPresence.set(userId, {
            ...userPresence.get(userId),
            lastActive: new Date()
          });
        }
        
        // If user was away, set them back to online
        if (userPresence.has(userId) && userPresence.get(userId).status === 'away') {
          userPresence.set(userId, {
            ...userPresence.get(userId),
            status: 'online'
          });
          
          // Broadcast online status
          broadcastUserStatus(io, userId, 'online');
        }
        
        // Reset inactivity timeout
        if (inactivityTimeouts.has(userId)) {
          clearTimeout(inactivityTimeouts.get(userId));
        }
        
        const inactivityTimeout = setTimeout(() => {
          if (userPresence.has(userId) && userPresence.get(userId).status === 'online') {
            userPresence.set(userId, {
              ...userPresence.get(userId),
              status: 'away',
              lastActive: new Date()
            });
            
            // Broadcast away status
            broadcastUserStatus(io, userId, 'away');
          }
        }, AWAY_TIMEOUT);
        
        inactivityTimeouts.set(userId, inactivityTimeout);
      } catch (error) {
        logger.error(`Error handling user activity: ${error.message}`);
      }
    });

    // Handle new message
    socket.on('message', async (data) => {
      try {
        const { conversationId, content, mediaId, mediaType, mediaUrl, mediaCaption, mediaSize, mediaMimeType, isEncrypted, encryptedContent, iv, recipientKeys } = data;

        // Validate required fields
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        // Validate that either content or media is provided
        if (!isEncrypted && !content && !mediaId) {
          socket.emit('error', { message: 'Message must have either content or media' });
          return;
        }
        
        // For encrypted messages, validate required fields
        if (isEncrypted && (!encryptedContent || !iv || !recipientKeys)) {
          socket.emit('error', { message: 'Encrypted messages require encryptedContent, iv, and recipientKeys' });
          return;
        }

        // Create message
        const message = await Message.create({
          senderId: userId,
          conversationId,
          content: isEncrypted ? '' : content,
          encryptedContent,
          iv,
          recipientKeys,
          isEncrypted,
          mediaId,
          mediaType,
          mediaUrl,
          mediaCaption,
          mediaSize,
          mediaMimeType,
          status: 'sent'
        });

        // Get conversation participants
        const conversation = await Conversation.getById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        // Send message to all participants
        conversation.participants.forEach(participant => {
          const participantSocketId = userSockets.get(participant.id);
          if (participantSocketId) {
            io.to(participantSocketId).emit('new_message', {
              ...message,
              senderName: participant.id === userId ? 'You' : conversation.participants.find(p => p.id === userId)?.username
            });
            
            // Send delivery confirmation to sender if recipient is online
            if (participant.id !== userId) {
              socket.emit('message_delivered', {
                messageId: message.id,
                userId: participant.id,
                timestamp: new Date()
              });
              
              // Update message status to delivered
              Message.updateStatus(message.id, 'delivered');
            }
          }
        });

        // Send typing stopped event to all participants
        conversation.participants.forEach(participant => {
          if (participant.id !== userId) {
            const participantSocketId = userSockets.get(participant.id);
            if (participantSocketId) {
              io.to(participantSocketId).emit('typing_stopped', { conversationId, userId });
            }
          }
        });

        // Clear typing status for this user in this conversation
        if (typingStatus.has(userId)) {
          const userTypingStatus = typingStatus.get(userId);
          if (userTypingStatus.has(conversationId)) {
            userTypingStatus.delete(conversationId);
          }
        }

        // Acknowledge message receipt
        socket.emit('message_sent', { messageId: message.id, timestamp: new Date() });
      } catch (error) {
        logger.error(`Error handling message: ${error.message}`);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle read receipts
    socket.on('read_receipt', async (data) => {
      try {
        const { messageId, conversationId } = data;
        
        // Validate required fields
        if (!messageId && !conversationId) {
          socket.emit('error', { message: 'Either messageId or conversationId is required' });
          return;
        }
        
        let updatedCount = 0;
        
        if (messageId) {
          // Mark specific message as read
          const success = await Message.updateStatus(messageId, 'read');
          updatedCount = success ? 1 : 0;
        } else if (conversationId) {
          // Mark all messages in conversation as read
          updatedCount = await Message.markAsRead(conversationId, userId);
        }
        
        if (updatedCount > 0) {
          // Get conversation to notify other participants
          let conversation;
          
          if (conversationId) {
            conversation = await Conversation.getById(conversationId);
          } else {
            // Get conversation from message
            const message = await Message.getById(messageId);
            if (message) {
              conversation = await Conversation.getById(message.conversationId);
            }
          }
          
          if (conversation) {
            // Notify sender that their messages were read
            conversation.participants.forEach(participant => {
              if (participant.id !== userId) {
                const participantSocketId = userSockets.get(participant.id);
                if (participantSocketId) {
                  io.to(participantSocketId).emit('message_read', {
                    conversationId: conversation.id,
                    userId,
                    timestamp: new Date()
                  });
                }
              }
            });
          }
        }
        
        // Acknowledge read receipt
        socket.emit('read_receipt_confirmed', { 
          success: true,
          count: updatedCount,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error(`Error handling read receipt: ${error.message}`);
        socket.emit('error', { message: 'Failed to process read receipt' });
      }
    });

    // Handle typing events
    socket.on('typing', async (data) => {
      try {
        const { conversationId } = data;
        
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        // Store typing status
        if (!typingStatus.has(userId)) {
          typingStatus.set(userId, new Map());
        }
        
        typingStatus.get(userId).set(conversationId, new Date());

        // Get conversation participants
        const conversation = await Conversation.getById(conversationId);
        if (!conversation) {
          return;
        }

        // Send typing event to all participants except sender
        conversation.participants.forEach(participant => {
          if (participant.id !== userId) {
            const participantSocketId = userSockets.get(participant.id);
            if (participantSocketId) {
              io.to(participantSocketId).emit('typing', { 
                conversationId, 
                userId,
                username: conversation.participants.find(p => p.id === userId)?.username
              });
            }
          }
        });
      } catch (error) {
        logger.error(`Error handling typing event: ${error.message}`);
      }
    });

    // Handle typing stopped events
    socket.on('typing_stopped', async (data) => {
      try {
        const { conversationId } = data;
        
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }

        // Clear typing status
        if (typingStatus.has(userId)) {
          typingStatus.get(userId).delete(conversationId);
        }

        // Get conversation participants
        const conversation = await Conversation.getById(conversationId);
        if (!conversation) {
          return;
        }

        // Send typing stopped event to all participants except sender
        conversation.participants.forEach(participant => {
          if (participant.id !== userId) {
            const participantSocketId = userSockets.get(participant.id);
            if (participantSocketId) {
              io.to(participantSocketId).emit('typing_stopped', { conversationId, userId });
            }
          }
        });
      } catch (error) {
        logger.error(`Error handling typing stopped event: ${error.message}`);
      }
    });

    // Handle message reactions
    socket.on('message:reaction:add', async (data) => {
      try {
        const { messageId, emoji } = data;
        
        if (!messageId || !emoji) {
          socket.emit('error', { message: 'Message ID and emoji are required' });
          return;
        }
        
        // Get the message to check permissions
        const message = await Message.getById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }
        
        // Check if user has access to the conversation
        const conversation = await Conversation.getById(message.conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        
        // Verify user is a participant in the conversation
        const isParticipant = conversation.participants.some(p => p.id === userId);
        if (!isParticipant) {
          socket.emit('error', { message: 'You do not have permission to react to this message' });
          return;
        }
        
        // Add reaction
        const reaction = await MessageReaction.addReaction(messageId, userId, emoji);
        
        // Notify all participants in the conversation
        conversation.participants.forEach(participant => {
          const participantSocketId = userSockets.get(participant.id);
          if (participantSocketId) {
            io.to(participantSocketId).emit('message:reaction:add', {
              messageId,
              userId,
              emoji,
              username: conversation.participants.find(p => p.id === userId)?.username,
              timestamp: new Date()
            });
          }
        });
        
        // Acknowledge reaction
        socket.emit('reaction_confirmed', { 
          success: true,
          messageId,
          emoji,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error(`Error handling message reaction: ${error.message}`);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });
    
    // Handle message reaction removal
    socket.on('message:reaction:remove', async (data) => {
      try {
        const { messageId, emoji } = data;
        
        if (!messageId || !emoji) {
          socket.emit('error', { message: 'Message ID and emoji are required' });
          return;
        }
        
        // Get the message to check permissions
        const message = await Message.getById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }
        
        // Check if user has access to the conversation
        const conversation = await Conversation.getById(message.conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        
        // Verify user is a participant in the conversation
        const isParticipant = conversation.participants.some(p => p.id === userId);
        if (!isParticipant) {
          socket.emit('error', { message: 'You do not have permission to remove reactions from this message' });
          return;
        }
        
        // Remove reaction
        const success = await MessageReaction.removeReaction(messageId, userId, emoji);
        
        if (success) {
          // Notify all participants in the conversation
          conversation.participants.forEach(participant => {
            const participantSocketId = userSockets.get(participant.id);
            if (participantSocketId) {
              io.to(participantSocketId).emit('message:reaction:remove', {
                messageId,
                userId,
                emoji,
                username: conversation.participants.find(p => p.id === userId)?.username,
                timestamp: new Date()
              });
            }
          });
          
          // Acknowledge reaction removal
          socket.emit('reaction_removal_confirmed', { 
            success: true,
            messageId,
            emoji,
            timestamp: new Date()
          });
        } else {
          socket.emit('error', { message: 'Reaction not found or already removed' });
        }
      } catch (error) {
        logger.error(`Error handling message reaction removal: ${error.message}`);
        socket.emit('error', { message: 'Failed to remove reaction' });
      }
    });

    // Handle join conversation (for presence tracking)
    socket.on('join_conversation', async (conversationId) => {
      try {
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }
        
        // Add user to active conversation
        if (!activeConversations.has(conversationId)) {
          activeConversations.set(conversationId, new Set());
        }
        
        activeConversations.get(conversationId).add(userId);
        
        // Get conversation participants
        const conversation = await Conversation.getById(conversationId);
        if (!conversation) {
          return;
        }
        
        // Notify other participants that user joined
        conversation.participants.forEach(participant => {
          if (participant.id !== userId) {
            const participantSocketId = userSockets.get(participant.id);
            if (participantSocketId) {
              io.to(participantSocketId).emit('conversation_presence', { 
                conversationId,
                userId,
                action: 'join',
                activeUsers: Array.from(activeConversations.get(conversationId))
              });
            }
          }
        });
        
        // Send current active users to the joining user
        socket.emit('conversation_presence', {
          conversationId,
          activeUsers: Array.from(activeConversations.get(conversationId)),
          action: 'current'
        });
        
        // Mark conversation as read when joined
        await Message.markAsRead(conversationId, userId);
        
        // Notify senders that their messages were read
        conversation.participants.forEach(participant => {
          if (participant.id !== userId) {
            const participantSocketId = userSockets.get(participant.id);
            if (participantSocketId) {
              io.to(participantSocketId).emit('message_read', {
                conversationId,
                userId,
                timestamp: new Date()
              });
            }
          }
        });
      } catch (error) {
        logger.error(`Error joining conversation: ${error.message}`);
      }
    });

    // Handle leave conversation (for presence tracking)
    socket.on('leave_conversation', async (conversationId) => {
      try {
        if (!conversationId) {
          socket.emit('error', { message: 'Conversation ID is required' });
          return;
        }
        
        // Remove user from active conversation
        if (activeConversations.has(conversationId)) {
          activeConversations.get(conversationId).delete(userId);
          
          // Clean up if no users are active
          if (activeConversations.get(conversationId).size === 0) {
            activeConversations.delete(conversationId);
          }
        }
        
        // Get conversation participants
        const conversation = await Conversation.getById(conversationId);
        if (!conversation) {
          return;
        }
        
        // Notify other participants that user left
        conversation.participants.forEach(participant => {
          if (participant.id !== userId) {
            const participantSocketId = userSockets.get(participant.id);
            if (participantSocketId) {
              io.to(participantSocketId).emit('conversation_presence', { 
                conversationId,
                userId,
                action: 'leave',
                activeUsers: activeConversations.has(conversationId) 
                  ? Array.from(activeConversations.get(conversationId))
                  : []
              });
            }
          }
        });
        
        // Clear typing status for this conversation
        if (typingStatus.has(userId)) {
          typingStatus.get(userId).delete(conversationId);
        }
      } catch (error) {
        logger.error(`Error leaving conversation: ${error.message}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${userId}`);
      
      // Don't immediately mark as offline - use a grace period
      // This helps with brief disconnections (page refresh, network hiccup)
      const offlineTimeout = setTimeout(() => {
        // Only mark as offline if they haven't reconnected
        if (userSockets.get(userId) === socket.id) {
          userSockets.delete(userId);
          
          // Update presence cache
          if (userPresence.has(userId)) {
            userPresence.set(userId, {
              ...userPresence.get(userId),
              status: 'offline',
              lastActive: new Date()
            });
          }
          
          // Broadcast offline status
          broadcastUserStatus(io, userId, 'offline');
          
          // Remove from all active conversations
          for (const [conversationId, activeUsers] of activeConversations.entries()) {
            if (activeUsers.has(userId)) {
              activeUsers.delete(userId);
              
              // Notify other participants
              notifyConversationParticipants(io, conversationId, userId, 'leave');
              
              // Clean up if no users are active
              if (activeUsers.size === 0) {
                activeConversations.delete(conversationId);
              }
            }
          }
          
          // Clear typing status
          typingStatus.delete(userId);
          
          // Update user status in database
          User.updateStatus(userId, 'offline').catch(error => {
            logger.error(`Error updating user status: ${error.message}`);
          });
        }
      }, OFFLINE_GRACE_PERIOD);
      
      // Clear any existing inactivity timeout
      if (inactivityTimeouts.has(userId)) {
        clearTimeout(inactivityTimeouts.get(userId));
        inactivityTimeouts.delete(userId);
      }
    });

    // Handle encrypted read receipt
    socket.on('encrypted_read_receipt', async (data) => {
      try {
        const { conversationId, encryptedContent, iv, recipientKeys } = data;
        
        // Validate required fields
        if (!conversationId || !encryptedContent || !iv || !recipientKeys) {
          socket.emit('error', { message: 'Missing required fields for encrypted read receipt' });
          return;
        }
        
        // Get conversation participants
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        
        // Verify user is a participant
        if (!conversation.participants.includes(userId)) {
          socket.emit('error', { message: 'Unauthorized access to conversation' });
          return;
        }
        
        // Forward the encrypted read receipt to all participants
        conversation.participants.forEach(participantId => {
          if (participantId !== userId && userSockets.has(participantId)) {
            io.to(userSockets.get(participantId)).emit('encrypted_read_receipt', {
              conversationId,
              encryptedContent,
              iv,
              recipientKeys
            });
          }
        });
        
        // Log the encrypted read receipt
        logger.info(`Encrypted read receipt sent in conversation ${conversationId} by user ${userId}`);
      } catch (error) {
        logger.error(`Error handling encrypted read receipt: ${error.message}`);
        socket.emit('error', { message: 'Failed to process encrypted read receipt' });
      }
    });
    
    // Handle encrypted delivery receipt
    socket.on('encrypted_delivery_receipt', async (data) => {
      try {
        const { conversationId, encryptedContent, iv, recipientKeys } = data;
        
        // Validate required fields
        if (!conversationId || !encryptedContent || !iv || !recipientKeys) {
          socket.emit('error', { message: 'Missing required fields for encrypted delivery receipt' });
          return;
        }
        
        // Get conversation participants
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        
        // Verify user is a participant
        if (!conversation.participants.includes(userId)) {
          socket.emit('error', { message: 'Unauthorized access to conversation' });
          return;
        }
        
        // Forward the encrypted delivery receipt to all participants
        conversation.participants.forEach(participantId => {
          if (participantId !== userId && userSockets.has(participantId)) {
            io.to(userSockets.get(participantId)).emit('encrypted_delivery_receipt', {
              conversationId,
              encryptedContent,
              iv,
              recipientKeys
            });
          }
        });
        
        // Log the encrypted delivery receipt
        logger.info(`Encrypted delivery receipt sent in conversation ${conversationId} by user ${userId}`);
      } catch (error) {
        logger.error(`Error handling encrypted delivery receipt: ${error.message}`);
        socket.emit('error', { message: 'Failed to process encrypted delivery receipt' });
      }
    });
    
    // Handle encrypted typing indicator
    socket.on('encrypted_typing', async (data) => {
      try {
        const { conversationId, encryptedContent, iv, recipientKeys } = data;
        
        // Validate required fields
        if (!conversationId || !encryptedContent || !iv || !recipientKeys) {
          socket.emit('error', { message: 'Missing required fields for encrypted typing indicator' });
          return;
        }
        
        // Get conversation participants
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        
        // Verify user is a participant
        if (!conversation.participants.includes(userId)) {
          socket.emit('error', { message: 'Unauthorized access to conversation' });
          return;
        }
        
        // Forward the encrypted typing indicator to all participants
        conversation.participants.forEach(participantId => {
          if (participantId !== userId && userSockets.has(participantId)) {
            io.to(userSockets.get(participantId)).emit('encrypted_typing', {
              conversationId,
              encryptedContent,
              iv,
              recipientKeys
            });
          }
        });
      } catch (error) {
        logger.error(`Error handling encrypted typing indicator: ${error.message}`);
        socket.emit('error', { message: 'Failed to process encrypted typing indicator' });
      }
    });
    
    // Handle encrypted typing stopped indicator
    socket.on('encrypted_typing_stopped', async (data) => {
      try {
        const { conversationId, encryptedContent, iv, recipientKeys } = data;
        
        // Validate required fields
        if (!conversationId || !encryptedContent || !iv || !recipientKeys) {
          socket.emit('error', { message: 'Missing required fields for encrypted typing stopped indicator' });
          return;
        }
        
        // Get conversation participants
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        
        // Verify user is a participant
        if (!conversation.participants.includes(userId)) {
          socket.emit('error', { message: 'Unauthorized access to conversation' });
          return;
        }
        
        // Forward the encrypted typing stopped indicator to all participants
        conversation.participants.forEach(participantId => {
          if (participantId !== userId && userSockets.has(participantId)) {
            io.to(userSockets.get(participantId)).emit('encrypted_typing_stopped', {
              conversationId,
              encryptedContent,
              iv,
              recipientKeys
            });
          }
        });
      } catch (error) {
        logger.error(`Error handling encrypted typing stopped indicator: ${error.message}`);
        socket.emit('error', { message: 'Failed to process encrypted typing stopped indicator' });
      }
    });
    
    // Handle encrypted presence preferences
    socket.on('encrypted_presence_preferences', (preferences) => {
      try {
        // Store user's encrypted presence preferences
        encryptedPresencePreferences.set(userId, {
          encryptReadReceipts: preferences.encryptReadReceipts || false,
          encryptTypingIndicators: preferences.encryptTypingIndicators || false,
          encryptPresenceUpdates: preferences.encryptPresenceUpdates || false
        });
        
        logger.info(`Updated encrypted presence preferences for user ${userId}`);
      } catch (error) {
        logger.error(`Error handling encrypted presence preferences: ${error.message}`);
        socket.emit('error', { message: 'Failed to update encrypted presence preferences' });
      }
    });
  });

  return io;
}

// Broadcast user status to contacts
async function broadcastUserStatus(io, userId, status) {
  try {
    // Get user's contacts
    const user = await User.getById(userId);
    if (!user || !user.contacts) {
      return;
    }
    
    // Broadcast status to all online contacts
    user.contacts.forEach(contactId => {
      const contactSocketId = userSockets.get(contactId);
      if (contactSocketId) {
        io.to(contactSocketId).emit('user_status', { 
          userId, 
          status,
          timestamp: new Date()
        });
      }
    });
  } catch (error) {
    logger.error(`Error broadcasting user status: ${error.message}`);
  }
}

// Notify conversation participants about presence changes
async function notifyConversationParticipants(io, conversationId, userId, action) {
  try {
    // Get conversation
    const conversation = await Conversation.getById(conversationId);
    if (!conversation) {
      return;
    }
    
    // Current active users in the conversation
    const activeUsers = activeConversations.has(conversationId)
      ? Array.from(activeConversations.get(conversationId))
      : [];
    
    // Notify all participants except the user who triggered the action
    conversation.participants.forEach(participant => {
      if (participant.id !== userId) {
        const participantSocketId = userSockets.get(participant.id);
        if (participantSocketId) {
          io.to(participantSocketId).emit('conversation_presence', {
            conversationId,
            userId,
            action,
            activeUsers
          });
        }
      }
    });
  } catch (error) {
    logger.error(`Error notifying conversation participants: ${error.message}`);
  }
}

module.exports = { initializeSocketServer };
