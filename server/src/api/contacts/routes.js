const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { ApiError } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');
const Contact = require('../../models/Contact');
const User = require('../../models/User');

// Apply authentication middleware to all contact routes
router.use(auth);

/**
 * Get user contacts
 * GET /api/contacts
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get contacts from database
    const contacts = await Contact.getContactsByUserId(userId);
    
    // Format last seen for each contact
    const formattedContacts = contacts.map(contact => ({
      ...contact,
      lastSeen: contact.last_seen
    }));
    
    res.status(200).json(formattedContacts);
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    next(ApiError.internal('Failed to fetch contacts'));
  }
});

/**
 * Add a contact by contactId, username, or email
 * POST /api/contacts
 */
router.post('/', async (req, res, next) => {
  try {
    // Log the entire request for debugging
    console.log('=== CONTACT ROUTE DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('User from token:', JSON.stringify(req.user, null, 2));
    console.log('=== END DEBUG ===');
    
    logger.debug(`Add contact request received: ${JSON.stringify(req.body, null, 2)}`);
    logger.debug(`User from auth token: ${JSON.stringify(req.user, null, 2)}`);
    
    // Get user ID from token (could be in either id or userId field)
    const userId = req.user.id || req.user.userId;
    logger.debug(`Using userId: ${userId}`);
    
    if (!userId) {
      logger.error('No user ID found in token');
      return next(ApiError.unauthorized('Invalid authentication token'));
    }
    
    // Extract parameters from request body
    // Support both camelCase and snake_case for contactId
    const contactId = req.body.contactId || req.body.contact_id;
    const { username, email } = req.body;
    
    logger.debug(`Extracted parameters: contactId=${contactId}, username=${username}, email=${email}`);
    
    // Check if we have at least one of the required parameters
    if (!contactId && !username && !email) {
      logger.debug('No contactId, username, or email provided');
      return next(ApiError.badRequest('Contact ID, username, or email is required'));
    }
    
    // Check if we have a contactId
    if (contactId) {
      logger.debug(`Adding contact by ID: ${contactId}`);
      
      try {
        // Add contact by ID
        const contact = await Contact.addContact(userId, contactId);
        
        logger.debug(`Contact added successfully: ${JSON.stringify(contact, null, 2)}`);
        return res.status(201).json(contact);
      } catch (error) {
        logger.error(`Error adding contact by ID: ${error.message}`);
        
        if (error.message === 'Contact already exists') {
          return next(ApiError.conflict('Contact already exists'));
        } else if (error.message === 'User not found') {
          return next(ApiError.notFound('User not found'));
        } else if (error.message === 'Cannot add yourself as a contact') {
          return next(ApiError.badRequest('Cannot add yourself as a contact'));
        }
        
        throw error;
      }
    } 
    // Check if we have a username or email
    else if (username || email) {
      logger.debug(`Adding contact by ${username ? 'username' : 'email'}: ${username || email}`);
      
      // Find user by username or email
      let user;
      try {
        if (username) {
          user = await User.getByUsername(username);
        } else {
          user = await User.getByEmail(email);
        }
        
        if (!user) {
          logger.debug(`User not found with ${username ? 'username' : 'email'}: ${username || email}`);
          return next(ApiError.notFound('User not found'));
        }
        
        logger.debug(`Found user: ${JSON.stringify(user, null, 2)}`);
        
        // Add contact
        const contact = await Contact.addContact(userId, user.id);
        
        logger.debug(`Contact added successfully: ${JSON.stringify(contact, null, 2)}`);
        return res.status(201).json(contact);
      } catch (error) {
        logger.error(`Error adding contact by ${username ? 'username' : 'email'}: ${error.message}`);
        
        if (error.message === 'Contact already exists') {
          return next(ApiError.conflict('Contact already exists'));
        } else if (error.message === 'Cannot add yourself as a contact') {
          return next(ApiError.badRequest('Cannot add yourself as a contact'));
        }
        
        throw error;
      }
    }
  } catch (error) {
    logger.error('Error adding contact:', error);
    next(ApiError.internal('Failed to add contact'));
  }
});

/**
 * Add a contact by ID
 * POST /api/contacts/byid
 */
router.post('/byid', async (req, res, next) => {
  try {
    // Log the entire request for debugging
    console.log('=== CONTACT BY ID ROUTE DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('User from token:', JSON.stringify(req.user, null, 2));
    console.log('=== END DEBUG ===');
    
    // Get user ID from token (could be in either id or userId field)
    const userId = req.user.id || req.user.userId;
    logger.debug(`Using userId: ${userId}`);
    
    if (!userId) {
      logger.error('No user ID found in token');
      return next(ApiError.unauthorized('Invalid authentication token'));
    }
    
    const { contactId } = req.body;
    
    if (!contactId) {
      logger.debug('No contactId provided');
      return next(ApiError.badRequest('Contact ID is required'));
    }
    
    logger.debug(`Adding contact by ID: ${contactId}`);
    
    try {
      // Add contact by ID
      const contact = await Contact.addContact(userId, contactId);
      
      logger.debug(`Contact added successfully: ${JSON.stringify(contact, null, 2)}`);
      return res.status(201).json(contact);
    } catch (error) {
      logger.error(`Error adding contact by ID: ${error.message}`);
      
      if (error.message === 'Contact already exists') {
        return next(ApiError.conflict('Contact already exists'));
      } else if (error.message === 'User not found') {
        return next(ApiError.notFound('User not found'));
      } else if (error.message === 'Cannot add yourself as a contact') {
        return next(ApiError.badRequest('Cannot add yourself as a contact'));
      }
      
      throw error;
    }
  } catch (error) {
    logger.error('Error adding contact by ID:', error);
    next(ApiError.internal('Failed to add contact by ID'));
  }
});

/**
 * Search for users by username
 * GET /api/contacts/search
 */
router.get('/search', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = req.query.query;
    
    if (!query) {
      return next(ApiError.badRequest('Search query is required'));
    }
    
    // Search users in database
    const users = await User.search(query, 10);
    
    // Filter out the current user
    const filteredUsers = users.filter(user => user.id !== userId);
    
    // Format the results
    const results = filteredUsers.map(user => ({
      id: user.id,
      username: user.username,
      name: user.full_name,
      avatar: user.avatar_url
    }));
    
    res.status(200).json(results);
  } catch (error) {
    logger.error('Error searching users:', error);
    next(ApiError.internal('Failed to search users'));
  }
});

