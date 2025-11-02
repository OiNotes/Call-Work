/**
 * Subscription Controller
 * 
 * Handles HTTP requests for shop subscription management:
 * - Payment processing for monthly subscriptions
 * - Tier upgrades (basic → pro)
 * - Subscription status and history
 */

import * as subscriptionService from '../services/subscriptionService.js';
import * as subscriptionInvoiceService from '../services/subscriptionInvoiceService.js';
import logger from '../utils/logger.js';

/**
 * Pay for subscription (monthly renewal or new subscription)
 * POST /api/subscriptions/pay
 * 
 * Body: {
 *   shopId: number,
 *   tier: 'basic' | 'pro',
 *   txHash: string,
 *   currency: 'BTC' | 'ETH' | 'USDT',
 *   paymentAddress: string
 * }
 */
async function paySubscription(req, res) {
  try {
    const { shopId, tier, txHash, currency, paymentAddress } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!shopId || !tier || !txHash || !currency || !paymentAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['shopId', 'tier', 'txHash', 'currency', 'paymentAddress']
      });
    }
    
    // Verify shop ownership
    const ownershipCheck = await verifyShopOwnership(shopId, userId);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.status).json({ error: ownershipCheck.error });
    }
    
    // Process subscription payment
    const subscription = await subscriptionService.processSubscriptionPayment(
      shopId,
      tier,
      txHash,
      currency,
      paymentAddress
    );
    
    logger.info(`[SubscriptionController] Subscription payment processed for shop ${shopId}, tier: ${tier}`);
    
    res.status(201).json({
      success: true,
      subscription,
      message: `Subscription activated: ${tier} tier for 30 days`
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error processing subscription payment:', error);
    
    // Handle specific errors
    if (error.message.includes('Transaction verification failed')) {
      return res.status(400).json({ error: 'Transaction verification failed', details: error.message });
    }
    if (error.message.includes('already processed')) {
      return res.status(409).json({ error: 'Transaction already processed' });
    }
    if (error.message.includes('Invalid subscription tier')) {
      return res.status(400).json({ error: 'Invalid subscription tier. Use "basic" or "pro"' });
    }
    
    res.status(500).json({ error: 'Failed to process subscription payment' });
  }
}

/**
 * Upgrade shop from basic to PRO tier
 * POST /api/subscriptions/upgrade
 * 
 * Body: {
 *   shopId: number,
 *   txHash: string,
 *   currency: 'BTC' | 'ETH' | 'USDT',
 *   paymentAddress: string
 * }
 */
async function upgradeShop(req, res) {
  try {
    const { shopId, txHash, currency, paymentAddress } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!shopId || !txHash || !currency || !paymentAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['shopId', 'txHash', 'currency', 'paymentAddress']
      });
    }
    
    // Verify shop ownership
    const ownershipCheck = await verifyShopOwnership(shopId, userId);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.status).json({ error: ownershipCheck.error });
    }
    
    // Upgrade shop to PRO
    const subscription = await subscriptionService.upgradeShopToPro(
      shopId,
      txHash,
      currency,
      paymentAddress
    );
    
    logger.info(`[SubscriptionController] Shop ${shopId} upgraded to PRO tier`);
    
    res.status(200).json({
      success: true,
      subscription,
      message: 'Shop upgraded to PRO tier successfully',
      newTier: 'pro'
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error upgrading shop:', error);
    
    // Handle specific errors
    if (error.message.includes('already PRO')) {
      return res.status(400).json({ error: 'Shop is already PRO tier' });
    }
    if (error.message.includes('No active subscription')) {
      return res.status(400).json({ error: 'No active subscription found. Please renew subscription first.' });
    }
    if (error.message.includes('Transaction verification failed')) {
      return res.status(400).json({ error: 'Transaction verification failed', details: error.message });
    }
    if (error.message.includes('already processed')) {
      return res.status(409).json({ error: 'Transaction already processed' });
    }
    
    res.status(500).json({ error: 'Failed to upgrade shop' });
  }
}

/**
 * Get upgrade cost for shop
 * GET /api/subscriptions/upgrade-cost/:shopId
 */
