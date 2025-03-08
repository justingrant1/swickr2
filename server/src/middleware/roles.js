/**
 * Role-based access control middleware
 */
const { ApiError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Middleware to check if user has admin role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      logger.warn('isAdmin middleware called without authenticated user');
      return next(ApiError.unauthorized('Authentication required'));
    }
    
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      logger.warn(`User ${req.user.id} attempted to access admin-only resource`);
      return next(ApiError.forbidden('Admin access required'));
    }
    
    logger.debug(`Admin access granted to user ${req.user.id}`);
    next();
  } catch (error) {
    logger.error('Error in isAdmin middleware:', error);
    next(ApiError.internal('Server error'));
  }
};

/**
 * Middleware to check if user has moderator role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isModerator = (req, res, next) => {
  try {
    if (!req.user) {
      logger.warn('isModerator middleware called without authenticated user');
      return next(ApiError.unauthorized('Authentication required'));
    }
    
    if (!req.user.roles || (!req.user.roles.includes('moderator') && !req.user.roles.includes('admin'))) {
      logger.warn(`User ${req.user.id} attempted to access moderator-only resource`);
      return next(ApiError.forbidden('Moderator access required'));
    }
    
    logger.debug(`Moderator access granted to user ${req.user.id}`);
    next();
  } catch (error) {
    logger.error('Error in isModerator middleware:', error);
    next(ApiError.internal('Server error'));
  }
};

/**
 * Middleware to check if user has a specific role
 * @param {string} role - Role to check for
 * @returns {Function} Middleware function
 */
const hasRole = (role) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        logger.warn(`hasRole(${role}) middleware called without authenticated user`);
        return next(ApiError.unauthorized('Authentication required'));
      }
      
      if (!req.user.roles || !req.user.roles.includes(role)) {
        logger.warn(`User ${req.user.id} attempted to access resource requiring role: ${role}`);
        return next(ApiError.forbidden(`Role '${role}' required`));
      }
      
      logger.debug(`Role '${role}' access granted to user ${req.user.id}`);
      next();
    } catch (error) {
      logger.error(`Error in hasRole(${role}) middleware:`, error);
      next(ApiError.internal('Server error'));
    }
  };
};

/**
 * Middleware to check if user has any of the specified roles
 * @param {Array<string>} roles - Roles to check for
 * @returns {Function} Middleware function
 */
const hasAnyRole = (roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        logger.warn(`hasAnyRole(${roles.join(',')}) middleware called without authenticated user`);
        return next(ApiError.unauthorized('Authentication required'));
      }
      
      if (!req.user.roles || !roles.some(role => req.user.roles.includes(role))) {
        logger.warn(`User ${req.user.id} attempted to access resource requiring any role of: ${roles.join(', ')}`);
        return next(ApiError.forbidden(`One of roles [${roles.join(', ')}] required`));
      }
      
      logger.debug(`Role access granted to user ${req.user.id} (has one of: ${roles.join(', ')})`);
      next();
    } catch (error) {
      logger.error(`Error in hasAnyRole(${roles.join(',')}) middleware:`, error);
      next(ApiError.internal('Server error'));
    }
  };
};

module.exports = {
  isAdmin,
  isModerator,
  hasRole,
  hasAnyRole
};
