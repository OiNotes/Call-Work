import { dbErrorHandler } from '../middleware/errorHandler.js';
import logger from './logger.js';

/**
 * Unified controller error handler
 * Reduces boilerplate in controller catch blocks
 *
 * Usage:
 *   catch (error) {
 *     return handleControllerError(error, res, 'Create order');
 *   }
 *
 * @param {Error} error - The caught error
 * @param {Object} res - Express response object
 * @param {string} operation - Operation name for logging (e.g., "Create order")
 * @param {Object} context - Additional context for logging
 * @returns {Object} Express response
 */
export function handleControllerError(error, res, operation, context = {}) {
  // Handle database errors with proper status codes
  if (error.code) {
    const handledError = dbErrorHandler(error);
    logger.error(`${operation} - DB error`, {
      error: error.message,
      code: error.code,
      ...context
    });
    return res.status(handledError.statusCode).json({
      success: false,
      error: handledError.message,
      ...(handledError.details ? { details: handledError.details } : {})
    });
  }

  // Handle custom API errors (with statusCode)
  if (error.statusCode) {
    logger.error(`${operation} - API error`, {
      error: error.message,
      statusCode: error.statusCode,
      ...context
    });
    return res.status(error.statusCode).json({
      success: false,
      error: error.message
    });
  }

  // Handle generic errors
  logger.error(`${operation} - Unexpected error`, {
    error: error.message,
    stack: error.stack,
    ...context
  });
  return res.status(500).json({
    success: false,
    error: `Failed to ${operation.toLowerCase()}`
  });
}

/**
 * Execute async operation with automatic error handling
 * Wraps controller logic to eliminate try-catch boilerplate
 *
 * Usage:
 *   export const createShop = withErrorHandling('Create shop', async (req, res) => {
 *     const shop = await shopQueries.create(...);
 *     return res.status(201).json({ success: true, data: shop });
 *   });
 *
 * @param {string} operation - Operation name for logging
 * @returns {Function} Express middleware function
 */
export function withErrorHandling(operation) {
  return (handler) => {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        return handleControllerError(error, res, operation, {
          userId: req.user?.id,
          path: req.path,
          method: req.method
        });
      }
    };
  };
}

/**
 * Standardized success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {number} statusCode - HTTP status code (default 200)
 * @param {string} message - Optional success message
 * @returns {Object} Express response
 */
export function sendSuccess(res, data, statusCode = 200, message = null) {
  const response = {
    success: true,
    ...(message && { message }),
    data
  };
  return res.status(statusCode).json(response);
}

/**
 * Check resource ownership
 * Common pattern: verify user owns a resource before allowing operations
 *
 * @param {Object} resource - Resource object (must have owner_id field)
 * @param {number} userId - Current user ID
 * @param {Object} res - Express response object
 * @param {string} resourceName - Resource name for error message
 * @returns {boolean} True if check passes, false if response sent
 */
export function checkOwnership(resource, userId, res, resourceName = 'resource') {
  if (!resource) {
    res.status(404).json({
      success: false,
      error: `${resourceName} not found`
    });
    return false;
  }

  if (resource.owner_id !== userId) {
    res.status(403).json({
      success: false,
      error: `You can only access your own ${resourceName.toLowerCase()}s`
    });
    return false;
  }

  return true;
}

/**
 * Parse pagination parameters with defaults
 * @param {Object} query - Express req.query
 * @param {Object} options - Default options
 * @returns {Object} { page, limit, offset }
 */
export function parsePagination(query, options = {}) {
  const defaultLimit = options.defaultLimit || 50;
  const maxLimit = options.maxLimit || 100;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(query.limit, 10) || defaultLimit)
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export default {
  handleControllerError,
  withErrorHandling,
  sendSuccess,
  checkOwnership,
  parsePagination
};
