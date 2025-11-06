import logger from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * User agents exempt from CSRF protection
 * These are trusted server-to-server requests from our bot
 */
const CSRF_EXEMPT_USER_AGENTS = [
  'TelegramBot',
  'axios/1.13',  // Bot client
  'node-fetch'
];

/**
 * CSRF Protection Middleware
 *
 * Security: P0-SEC-5
 * Prevents Cross-Site Request Forgery attacks by validating Origin/Referer headers
 *
 * How it works:
 * - GET, HEAD, OPTIONS requests are allowed (safe methods)
 * - POST, PUT, DELETE, PATCH require valid Origin or Referer header
 * - Bot requests (identified by User-Agent) are exempted
 * - Webhook endpoints are exempted (they don't send Origin headers)
 * - Origin must match one of the allowed origins (FRONTEND_URL, localhost)
 *
 * Attack prevented:
 * ```html
 * <!-- Evil site cannot do this: -->
 * <form action="https://status-stock.com/api/shops" method="POST">
 *   <input name="name" value="Hacked Shop">
 * </form>
 * ```
 */

/**
 * Validate Origin or Referer header to prevent CSRF attacks
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
export const validateOrigin = (req, res, next) => {
  // Skip for safe HTTP methods (read-only)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for webhook endpoints (external services don't send Origin)
  if (req.path.startsWith('/webhooks/')) {
    return next();
  }

  // Skip for health check
  if (req.path === '/health') {
    return next();
  }

  // Skip CSRF validation in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Skip CSRF for bot requests (trusted server-to-server calls)
  const userAgent = req.headers['user-agent'] || '';
  if (CSRF_EXEMPT_USER_AGENTS.some(ua => userAgent.includes(ua))) {
    logger.debug('CSRF check bypassed for bot user-agent:', {
      userAgent,
      path: req.path,
      method: req.method
    });
    return next();
  }

  const origin = req.get('origin');
  const referer = req.get('referer');

  // Build allowed origins list
  const allowedOrigins = [
    config.frontendUrl,
    'http://localhost:5173',
    'http://localhost:3000',
    'https://localhost:3000',
  ].filter(Boolean);

  // Add ngrok URLs if present in environment
  if (process.env.NGROK_URL) {
    allowedOrigins.push(process.env.NGROK_URL);
  }

  // Check if origin matches any allowed origin
  const isValidOrigin = origin && allowedOrigins.some(allowed => {
    // Exact match or starts with (to handle subdomains)
    return origin === allowed || origin.startsWith(allowed);
  });

  // Check if referer matches any allowed origin
  const isValidReferer = referer && allowedOrigins.some(allowed => {
    return referer.startsWith(allowed);
  });

  // At least one of Origin or Referer must be valid
  if (!isValidOrigin && !isValidReferer) {
    logger.warn('CSRF protection: Invalid origin/referer', {
      method: req.method,
      path: req.path,
      origin: origin || 'none',
      referer: referer || 'none',
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(403).json({
      success: false,
      error: 'Invalid origin - possible CSRF attack detected'
    });
  }

  // Origin is valid, proceed
  next();
};

/**
 * Export middleware
 */
export default {
  validateOrigin
};
