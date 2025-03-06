// Serverless API handler for Vercel deployment
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Create Express app
const app = express();

// Apply middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());

// Define API routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Swickr API is running' });
});

// For local development, you can uncomment this to proxy to your local server
// app.use('/api', createProxyMiddleware({ 
//   target: process.env.API_URL || 'http://localhost:5000',
//   changeOrigin: true,
//   pathRewrite: {'^/api': ''},
// }));

// Export the Express API
module.exports = app;
