import express from 'express';
import logger from '../utils/logger.js';
import { config } from '../config/env.js';

const router = express.Router();

// Internal secret for protecting broadcast endpoint
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

if (!INTERNAL_SECRET) {
  throw new Error('INTERNAL_SECRET environment variable is required');
}

/**
 * Middleware to verify internal requests
 */
function verifyInternalSecret(req, res, next) {
  const secret = req.headers['x-internal-secret'];

  if (secret !== INTERNAL_SECRET) {
    logger.warn('Unauthorized internal API access attempt', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  next();
}

/**
 * POST /api/internal/broadcast
 * Broadcast message to all connected WebSocket clients
 *
 * Body: { type: string, ...data }
 * Headers: { x-internal-secret: string }
 *
 * Example:
 * {
 *   "type": "product_added",
 *   "shopId": 123,
 *   "productId": 456
 * }
 */
router.post('/broadcast', verifyInternalSecret, (req, res) => {
  try {
    const { type, ...data } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Missing type parameter'
      });
    }

    // Use global broadcast function from server.js
    if (typeof global.broadcastUpdate === 'function') {
      global.broadcastUpdate({ type, ...data });

      logger.info('Broadcast sent', { type, data });

      res.json({
        success: true,
        message: 'Broadcast sent',
        type
      });
    } else {
      logger.error('broadcastUpdate function not available');
      res.status(500).json({
        success: false,
        error: 'WebSocket server not initialized'
      });
    }

  } catch (error) {
    logger.error('Broadcast error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/internal/health
 * Internal health check with detailed info
 */
router.get('/health', verifyInternalSecret, (req, res) => {
  res.json({
    success: true,
    data: {
      environment: config.nodeEnv,
      websocket: typeof global.broadcastUpdate === 'function',
      bot: !!global.botInstance,
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
