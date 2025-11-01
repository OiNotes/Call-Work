import express from 'express';
import * as blockCypherService from '../services/blockCypherService.js';
import * as subscriptionService from '../services/subscriptionService.js';
import { paymentQueries, invoiceQueries, orderQueries, processedWebhookQueries, productQueries, shopQueries, userQueries } from '../models/db.js';
import { getClient } from '../config/database.js';
import telegramService from '../services/telegram.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Webhook routes for payment verification (BlockCypher for BTC/LTC)
// ETH/USDT/TRON use polling service instead

/**
 * Helper: Update order status
 */
async function updateOrderStatus(orderId, status) {
  await orderQueries.updateStatus(orderId, status);
  logger.info(`[Webhook] Order ${orderId} status updated to ${status}`);
}

/**
 * Helper: Handle confirmed subscription payment
 * @param {object} invoice - Invoice record with subscription_id
 * @param {object} client - Database client (transaction)
 */
async function handleSubscriptionPayment(invoice, client) {
  try {
    logger.info(`[Webhook] Processing subscription payment for subscription ${invoice.subscription_id}`);

    // Get subscription details
    const subResult = await client.query(
      'SELECT shop_id, tier FROM shop_subscriptions WHERE id = $1',
      [invoice.subscription_id]
    );

    if (subResult.rows.length === 0) {
      logger.error('[Webhook] Subscription not found:', {
        subscriptionId: invoice.subscription_id
      });
      // Don't throw - just mark webhook as processed
      return;
    }

    const subscription = subResult.rows[0];

    // Update subscription status to 'active' and set verified_at
    await client.query(
      `UPDATE shop_subscriptions 
       SET status = 'active', 
           verified_at = NOW()
       WHERE id = $1`,
      [invoice.subscription_id]
    );

    // Update shop subscription status
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    await client.query(
      `UPDATE shops 
       SET tier = $1,
           subscription_status = 'active',
           next_payment_due = $2,
           grace_period_until = NULL,
           registration_paid = true,
           is_active = true,
           updated_at = NOW()
       WHERE id = $3`,
      [subscription.tier, periodEnd, subscription.shop_id]
    );

    // Update invoice status
    await invoiceQueries.updateStatus(invoice.id, 'paid');

    logger.info('[Webhook] Subscription activated successfully', {
      subscriptionId: invoice.subscription_id,
      shopId: subscription.shop_id,
      tier: subscription.tier
    });

    // TODO: Notify shop owner via Telegram about successful subscription payment
    // telegramService.notifySubscriptionActivated(owner.telegram_id, { ... });

  } catch (error) {
    logger.error('[Webhook] Failed to handle subscription payment:', {
      error: error.message,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription_id
    });
    throw error;
  }
}

/**
 * Helper: Send Telegram notifications to buyer and seller
 */
async function sendTelegramNotification(orderId, status) {
  try {
    const order = await orderQueries.findById(orderId);
    if (!order) {
      logger.warn(`[Webhook] Order not found: ${orderId}`);
      return;
    }

    if (status === 'confirmed') {
      // Get product, shop, buyer, and seller info
      const [product, buyer] = await Promise.all([
        productQueries.findById(order.product_id),
        userQueries.findById(order.buyer_id)
      ]);

      const shop = await shopQueries.findById(product.shop_id);
      const seller = await userQueries.findById(shop.owner_id);

      // Notify buyer
      try {
        await telegramService.notifyPaymentConfirmed(order.buyer_telegram_id, {
          id: order.id,
          product_name: order.product_name,
          quantity: order.quantity,
          total_price: order.total_price,
          currency: order.currency,
          seller_username: seller.username,
          shop_name: shop.name
        });
      } catch (notifError) {
        logger.error('[Webhook] Buyer notification error', {
          error: notifError.message,
          orderId
        });
      }

      // Notify seller
      try {
        await telegramService.notifyPaymentConfirmedSeller(seller.telegram_id, {
          orderId: order.id,
          productName: product.name,
          quantity: order.quantity,
          totalPrice: order.total_price,
          currency: order.currency,
          buyerUsername: buyer.username || 'Anonymous',
          buyerTelegramId: buyer.telegram_id
        });
      } catch (notifError) {
        logger.error('[Webhook] Seller notification error', {
          error: notifError.message,
          orderId
        });
      }
    }
  } catch (error) {
    logger.error('[Webhook] Failed to send Telegram notification:', {
      error: error.message,
      orderId
    });
  }
}

/**
 * BlockCypher Webhook Endpoint
 *
 * Receives tx-confirmation notifications for BTC and LTC payments
 * Automatically updates order status when payment reaches threshold confirmations
 *
 * Security features:
 * - CVE-PS-001: Secret token verification
 * - CVE-PS-002: Replay attack protection
 * - CVE-PS-003: Database transactions
 */
