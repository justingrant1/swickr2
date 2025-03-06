const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.getById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    // Remove sensitive information
    delete user.password;
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.getById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }
    
    // Remove sensitive information
    delete user.password;
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/users/update-profile
 * @desc    Update user profile
 * @access  Private
 */
router.post('/update-profile', auth, async (req, res) => {
  try {
    const { displayName, bio, avatarUrl } = req.body;
    
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    
    const updatedUser = await User.update(req.user.id, updates);
    
    // Remove sensitive information
    delete updatedUser.password;
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/users/update-public-key
 * @desc    Update user's public encryption key
 * @access  Private
 */
router.post('/update-public-key', auth, async (req, res) => {
  try {
    const { publicKey } = req.body;
    
    if (!publicKey) {
      return res.status(400).json({ error: { message: 'Public key is required' } });
    }
    
    // Validate that the public key is in the correct format (JWK)
    try {
      const parsedKey = JSON.parse(publicKey);
      if (!parsedKey.kty || !parsedKey.n || !parsedKey.e) {
        return res.status(400).json({ error: { message: 'Invalid public key format' } });
      }
    } catch (e) {
      return res.status(400).json({ error: { message: 'Invalid public key format' } });
    }
    
    // Update the user's public key
    const updates = { publicKey };
    const updatedUser = await User.update(req.user.id, updates);
    
    // Remove sensitive information
    delete updatedUser.password;
    
    res.json({ 
      success: true, 
      message: 'Public key updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating public key:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/users/search
 * @desc    Search for users by username or display name
 * @access  Private
 */
router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: { message: 'Search query is required' } });
    }
    
    const users = await User.search(query);
    
    // Remove sensitive information
    users.forEach(user => {
      delete user.password;
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

module.exports = router;
