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
      path: req.path,
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
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
        error: 'Missing type parameter',
      });
    }

    // Use global broadcast function from server.js
    if (typeof global.broadcastUpdate === 'function') {
      global.broadcastUpdate({ type, ...data });

      logger.info('Broadcast sent', { type, data });

      res.json({
        success: true,
        message: 'Broadcast sent',
        type,
      });
    } else {
      logger.error('broadcastUpdate function not available');
      res.status(500).json({
        success: false,
        error: 'WebSocket server not initialized',
      });
    }
  } catch (error) {
    logger.error('Broadcast error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
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
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/internal/admin/recover-subscription/:subscriptionId
 * Manually create shop for paid subscription (admin recovery tool)
 *
 * Use case: When payment confirmed but shop creation failed (JWT expired, etc.)
 * Headers: { x-internal-secret: string }
 *
 * Example: curl -X POST http://localhost:3000/api/internal/admin/recover-subscription/14 \
 *   -H "x-internal-secret: YOUR_SECRET"
 */
router.post('/admin/recover-subscription/:subscriptionId', verifyInternalSecret, async (req, res) => {
  const { subscriptionId } = req.params;
  const { query, getClient } = await import('../config/database.js');

  try {
    logger.info('[Admin] Recovery attempt for subscription', { subscriptionId });

    // Get paid subscription without shop
    const subscription = await query(
      `SELECT ss.*, u.telegram_id, u.username
       FROM shop_subscriptions ss
       JOIN users u ON ss.user_id = u.id
       WHERE ss.id = $1 AND ss.status IN ('paid', 'active') AND ss.shop_id IS NULL`,
      [subscriptionId]
    );

    if (subscription.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found, already linked to shop, or not paid',
        hint: 'Only paid/active subscriptions without shop can be recovered',
      });
    }

    const sub = subscription.rows[0];

    // Create shop with auto-generated name
    const shopName = `Shop_${sub.username || sub.telegram_id}_${Date.now()}`;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Create shop
      const shopResult = await client.query(
        `INSERT INTO shops (name, owner_id, tier, subscription_status, registration_paid, is_active)
         VALUES ($1, $2, $3, 'active', true, true)
         RETURNING id, name, tier`,
        [shopName, sub.user_id, sub.tier]
      );

      const newShop = shopResult.rows[0];

      // Calculate subscription period
      const periodStart = new Date();
      const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Link subscription to shop
      await client.query(
        `UPDATE shop_subscriptions
         SET shop_id = $1,
             status = 'active',
             period_start = $2,
             period_end = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [newShop.id, periodStart, periodEnd, subscriptionId]
      );

      // Update shop with payment due date
      await client.query(
        `UPDATE shops
         SET next_payment_due = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [periodEnd, newShop.id]
      );

      await client.query('COMMIT');

      logger.info('[Admin] Subscription recovered successfully', {
        subscriptionId,
        shopId: newShop.id,
        shopName: newShop.name,
        userId: sub.user_id,
      });

      res.json({
        success: true,
        message: 'Shop created and subscription activated',
        data: {
          subscriptionId: parseInt(subscriptionId),
          shopId: newShop.id,
          shopName: newShop.name,
          tier: newShop.tier,
          userId: sub.user_id,
          periodStart,
          periodEnd,
        },
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('[Admin] Subscription recovery failed:', {
      error: error.message,
      subscriptionId,
    });

    res.status(500).json({
      success: false,
      error: 'Recovery failed',
      details: error.message,
    });
  }
});

export default router;
