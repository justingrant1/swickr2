const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateJWT = (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    logger.debug(`Auth middleware called for path: ${req.path}`);
    logger.debug(`Authorization header present: ${Boolean(authHeader)}`);
    
    if (!authHeader) {
      logger.debug('No authorization header provided');
      return next(ApiError.unauthorized('No authorization token provided'));
    }
    
    // Extract token from header
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      logger.debug('Invalid authorization format, no token part found');
      return next(ApiError.unauthorized('Invalid authorization format'));
    }
    
    logger.debug(`Token format check: ${token.substring(0, 10)}...`);
    
    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        logger.debug(`JWT verification error: ${err.name} - ${err.message}`);
        
        if (err.name === 'TokenExpiredError') {
          return next(ApiError.unauthorized('Token expired'));
        }
        return next(ApiError.unauthorized('Invalid token'));
      }
      
      logger.debug('JWT decoded payload:', JSON.stringify(decoded, null, 2));
      
      // Attach user info to request
      req.user = {
        id: decoded.userId, // Keep id for backward compatibility
        userId: decoded.userId, // Add userId for consistency
        username: decoded.username,
        email: decoded.email
      };
      
      logger.debug(`User authenticated: ${req.user.username} (${req.user.id})`);
      next();
    });
  } catch (error) {
    logger.error('Authentication error:', error);
    next(ApiError.unauthorized('Authentication failed'));
  }
};

/**
 * Middleware to check if user has admin role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.roles || !req.user.roles.includes('admin')) {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};

module.exports = authenticateJWT;
