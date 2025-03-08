// Serverless API handler for Vercel deployment
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { setupRoutes } = require('../server/src/api/routes');
const { errorHandler } = require('../server/src/middleware/errorHandler');

// Set environment variable for Vercel
process.env.VERCEL = 'true';

// Create Express app
const app = express();

// Apply middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Define basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Swickr API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Set up all API routes
setupRoutes(app);

// Error handling middleware
app.use(errorHandler);

// Export the Express API
module.exports = app;