async function getUpgradeCost(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);
    const userId = req.user.id;
    
    // Verify shop ownership
    const ownershipCheck = await verifyShopOwnership(shopId, userId);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.status).json({ error: ownershipCheck.error });
    }
    
    const upgradeInfo = await subscriptionService.calculateUpgradeCost(shopId);
    
    res.json(upgradeInfo);
  } catch (error) {
    logger.error('[SubscriptionController] Error calculating upgrade cost:', error);
    
    if (error.message.includes('Shop not found')) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    if (error.message.includes('No active subscription')) {
      return res.status(400).json({ error: 'No active subscription found' });
    }
    
    res.status(500).json({ error: 'Failed to calculate upgrade cost' });
  }
}

/**
 * Get subscription status for shop
 * GET /api/subscriptions/status/:shopId
 */
async function getStatus(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);
    const userId = req.user.id;
    
    // Verify shop ownership
    const ownershipCheck = await verifyShopOwnership(shopId, userId);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.status).json({ error: ownershipCheck.error });
    }
    
    const status = await subscriptionService.getSubscriptionStatus(shopId);
    
    res.json(status);
  } catch (error) {
    logger.error('[SubscriptionController] Error getting subscription status:', error);
    
    if (error.message.includes('Shop not found')) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
}

/**
 * Get subscription payment history for shop
 * GET /api/subscriptions/history/:shopId?limit=10
 */
async function getHistory(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 10;
    
    // Verify shop ownership
    const ownershipCheck = await verifyShopOwnership(shopId, userId);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.status).json({ error: ownershipCheck.error });
    }
    
    const history = await subscriptionService.getSubscriptionHistory(shopId, limit);
    
    res.json({
      shopId,
      history
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error getting subscription history:', error);
    res.status(500).json({ error: 'Failed to get subscription history' });
  }
}

/**
 * Get subscription pricing info
 * GET /api/subscriptions/pricing
 */
