const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { io } = require('../socket');

/**
 * @route   GET /api/status
 * @desc    Get current user's status details
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const statusDetails = await User.getStatusDetails(req.user.id);
    res.json(statusDetails);
  } catch (error) {
    console.error('Error getting status details:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/status/:userId
 * @desc    Get a user's status details
 * @access  Private
 */
router.get('/:userId', auth, async (req, res) => {
  try {
    const statusDetails = await User.getStatusDetails(req.params.userId);
    res.json(statusDetails);
  } catch (error) {
    console.error('Error getting status details:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   PUT /api/status
 * @desc    Update user's status
 * @access  Private
 */
router.put('/', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: { message: 'Status is required' } });
    }
    
    await User.updateStatus(req.user.id, status);
    
    // Emit socket event for real-time updates
    io.emit('user_status_changed', {
      userId: req.user.id,
      status
    });
    
    res.json({ success: true, message: 'Status updated', status });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   POST /api/status/custom
 * @desc    Set a custom status message
 * @access  Private
 */
router.post('/custom', auth, async (req, res) => {
  try {
    const { statusMessage, emoji } = req.body;
    
    if (!statusMessage) {
      return res.status(400).json({ error: { message: 'Status message is required' } });
    }
    
    const updatedStatus = await User.setCustomStatus(req.user.id, statusMessage, emoji);
    
    // Emit socket event for real-time updates
    io.emit('user_status_changed', {
      userId: req.user.id,
      status: 'custom',
      statusMessage,
      emoji
    });
    
    res.json(updatedStatus);
  } catch (error) {
    console.error('Error setting custom status:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   DELETE /api/status/custom
 * @desc    Clear custom status message
 * @access  Private
 */
router.delete('/custom', auth, async (req, res) => {
  try {
    const { newStatus = 'online' } = req.body;
    
    const updatedStatus = await User.clearCustomStatus(req.user.id, newStatus);
    
    // Emit socket event for real-time updates
    io.emit('user_status_changed', {
      userId: req.user.id,
      status: newStatus
    });
    
    res.json(updatedStatus);
  } catch (error) {
    console.error('Error clearing custom status:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

/**
 * @route   GET /api/status/history
 * @desc    Get user's status history
 * @access  Private
 */
router.get('/history', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const history = await User.getStatusHistory(req.user.id, parseInt(limit));
    res.json(history);
  } catch (error) {
    console.error('Error getting status history:', error);
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

module.exports = router;