/**
 * Get contact by ID
 * GET /api/contacts/:contactId
 */
router.get('/:contactId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.contactId;
    
    // Get contact from database
    const contact = await Contact.getContactById(userId, contactId);
    
    if (!contact) {
      return next(ApiError.notFound('Contact not found'));
    }
    
    res.status(200).json({
      ...contact,
      lastSeen: contact.last_seen
    });
  } catch (error) {
    logger.error('Error fetching contact:', error);
    next(ApiError.internal('Failed to fetch contact'));
  }
});

/**
 * Remove a contact
 * DELETE /api/contacts/:contactId
 */
router.delete('/:contactId', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contactId = req.params.contactId;
    
    // Check if contact exists
    const contact = await Contact.getContactById(userId, contactId);
    
    if (!contact) {
      return next(ApiError.notFound('Contact not found'));
    }
    
    // Remove contact
    const success = await Contact.removeContact(userId, contactId);
    
    if (!success) {
      return next(ApiError.internal('Failed to remove contact'));
    }
    
    res.status(200).json({ message: 'Contact removed successfully' });
  } catch (error) {
    logger.error('Error removing contact:', error);
    next(ApiError.internal('Failed to remove contact'));
  }
});

/**
 * Generate a shareable link for adding as contact
 * POST /api/contacts/share
 */
router.post('/share', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Generate a random token for the shareable link
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // In a real implementation, this would store the token in a database with an expiration
    
    // Generate the shareable link
    const shareableLink = `${req.protocol}://${req.get('host')}/add-contact?token=${token}`;
    
    res.status(200).json({ shareableLink });
  } catch (error) {
    logger.error('Error generating shareable link:', error);
    next(ApiError.internal('Failed to generate shareable link'));
  }
});

/**
 * Add contact via QR code
 * POST /api/contacts/qr
 */
router.post('/qr', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { qrData } = req.body;
    
    if (!qrData) {
      return next(ApiError.badRequest('QR data is required'));
    }
    
    // In a real implementation, this would:
    // 1. Validate the QR data
    // 2. Extract the user information
    // 3. Add the contact to the user's contacts list
    
    const newContact = {
      id: `qr_${Date.now()}`,
      username: 'qruser',
      name: 'QR User',
      avatar: '',
      status: 'offline',
      lastSeen: new Date()
    };
    
    res.status(201).json(newContact);
  } catch (error) {
    logger.error('Error adding contact by QR:', error);
    next(ApiError.internal('Failed to add contact by QR code'));
  }
});

/**
 * Add contact via shareable link
 * POST /api/contacts/link
 */
router.post('/link', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { linkToken } = req.body;
    
    if (!linkToken) {
      return next(ApiError.badRequest('Link token is required'));
    }
    
    // In a real implementation, this would:
    // 1. Validate the token
    // 2. Find the associated user
    // 3. Add the contact to the user's contacts list
    
    const newContact = {
      id: `link_${Date.now()}`,
      username: 'linkuser',
      name: 'Link User',
      avatar: '',
      status: 'offline',
      lastSeen: new Date()
    };
    
    res.status(201).json(newContact);
  } catch (error) {
    logger.error('Error adding contact by link:', error);
    next(ApiError.internal('Failed to add contact by link'));
  }
});

module.exports = router;