router.post('/blockcypher', async (req, res) => {
  const client = await getClient(); // Get DB client for transaction

  try {
    // CVE-PS-001: Verify secret token (query parameter)
    const webhookSecret = process.env.BLOCKCYPHER_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedToken = req.query.token || req.headers['x-webhook-token'];

      if (!providedToken || providedToken !== webhookSecret) {
        logger.warn('[Webhook] BlockCypher: Invalid or missing webhook token', {
          ip: req.ip,
          providedToken: providedToken ? '***' : 'none'
        });
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const payload = req.body;

    logger.info('[Webhook] BlockCypher notification received:', {
      txHash: payload.hash,
      confirmations: payload.confirmations,
      blockHeight: payload.block_height
    });

    // Parse webhook payload
    const paymentData = blockCypherService.parseWebhookPayload(payload);

    // CVE-PS-002: Check for replay attacks
    const webhookId = `blockcypher_${paymentData.txHash}_${payload.confirmations}`;
    const isAlreadyProcessed = await processedWebhookQueries.isProcessed(webhookId);

    if (isAlreadyProcessed) {
      logger.warn('[Webhook] Replay attack detected - webhook already processed', {
        webhookId,
        txHash: paymentData.txHash
      });
      return res.status(200).json({ status: 'already_processed' });
    }

    // CVE-PS-003: Start database transaction
    await client.query('BEGIN');

    try {
      // Mark webhook as processed (replay protection)
      await processedWebhookQueries.markAsProcessed({
        webhookId,
        source: 'blockcypher',
        txHash: paymentData.txHash,
        payload: payload
      });

      // Find invoice by checking all outputs
      let invoice = null;
      for (const output of paymentData.outputs) {
        if (output.addresses && output.addresses.length > 0) {
          for (const address of output.addresses) {
            invoice = await invoiceQueries.findByAddress(address);
            if (invoice) {break;}
          }
          if (invoice) {break;}
        }
      }

      if (!invoice) {
        logger.warn('[Webhook] No invoice found for transaction outputs');
        await client.query('COMMIT'); // Commit anyway to mark webhook as processed
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Determine invoice type
      const isOrderPayment = !!invoice.order_id;
      const isSubscriptionPayment = !!invoice.subscription_id;
      const invoiceType = isOrderPayment ? 'order' : 'subscription';

      logger.info(`[Webhook] Invoice found: ${invoice.id} for ${invoiceType} ${invoice.order_id || invoice.subscription_id}`);

      // Check if payment already exists
      const existingPayment = await paymentQueries.findByTxHash(paymentData.txHash);

      // Determine status based on confirmations
      const chain = invoice.chain.toUpperCase();
      const confirmationThreshold = parseInt(process.env[`CONFIRMATIONS_${chain}`] || '3');
      const status = paymentData.confirmations >= confirmationThreshold ? 'confirmed' : 'pending';

      if (existingPayment) {
        // Update existing payment
        await paymentQueries.updateStatus(
          existingPayment.id,
          status,
          paymentData.confirmations
        );

        // If newly confirmed, update order or subscription
        if (status === 'confirmed' && existingPayment.status !== 'confirmed') {
          if (isSubscriptionPayment) {
            await handleSubscriptionPayment(invoice, client);
            await client.query('COMMIT');
            logger.info(`[Webhook] Subscription ${invoice.subscription_id} activated via BlockCypher!`);
          } else {
            await updateOrderStatus(invoice.order_id, 'confirmed');
            await invoiceQueries.updateStatus(invoice.id, 'paid');

            // Commit transaction before sending Telegram notification
            await client.query('COMMIT');

            await sendTelegramNotification(invoice.order_id, 'confirmed');

            logger.info(`[Webhook] Order ${invoice.order_id} confirmed via BlockCypher!`);
          }
        } else {
          await client.query('COMMIT');
        }

        return res.json({
          status: 'updated',
          confirmations: paymentData.confirmations,
          confirmed: status === 'confirmed'
        });
      }

      // Handle subscription payments (no payment record needed)
      if (isSubscriptionPayment) {
        if (status === 'confirmed') {
          await handleSubscriptionPayment(invoice, client);
          await client.query('COMMIT');
          logger.info(`[Webhook] Subscription ${invoice.subscription_id} activated via BlockCypher!`);
        } else {
          await client.query('COMMIT');
          logger.info(`[Webhook] Subscription payment pending (${paymentData.confirmations} confirmations)`);
        }

        return res.json({
          status: 'success',
          confirmations: paymentData.confirmations,
          confirmed: status === 'confirmed'
        });
      }

      // Create new payment record (for order payments only)
      const payment = await paymentQueries.create({
        orderId: invoice.order_id,
        txHash: paymentData.txHash,
        amount: paymentData.total,
        currency: invoice.currency,
        status: status
      });

      // Update payment with confirmations
      await paymentQueries.updateStatus(payment.id, status, paymentData.confirmations);

      logger.info(`[Webhook] Payment created: ${payment.id} with ${paymentData.confirmations} confirmations`);

      // If already confirmed, update order
      if (status === 'confirmed') {
        await updateOrderStatus(invoice.order_id, 'confirmed');
        await invoiceQueries.updateStatus(invoice.id, 'paid');

        // Commit transaction before sending Telegram notification
        await client.query('COMMIT');

        await sendTelegramNotification(invoice.order_id, 'confirmed');

        logger.info(`[Webhook] Order ${invoice.order_id} confirmed via BlockCypher!`);
      } else {
        await client.query('COMMIT');
      }

      return res.json({
        status: 'success',
        payment_id: payment.id,
        confirmations: paymentData.confirmations,
        confirmed: status === 'confirmed'
      });
    } catch (innerError) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      throw innerError;
    }
  } catch (error) {
    logger.error('[Webhook] Error processing BlockCypher webhook:', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    // Release client back to pool
    client.release();
  }
});

export default router;
