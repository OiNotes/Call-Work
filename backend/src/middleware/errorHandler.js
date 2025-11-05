import logger from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 * SECURITY FIX (P0-SEC-6): Sanitize errors in production
 */
export const errorHandler = (err, req, res, _next) => {
  // Log error (always log full details internally)
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Determine error status
  const statusCode = err.statusCode || err.status || 500;

  // SECURITY: In production, sanitize error messages
  if (config.nodeEnv === 'production') {
    // For 5xx errors, send generic message (no internal details)
    if (statusCode >= 500) {
      return res.status(statusCode).json({
        success: false,
        error: 'An error occurred. Please try again later.'
      });
    }
    
    // For 4xx errors, only send message if it's an operational error
    const errorResponse = {
      success: false,
      error: err.isOperational ? err.message : 'Request failed'
    };
    
    // Only include details for operational errors
    if (err.details && err.isOperational) {
      errorResponse.details = err.details;
    }
    
    return res.status(statusCode).json(errorResponse);
  }

  // Development: send full error details
  const errorResponse = {
    success: false,
    error: err.message || 'Internal server error',
    stack: err.stack,
    details: err.details || null
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res) => {
  logger.warn('404 Not Found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
};

/**
 * Async error wrapper
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
export const validationErrorHandler = (errors) => {
  const details = errors.array().map(err => ({
    field: err.path || err.param,
    message: err.msg,
    value: err.value
  }));

  return new ApiError(400, 'Validation failed', details);
};

/**
 * Database error handler
 */
export const dbErrorHandler = (err) => {
  logger.error('Database error', {
    error: err.message,
    code: err.code,
    detail: err.detail
  });

  // PostgreSQL error codes
  if (err.code === '23505') {
    return new ApiError(409, 'Resource already exists', {
      constraint: err.constraint
    });
  }

  if (err.code === '23503') {
    return new ApiError(400, 'Foreign key constraint violation', {
      constraint: err.constraint
    });
  }

  if (err.code === '23502') {
    return new ApiError(400, 'Required field is missing', {
      column: err.column
    });
  }

  return new ApiError(500, 'Database error');
};

/**
 * JWT error handler
 */
export const jwtErrorHandler = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return new ApiError(401, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return new ApiError(401, 'Token expired');
  }

  return new ApiError(401, 'Authentication failed');
};

export default {
  ApiError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
  dbErrorHandler,
  jwtErrorHandler
};
