const express = require('express');
const authController = require('./controller');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', authController.register);

/**
 * @route POST /api/auth/login
 * @desc Authenticate user & get token
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh-token', authController.refreshToken);

/**
 * @route POST /api/auth/logout
 * @desc Logout user & invalidate token
 * @access Private
 */
router.post('/logout', authController.logout);

module.exports = router;
