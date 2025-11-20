import { ApiError } from '../middleware/errorHandler.js';

/**
 * Standard Error Classes for API
 * 
 * These classes extend ApiError and provide semantic error types
 * to replace manual res.status().json({ success: false }) patterns.
 * 
 * Usage:
 * - throw new NotFoundError('Product') → 404
 * - throw new UnauthorizedError() → 403
 * - throw new ValidationError('Invalid input', details) → 400
 * - throw new ConflictError('Already exists') → 409
 */

/**
 * 404 Not Found Error
 * Use when a requested resource doesn't exist
 */
export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * 403 Forbidden / Unauthorized Error
 * Use when user lacks permission to access a resource
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Access denied') {
    super(403, message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 400 Bad Request / Validation Error
 * Use for invalid input or validation failures
 */
export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details = null) {
    super(400, message, details);
    this.name = 'ValidationError';
  }
}

/**
 * 409 Conflict Error
 * Use for resource conflicts (e.g., duplicate entries)
 */
export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict') {
    super(409, message);
    this.name = 'ConflictError';
  }
}

/**
 * 401 Unauthenticated Error
 * Use when authentication is required but missing/invalid
 */
export class UnauthenticatedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message);
    this.name = 'UnauthenticatedError';
  }
}

/**
 * 402 Payment Required Error
 * Use when payment or subscription is needed
 */
export class PaymentRequiredError extends ApiError {
  constructor(message = 'Payment required') {
    super(402, message);
    this.name = 'PaymentRequiredError';
  }
}

export default {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  UnauthenticatedError,
  PaymentRequiredError,
};