async function getPricing(req, res) {
  try {
    res.json({
      basic: {
        price: subscriptionService.SUBSCRIPTION_PRICES.basic,
        currency: 'USD',
        period: '30 days',
        features: [
          'Create and manage shop',
          'Up to 4 products',
          'Basic analytics',
          'Crypto payments (BTC, ETH, USDT)'
        ]
      },
      pro: {
        price: subscriptionService.SUBSCRIPTION_PRICES.pro,
        currency: 'USD',
        period: '30 days',
        features: [
          'All Basic features',
          'Unlimited products',
          'Unlimited Follow Shop (dropshipping)',
          'Channel Migration (2 times/month)',
          'Priority support',
          'Advanced analytics'
        ]
      },
      gracePeriod: {
        days: subscriptionService.GRACE_PERIOD_DAYS,
        description: 'Grace period after subscription expires before shop deactivation'
      }
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error getting pricing:', error);
    res.status(500).json({ error: 'Failed to get pricing information' });
  }
}

/**
 * Helper: Verify shop ownership
 * 
 * @param {number} shopId - Shop ID
 * @param {number} userId - User ID
 * @returns {Promise<{success: boolean, status?: number, error?: string}>}
 */
async function verifyShopOwnership(shopId, userId) {
  try {
    const pool = (await import('../config/database.js')).default;
    
    const result = await pool.query(
      'SELECT owner_id FROM shops WHERE id = $1',
      [shopId]
    );
    
    if (result.rows.length === 0) {
      return { success: false, status: 404, error: 'Shop not found' };
    }
    
    if (result.rows[0].owner_id !== userId) {
      return { success: false, status: 403, error: 'Not authorized to manage this shop' };
    }
    
    return { success: true };
  } catch (error) {
    logger.error('[SubscriptionController] Error verifying shop ownership:', error);
    return { success: false, status: 500, error: 'Internal server error' };
  }
}

/**
 * Get user subscriptions (buyer view)
 * GET /api/subscriptions
 */
async function getUserSubscriptions(req, res) {
  try {
    const userId = req.user.id;

    const subscriptions = await subscriptionService.getUserSubscriptions(userId);

    res.json({
      data: subscriptions,
      count: subscriptions.length
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error getting user subscriptions:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });

    res.status(500).json({
      error: 'Failed to fetch subscriptions'
    });
  }
}

/**
 * Generate payment invoice for subscription
 * POST /api/subscriptions/:id/payment/generate
 * 
 * Body: {
 *   chain: 'BTC' | 'LTC' | 'ETH' | 'USDT_ERC20' | 'USDT_TRC20'
 * }
 */
async function generatePaymentInvoice(req, res) {
  try {
    const subscriptionId = parseInt(req.params.id, 10);
    const { chain } = req.body;
    const userId = req.user.id;

    // Validate chain
    const validChains = ['BTC', 'LTC', 'ETH', 'USDT_ERC20', 'USDT_TRC20'];
    if (!chain || !validChains.includes(chain.toUpperCase())) {
      return res.status(400).json({
        error: 'Invalid chain. Supported: BTC, LTC, ETH, USDT_ERC20, USDT_TRC20',
        required: 'chain'
      });
    }

    // Verify subscription exists and user owns it
    const ownershipCheck = await verifySubscriptionOwnership(subscriptionId, userId);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.status).json({ error: ownershipCheck.error });
    }

    const subscription = ownershipCheck.subscription;

    // Check subscription status (only pending or failed can generate invoices)
    if (subscription.status !== 'pending' && subscription.status !== 'failed') {
      return res.status(400).json({
        error: `Cannot generate invoice for subscription with status: ${subscription.status}`,
        currentStatus: subscription.status
      });
    }

    // Check if there's already an active invoice
    const activeInvoice = await subscriptionInvoiceService.findActiveInvoiceForSubscription(subscriptionId);

    if (activeInvoice) {
      logger.info(`[SubscriptionController] Active invoice already exists for subscription ${subscriptionId}`);

      return res.status(200).json({
        success: true,
        invoice: {
          invoiceId: activeInvoice.id,
          address: activeInvoice.address,
          expectedAmount: parseFloat(activeInvoice.expected_amount),
          currency: activeInvoice.currency,
          expiresAt: activeInvoice.expires_at,
          status: activeInvoice.status
        },
        message: 'Using existing active invoice'
      });
    }

    // Generate new invoice
    const invoiceData = await subscriptionInvoiceService.generateSubscriptionInvoice(
      subscriptionId,
      chain.toUpperCase()
    );

    logger.info(`[SubscriptionController] Invoice generated for subscription ${subscriptionId}`);

    res.status(201).json({
      success: true,
      invoice: {
        invoiceId: invoiceData.invoice.id,
        address: invoiceData.address,
        expectedAmount: invoiceData.expectedAmount,
        currency: invoiceData.currency,
        expiresAt: invoiceData.expiresAt
      },
      message: 'Payment invoice generated successfully'
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error generating payment invoice:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('Invalid') || error.message.includes('Unsupported')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to generate payment invoice' });
  }
}

/**
 * Get payment status for subscription
 * GET /api/subscriptions/:id/payment/status
 */
async function getPaymentStatus(req, res) {
  try {
    const subscriptionId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    // Verify subscription ownership
    const ownershipCheck = await verifySubscriptionOwnership(subscriptionId, userId);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.status).json({ error: ownershipCheck.error });
    }

    // Find active invoice
    const activeInvoice = await subscriptionInvoiceService.findActiveInvoiceForSubscription(subscriptionId);

    if (!activeInvoice) {
      return res.status(404).json({
        error: 'No active payment invoice found for this subscription',
        subscriptionId
      });
    }

    // Check if invoice is expired
    const now = new Date();
    const expiresAt = new Date(activeInvoice.expires_at);
    const isExpired = now > expiresAt;

    res.json({
      success: true,
      payment: {
        status: isExpired ? 'expired' : activeInvoice.status,
        address: activeInvoice.address,
        expectedAmount: parseFloat(activeInvoice.expected_amount),
        currency: activeInvoice.currency,
        expiresAt: activeInvoice.expires_at,
        paidAt: activeInvoice.paid_at || null,
        invoiceId: activeInvoice.id
      }
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error getting payment status:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to get payment status' });
  }
}

/**
 * Create pending subscription for first-time shop creation
 * POST /api/subscriptions/pending
 *
 * Body: {
 *   tier: 'basic' | 'pro'
 * }
 */
async function createPendingSubscription(req, res) {
  try {
    const { tier } = req.body;
    const userId = req.user.id;

    logger.info('[SubscriptionController] Creating pending subscription:', {
      userId,
      tier,
      requestBody: req.body
    });

    // Validate tier
    if (!tier || !['basic', 'pro'].includes(tier)) {
      logger.warn('[SubscriptionController] Invalid tier provided:', { tier, userId });
      return res.status(400).json({
        error: 'Invalid tier. Use "basic" or "pro"',
        required: 'tier'
      });
    }

    // Get database client for transaction
    const { getClient } = await import('../config/database.js');
    const client = await getClient();

    try {
      await client.query('BEGIN');
      logger.debug('[SubscriptionController] Transaction started');

      // Check if user already has a shop
      logger.debug('[SubscriptionController] Checking for existing shop...');

      const existingShop = await client.query(
        'SELECT id FROM shops WHERE owner_id = $1',
        [userId]
      );

      if (existingShop.rows.length > 0) {
        await client.query('ROLLBACK');
        logger.warn('[SubscriptionController] User already has a shop:', {
          userId,
          existingShopId: existingShop.rows[0].id
        });
        return res.status(400).json({
          error: 'User already has a shop. Use renewal endpoint instead.'
        });
      }

      logger.debug('[SubscriptionController] No existing shop found, creating pending subscription...');

      // Create pending subscription WITHOUT shop (shop will be created after payment)
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const tempTxHash = `pending-${userId}-${Date.now()}`;
      const amount = tier === 'pro' ? 35.00 : 25.00;

      const subscriptionResult = await client.query(
        `INSERT INTO shop_subscriptions
         (user_id, shop_id, tier, amount, tx_hash, currency, period_start, period_end, status)
         VALUES ($1, NULL, $2, $3, $4, 'USDT', $5, $6, 'pending')
         RETURNING id`,
        [userId, tier, amount, tempTxHash, now, periodEnd]
      );

      const subscriptionId = subscriptionResult.rows[0].id;

      await client.query('COMMIT');
      logger.info('[SubscriptionController] Pending subscription created:', {
        userId,
        subscriptionId,
        tier,
        amount
      });

      res.status(201).json({
        success: true,
        data: {
          subscriptionId,
          tier,
          amount,
          periodEnd: periodEnd.toISOString(),
          message: 'Pending subscription created. Complete payment to activate.'
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[SubscriptionController] Error in transaction (rolled back):', {
        error: error.message,
        stack: error.stack,
        userId,
        tier
      });
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('[SubscriptionController] Error creating pending subscription:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      tier: req.body?.tier
    });
    console.error('[CRITICAL ERROR] Failed to create pending subscription:', error);
    res.status(500).json({
      error: 'Failed to create pending subscription',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Helper: Verify subscription ownership
 *
 * @param {number} subscriptionId - Subscription ID
 * @param {number} userId - User ID
 * @returns {Promise<{success: boolean, status?: number, error?: string, subscription?: object}>}
 */
async function verifySubscriptionOwnership(subscriptionId, userId) {
  try {
    const pool = (await import('../config/database.js')).default;

    const result = await pool.query(
      `SELECT ss.*,
              CASE
                WHEN ss.shop_id IS NOT NULL THEN s.owner_id
                ELSE ss.user_id
              END as owner_id
       FROM shop_subscriptions ss
       LEFT JOIN shops s ON ss.shop_id = s.id
       WHERE ss.id = $1`,
      [subscriptionId]
    );

    if (result.rows.length === 0) {
      return { success: false, status: 404, error: 'Subscription not found' };
    }

    const subscription = result.rows[0];

    // Check ownership via user_id or shop owner_id
    if (subscription.owner_id !== userId) {
      return { success: false, status: 403, error: 'Not authorized to access this subscription' };
    }

    return { success: true, subscription };
  } catch (error) {
    logger.error('[SubscriptionController] Error verifying subscription ownership:', error);
    return { success: false, status: 500, error: 'Internal server error' };
  }
}

export {
  paySubscription,
  upgradeShop,
  getUpgradeCost,
  getStatus,
  getHistory,
  getPricing,
  getUserSubscriptions,
  generatePaymentInvoice,
  getPaymentStatus,
  createPendingSubscription
};
