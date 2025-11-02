/**
 * Subscription Routes
 * 
 * Defines API endpoints for shop subscription management
 */

import express from 'express';
import * as subscriptionController from '../controllers/subscriptionController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * All subscription routes require authentication
 */
router.use(verifyToken);

/**
 * POST /api/subscriptions/pending
 * Create pending subscription for first-time shop creation
 *
 * Body: {
 *   tier: 'basic' | 'pro'
 * }
 */
router.post('/pending', subscriptionController.createPendingSubscription);

/**
 * GET /api/subscriptions
 * Get user subscriptions (buyer view)
 *
 * Returns all shops the user is subscribed to
 */
router.get('/', subscriptionController.getUserSubscriptions);

/**
 * POST /api/subscriptions/pay
 * Pay for monthly subscription (renewal or new)
 *
 * Body: {
 *   shopId: number,
 *   tier: 'basic' | 'pro',
 *   txHash: string,
 *   currency: 'BTC' | 'ETH' | 'USDT' | 'LTC',
 *   paymentAddress: string
 * }
 */
router.post('/pay', subscriptionController.paySubscription);

/**
 * POST /api/subscriptions/upgrade
 * Upgrade shop from free to PRO tier
 * 
 * Body: {
 *   shopId: number,
 *   txHash: string,
 *   currency: 'BTC' | 'ETH' | 'USDT' | 'LTC',
 *   paymentAddress: string
 * }
 */
router.post('/upgrade', subscriptionController.upgradeShop);

/**
 * GET /api/subscriptions/upgrade-cost/:shopId
 * Calculate prorated upgrade cost for shop
 */
router.get('/upgrade-cost/:shopId', subscriptionController.getUpgradeCost);

/**
 * GET /api/subscriptions/status/:shopId
 * Get subscription status for shop
 */
router.get('/status/:shopId', subscriptionController.getStatus);

/**
 * GET /api/subscriptions/history/:shopId?limit=10
 * Get subscription payment history for shop
 */
router.get('/history/:shopId', subscriptionController.getHistory);

/**
 * GET /api/subscriptions/pricing
 * Get subscription pricing information (free vs pro)
 */
router.get('/pricing', subscriptionController.getPricing);

/**
 * POST /api/subscriptions/:id/payment/generate
 * Generate payment invoice for subscription
 *
 * Body: {
 *   chain: 'BTC' | 'LTC' | 'ETH' | 'USDT_ERC20' | 'USDT_TRC20'
 * }
 */
router.post('/:id/payment/generate', subscriptionController.generatePaymentInvoice);

/**
 * GET /api/subscriptions/:id/payment/status
 * Get payment status for subscription invoice
 */
router.get('/:id/payment/status', subscriptionController.getPaymentStatus);

export default router;
