/**
 * Response Utilities
 * 
 * Standardized response formatting for the Swickr API
 */

/**
 * Create a standardized error response
 * 
 * @param {string} message - Error message
 * @param {Error|null} error - Error object (optional)
 * @returns {Object} Formatted error response
 */
exports.createErrorResponse = (message, error = null) => {
  const response = {
    success: false,
    message
  };

  // Include error details in development environment
  if (error && process.env.NODE_ENV !== 'production') {
    response.error = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return response;
};

/**
 * Create a standardized success response
 * 
 * @param {string} message - Success message
 * @param {Object} data - Response data (optional)
 * @returns {Object} Formatted success response
 */
exports.createSuccessResponse = (message, data = null) => {
  const response = {
    success: true,
    message
  };

  if (data) {
    response.data = data;
  }

  return response;
};

module.exports = exports;
