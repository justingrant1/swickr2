const express = require('express');
const { ApiError } = require('../middleware/errorHandler');
const authRoutes = require('./auth/routes');
const userRoutes = require('./users/routes');
const messageRoutes = require('./messages/routes');
const contactRoutes = require('./contacts/routes');
const mediaRoutes = require('./media/routes');
const conversationRoutes = require('./conversations/routes');
const reactionRoutes = require('./reactions/routes');
const statusRoutes = require('../routes/statusRoutes');
const notificationRoutes = require('../routes/notificationRoutes');

/**
 * Set up all API routes
 * @param {Object} app - Express application
 */
const setupRoutes = (app) => {
  // API router
  const apiRouter = express.Router();
  
  // Health check endpoint
  apiRouter.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });
  
  // Mount feature routes
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/users', userRoutes);
  apiRouter.use('/messages', messageRoutes);
  apiRouter.use('/contacts', contactRoutes);
  apiRouter.use('/media', mediaRoutes);
  apiRouter.use('/conversations', conversationRoutes);
  apiRouter.use('/reactions', reactionRoutes);
  apiRouter.use('/status', statusRoutes);
  apiRouter.use('/notifications', notificationRoutes);
  
  // Mount API router to /api
  app.use('/api', apiRouter);
  
  // Handle 404 for API routes
  app.use('/api/*', (req, res, next) => {
    next(ApiError.notFound(`Route ${req.originalUrl} not found`));
  });
  
  // Root route
  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'Swickr API',
      description: 'High-performance messaging service API',
      documentation: '/api/docs'
    });
  });
};

module.exports = { setupRoutes };
