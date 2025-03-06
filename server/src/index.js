require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { setupWebSocketServer } = require('./websocket/socket');
const { setupRoutes } = require('./api/routes');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { initRedis } = require('./config/redis');
const { initDatabase } = require('./config/database');
const { initTestData } = require('./scripts/initTestData');
const fs = require('fs');
const path = require('path');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Set up middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies

// Set up routes
setupRoutes(app);

// Error handling middleware
app.use(errorHandler);

/**
 * Setup media directories
 */
const setupMediaDirectories = () => {
  try {
    // Get upload directory from environment or use default
    const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
    
    // Media types to create directories for
    const MEDIA_TYPES = ['image', 'video', 'audio', 'document'];
    
    // Create main upload directory
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      logger.info(`Created directory: ${UPLOAD_DIR}`);
    }
    
    // Create temp directory for uploads in progress
    const tempDir = path.join(UPLOAD_DIR, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      logger.info(`Created directory: ${tempDir}`);
    }
    
    // Create directories for each media type
    for (const mediaType of MEDIA_TYPES) {
      const mediaTypeDir = path.join(UPLOAD_DIR, mediaType);
      if (!fs.existsSync(mediaTypeDir)) {
        fs.mkdirSync(mediaTypeDir, { recursive: true });
        logger.info(`Created directory: ${mediaTypeDir}`);
      }
    }
    
    logger.info('Media directories setup complete');
  } catch (error) {
    logger.error('Error setting up media directories:', error);
    throw error;
  }
};

// Initialize the server
const startServer = async () => {
  try {
    // Initialize Redis
    await initRedis();
    
    // Initialize Database
    await initDatabase();
    
    // Setup media directories
    setupMediaDirectories();
    
    // Initialize test data if in development mode
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      await initTestData();
    }
    
    // Set up WebSocket server
    setupWebSocketServer(server);
    
    // Start the server
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info('Swickr backend initialized successfully');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error('Detailed error:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  console.error('Detailed uncaught exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
  console.error('Detailed unhandled rejection:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = { app, server };
