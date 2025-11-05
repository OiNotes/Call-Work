/**
 * Request ID Middleware (API-2)
 * Adds unique X-Request-ID to all responses for tracing and debugging
 */

import { randomUUID } from 'crypto';

/**
 * Generate and attach request ID to each request
 * Helps with log correlation and debugging across distributed systems
 */
export const requestIdMiddleware = (req, res, next) => {
  // Use client-provided request ID if present, otherwise generate new one
  const requestId = req.headers['x-request-id'] || randomUUID();

  // Attach to request object for use in controllers/logger
  req.requestId = requestId;

  // Add to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
};

export default requestIdMiddleware;
