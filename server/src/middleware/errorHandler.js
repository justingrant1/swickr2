const logger = require('../utils/logger');

/**
 * Global error handling middleware
 * Provides consistent error responses across the application
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`${err.name}: ${err.message}`, { 
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Create error response
  const errorResponse = {
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR'
    }
  };

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
};

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'BAD_REQUEST') {
    return new ApiError(message, 400, code);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(message, 401, code);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(message, 403, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(message, 404, code);
  }

  static conflict(message, code = 'CONFLICT') {
    return new ApiError(message, 409, code);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new ApiError(message, 500, code);
  }
}

module.exports = { errorHandler, ApiError };
