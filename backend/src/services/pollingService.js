import {
  paymentQueries,
  invoiceQueries,
  orderQueries,
  orderItemQueries,
  productQueries,
  shopQueries,
  userQueries,
} from '../database/queries/index.js';
import { getClient } from '../config/database.js';
import * as etherscanService from './etherscanService.js';
import * as tronService from './tronService.js';
import * as blockCypherService from './blockCypherService.js';
import telegramService from './telegram.js';
import * as broadcastService from './broadcastService.js';
import logger from '../utils/logger.js';
import { amountsMatchWithTolerance } from '../utils/paymentTolerance.js';
import { SUPPORTED_CURRENCIES } from '../utils/constants.js';

/**
 * Polling Service - Payment monitoring for ETH and TRON chains
 *
 * Features:
 * - Poll pending invoices every 60 seconds
 * - Verify payments on Ethereum (ETH, USDT ERC-20)
 * - Verify payments on Tron (USDT TRC-20)
 * - Update payment records and order status
 * - Notify users via Telegram
 * - Handle expired invoices
 *
 * Note: BTC and LTC use webhooks (BlockCypher), so no polling needed
 */

let pollingInterval;
let isPolling = false;
let isProcessing = false; // Mutex lock to prevent concurrent polling

// Configuration
const POLLING_INTERVAL_MS = 60000; // 60 seconds
const BATCH_SIZE = 10; // Process 10 invoices at a time

// Statistics
let stats = {
  pollCount: 0,
  paymentsFound: 0,
  paymentsConfirmed: 0,
  errors: 0,
  lastPollTime: null,
};

/**
 * Start polling service
 */
export function startPolling() {
  if (isPolling) {
    logger.warn('[PollingService] Already running');
    return;
  }

  logger.info('[PollingService] Starting payment polling...');

  isPolling = true;

  // Run immediately on start with mutex lock
  isProcessing = true;
  checkPendingPayments()
    .catch((error) => {
      logger.error('[PollingService] Initial poll failed:', {
        error: error.message,
      });
    })
    .finally(() => {
      isProcessing = false;
    });

  // Then run every 60 seconds with mutex lock
  pollingInterval = setInterval(async () => {
    if (isPolling && !isProcessing) {
      isProcessing = true;
      try {
        await checkPendingPayments();
      } catch (error) {
        logger.error('[PollingService] Polling error:', error);
      } finally {
        isProcessing = false;
      }
    } else if (isProcessing) {
      logger.warn('[PollingService] Skipping poll - previous poll still running');
    }
  }, POLLING_INTERVAL_MS);

  logger.info('[PollingService] Polling started successfully');
}

/**
 * Stop polling service
 */
export function stopPolling() {
  if (!isPolling) {
    logger.warn('[PollingService] Not running');
    return;
  }

  logger.info('[PollingService] Stopping payment polling...');

  isPolling = false;

  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  logger.info('[PollingService] Polling stopped successfully');
}

/**
 * Get polling statistics
 * @returns {object} Statistics
 */
export function getStats() {
  return {
    ...stats,
    isRunning: isPolling,
  };
}

/**
 * Reset statistics
 */
export function resetStats() {
  stats = {
    pollCount: 0,
    paymentsFound: 0,
    paymentsConfirmed: 0,
    errors: 0,
    lastPollTime: null,
  };
  logger.info('[PollingService] Statistics reset');
}

/**
 * Main polling function - checks all pending payments
 */
async function checkPendingPayments() {
  try {
    stats.pollCount++;
    stats.lastPollTime = new Date().toISOString();

    logger.info('[PollingService] Checking pending payments...', {
      pollCount: stats.pollCount,
    });

    // Get all pending invoices for ETH and TRON (USDT TRC-20) chains
    const pendingInvoices = await getPendingInvoices();

    if (pendingInvoices.length === 0) {
      logger.debug('[PollingService] No pending invoices found');
      return;
    }

    logger.info(`[PollingService] Found ${pendingInvoices.length} pending invoices`);

    // Process invoices in batches
    for (let i = 0; i < pendingInvoices.length; i += BATCH_SIZE) {
      const batch = pendingInvoices.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map((invoice) => processInvoice(invoice)));
    }

    // Handle expired invoices
    await handleExpiredInvoices();

    logger.info('[PollingService] Poll completed', {
      processed: pendingInvoices.length,
      paymentsFound: stats.paymentsFound,
      paymentsConfirmed: stats.paymentsConfirmed,
    });
  } catch (error) {
    stats.errors++;
    logger.error('[PollingService] Poll failed:', {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Get pending invoices for ETH and TRON (USDT TRC-20) chains
 * @returns {Promise<Array>} Pending invoices
 */
async function getPendingInvoices() {
  try {
    // Query invoices table for pending invoices (all chains)
    // BTC/LTC use webhooks but polling serves as fallback
    const result = await invoiceQueries.findPendingByChains([
      'ETH',
      'USDT_TRC20',
      'BTC',
      'LTC'
    ]);
    return result || [];
  } catch (error) {
    logger.error('[PollingService] Failed to get pending invoices:', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Process a single invoice - check for payment
 * @param {object} invoice - Invoice record
 */
async function processInvoice(invoice) {
  try {
    const invoiceType = invoice.order_id ? 'order' : 'subscription';
    logger.debug(`[PollingService] Processing ${invoiceType} invoice ${invoice.id}`, {
      chain: invoice.chain,
      address: invoice.address,
      expectedAmount: invoice.expected_amount,
      orderId: invoice.order_id || null,
      subscriptionId: invoice.subscription_id || null,
    });

    let payment;

    // Check if invoice expired BEFORE attempting verification
    const now = new Date();
    const expiresAt = new Date(invoice.expires_at);
    
    // Allow 24-hour grace period for crypto payments
    // This prevents "money gone" scenarios where user pays right at expiration
    const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
    const hardDeadline = new Date(expiresAt.getTime() + GRACE_PERIOD_MS);

    if (now > hardDeadline) {
      logger.info(`[PollingService] Invoice expired > 24h ago, skipping:`, {
        invoiceId: invoice.id,
        expiresAt: invoice.expires_at,
        chain: invoice.chain,
      });
      
      // Mark as expired (will be handled by handleExpiredInvoices)
      return;
    }

    if (now > expiresAt) {
      logger.info(`[PollingService] Invoice expired but within grace period, checking payment:`, {
        invoiceId: invoice.id,
        expiresAt: invoice.expires_at,
        chain: invoice.chain,
      });
    }

    // Check based on chain
    if (invoice.chain === 'ETH') {
      payment = await checkEthPayment(invoice);
    } else if (invoice.chain === 'USDT_TRC20') {
      payment = await checkTronPayment(invoice);
    } else if (invoice.chain === 'BTC' || invoice.chain === 'LTC') {
      payment = await checkBlockCypherPayment(invoice);
    } else {
      logger.warn(`[PollingService] Unsupported chain: ${invoice.chain}`);
      return;
    }

    if (!payment) {
      logger.debug(`[PollingService] No payment found for ${invoiceType} invoice ${invoice.id}`);
      return;
    }

    // Payment found!
    stats.paymentsFound++;

    logger.info(`[PollingService] Payment found for ${invoiceType} invoice ${invoice.id}`, {
      txHash: payment.txHash,
      amount: payment.amount,
      confirmations: payment.confirmations,
      orderId: invoice.order_id || null,
      subscriptionId: invoice.subscription_id || null,
    });

    // Check if payment already exists in database
    const existingPayment = await paymentQueries.findByTxHash(payment.txHash);

    if (existingPayment) {
      // Update existing payment
      const updatedPayment = await paymentQueries.updateStatus(
        existingPayment.id,
        payment.status,
        payment.confirmations
      );

      if (payment.status === 'confirmed') {
        await invoiceQueries.updateStatus(invoice.id, 'paid', payment.txHash || payment.tx_hash);
        invoice.tx_hash = payment.txHash || payment.tx_hash;
        invoice.status = 'paid';
      }

      // If newly confirmed, handle order/subscription
      if (payment.status === 'confirmed' && existingPayment.status !== 'confirmed') {
        stats.paymentsConfirmed++;
        await handleConfirmedPayment(invoice, updatedPayment);
      }
    } else {
      // Create new payment record
      const newPayment = await paymentQueries.create({
        orderId: invoice.order_id || null,
        subscriptionId: invoice.subscription_id || null,
        txHash: payment.txHash,
        amount: payment.amount,
        currency: invoice.currency,
        status: payment.status,
      });

      // Update confirmations if available
      if (payment.confirmations !== undefined) {
        await paymentQueries.updateStatus(newPayment.id, payment.status, payment.confirmations);
      }

      // Update invoice status
      await invoiceQueries.updateStatus(invoice.id, 'paid', payment.txHash || payment.tx_hash);
      invoice.tx_hash = payment.txHash || payment.tx_hash;
      invoice.status = 'paid';

      // If confirmed, handle order
      if (payment.status === 'confirmed') {
        stats.paymentsConfirmed++;
        await handleConfirmedPayment(invoice, newPayment);
      }
    }
  } catch (error) {
    logger.error(`[PollingService] Failed to process invoice ${invoice.id}:`, {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Check for ETH payment (ETH or USDT ERC-20)
 * @param {object} invoice - Invoice record
 * @returns {Promise<object|null>} Payment details or null
 */
async function checkEthPayment(invoice) {
  try {
    const currency = invoice.currency.toUpperCase();

    if (currency === 'ETH') {
      // Discover ETH value transfers to this address via Etherscan txlist
      const txs = await etherscanService.getAddressTransactions(invoice.address);
      if (!txs || txs.length === 0) {
        return null;
      }

      const expectedAmountEth = parseFloat(invoice.crypto_amount);
      const matching = txs.find((tx) => {
        if (!tx.to || tx.isError) return false;
        if (tx.to.toLowerCase() !== invoice.address.toLowerCase()) return false;
        const amountEth = parseInt(tx.value, 10) / 1e18;
        return amountsMatchWithTolerance(amountEth, expectedAmountEth, undefined, 'ETH');
      });

      if (!matching) {
        return null;
      }

      // Verify this transaction for confirmations and status
      const verification = await etherscanService.verifyEthPayment(
        matching.hash,
        invoice.address,
        expectedAmountEth
      );
      if (!verification.verified) {
        return null;
      }

      return {
        txHash: matching.hash,
        amount: verification.amount,
        confirmations: verification.confirmations,
        status: verification.status,
      };
    } else if (currency === 'USDT') {
      // Get USDT ERC-20 transfers to this address
      const transfers = await etherscanService.getTokenTransfers(invoice.address);

      if (transfers.length === 0) {
        return null;
      }

      // Find matching transfer
      const matchingTransfer = transfers.find((tx) => {
        const amount = parseInt(tx.value) / 1e6; // USDT has 6 decimals
        return amountsMatchWithTolerance(amount, invoice.crypto_amount, undefined, 'USDT');
      });

      if (!matchingTransfer) {
        return null;
      }

      // Verify this specific transaction
      const verification = await etherscanService.verifyUsdtPayment(
        matchingTransfer.hash,
        invoice.address,
        invoice.crypto_amount
      );

      if (!verification.verified) {
        return null;
      }

      return {
        txHash: matchingTransfer.hash,
        amount: verification.amount,
        confirmations: verification.confirmations,
        status: verification.status,
      };
    }

    return null;
  } catch (error) {
    logger.error('[PollingService] ETH payment check failed:', {
      error: error.message,
      invoiceId: invoice.id,
    });
    return null;
  }
}

/**
 * Check for TRON payment (USDT TRC-20)
 * @param {object} invoice - Invoice record
 * @returns {Promise<object|null>} Payment details or null
 */
async function checkTronPayment(invoice) {
  try {
    // Get USDT TRC-20 transfers to this address
    const transfers = await tronService.getTrc20Transfers(invoice.address);

    if (transfers.length === 0) {
      return null;
    }

    // Find matching transfer
    const matchingTransfer = transfers.find((tx) => {
      const amount = parseFloat(tx.value) / Math.pow(10, tx.tokenInfo.decimals);
      return (
        tx.to === invoice.address &&
        amountsMatchWithTolerance(amount, invoice.crypto_amount, undefined, 'USDT_TRC20')
      );
    });

    if (!matchingTransfer) {
      return null;
    }

    // Verify this specific transaction
    const verification = await tronService.verifyPayment(
      matchingTransfer.transactionId,
      invoice.address,
      invoice.crypto_amount
    );

    if (!verification.verified) {
      return null;
    }

    return {
      txHash: matchingTransfer.transactionId,
      amount: verification.amount,
      confirmations: verification.confirmations,
      status: verification.status,
    };
  } catch (error) {
    logger.error('[PollingService] TRON payment check failed:', {
      error: error.message,
      invoiceId: invoice.id,
    });
    return null;
  }
}

/**
 * Check BTC/LTC payment via BlockCypher API
 * @param {Object} invoice - Invoice object
 * @returns {Promise<Object|null>} Payment object or null
 */
async function checkBlockCypherPayment(invoice) {
  try {
    logger.info(`[PollingService] Checking ${invoice.chain} payment for invoice:`, {
      invoiceId: invoice.id,
      address: invoice.address,
      chain: invoice.chain,
    });

    // Get pending transactions for address
    const chain = invoice.chain; // 'BTC' or 'LTC'
    let txHash = invoice.tx_hash; // If user provided tx hash or webhook set it

    // If no tx_hash, try to find transaction by address via BlockCypher
    if (!txHash) {
      logger.debug(`[PollingService] No tx_hash for ${chain} invoice ${invoice.id}, checking address transactions`);
      
      try {
        // Get address info from BlockCypher
        const addressInfo = await blockCypherService.getAddressInfo(chain, invoice.address);
        
        const confirmed = Array.isArray(addressInfo?.txrefs) ? addressInfo.txrefs : [];
        const unconfirmed = Array.isArray(addressInfo?.unconfirmed_txrefs)
          ? addressInfo.unconfirmed_txrefs
          : [];

        const allRefs = [...confirmed, ...unconfirmed];

        if (allRefs.length === 0) {
          logger.debug(
            `[PollingService] No transactions (confirmed or unconfirmed) found for ${chain} address ${invoice.address}`
          );
          return null;
        }

        // Find first transaction that matches expected amount (with tolerance per chain)
        const expectedAmount = parseFloat(invoice.crypto_amount);
        const matchingTx = allRefs.find((tx) => {
          const txAmount = tx.value / 1e8; // Convert satoshis to BTC/LTC
          return amountsMatchWithTolerance(txAmount, expectedAmount, undefined, chain);
        });

        if (!matchingTx) {
          logger.debug(
            `[PollingService] No matching transaction found for amount ${expectedAmount} on ${chain} address`
          );
          return null;
        }
        
        txHash = matchingTx.tx_hash;
        logger.info(`[PollingService] Found tx_hash ${txHash} for ${chain} invoice ${invoice.id}`);
      } catch (error) {
        logger.error(`[PollingService] Error getting address info:`, {
          error: error.message,
          chain,
          address: invoice.address,
        });
        return null;
      }
    }

    // Verify payment using BlockCypher
    const verificationResult = await blockCypherService.verifyPayment(
      chain,
      txHash,
      invoice.address,
      parseFloat(invoice.crypto_amount)
    );

    if (!verificationResult.verified) {
      logger.warn(`[PollingService] ${chain} payment not verified:`, {
        invoiceId: invoice.id,
        txHash,
        error: verificationResult.error,
      });
      return null;
    }

    logger.info(`[PollingService] ${chain} payment verified:`, {
      invoiceId: invoice.id,
      txHash,
      confirmations: verificationResult.confirmations,
      amount: verificationResult.amount,
    });

    // Check confirmations - use threshold from constants
    const minConfirmations = SUPPORTED_CURRENCIES[chain].confirmations;
    const status = verificationResult.confirmations >= minConfirmations ? 'confirmed' : 'pending';

    // Create payment record
    return {
      txHash: txHash,
      amount: verificationResult.amount,
      confirmations: verificationResult.confirmations,
      status: status,
    };
  } catch (error) {
    logger.error(`[PollingService] Error checking ${invoice.chain} payment:`, {
      error: error.message,
      stack: error.stack,
      invoiceId: invoice.id,
    });
    return null;
  }
}

/**
 * Handle confirmed payment - update order/subscription and notify user
 * @param {object} invoice - Invoice record
 * @param {object} payment - Payment record
 */
async function handleConfirmedPayment(invoice, payment) {
  try {
    const isOrderPayment = !!invoice.order_id;
    const isSubscriptionPayment = !!invoice.subscription_id;

    logger.info(
      `[PollingService] Handling confirmed payment for ${isOrderPayment ? 'order' : 'subscription'} ${invoice.order_id || invoice.subscription_id}`
    );
    if (payment) {
      logger.info('[PollingService] Payment details', {
        paymentId: payment.id,
        txHash: payment.tx_hash ?? payment.txHash,
        orderId: invoice.order_id || null,
        subscriptionId: invoice.subscription_id || null,
      });
    }

    // Handle subscription payment
    if (isSubscriptionPayment) {
      await handleSubscriptionPayment(invoice);
      return;
    }

    // Handle order payment (existing logic below)

    // CRITICAL: Use transaction for atomicity (order status + stock updates)
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Get order
      const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [
        invoice.order_id,
      ]);
      const order = orderResult.rows[0];

      if (!order) {
        logger.error('[PollingService] Order not found:', {
          orderId: invoice.order_id,
        });
        await client.query('ROLLBACK');
        client.release();
        return;
      }

      // ✅ БАГ #4 FIX: Check invoice expiry
      const invoiceCheckResult = await client.query(
        'SELECT id, expires_at FROM invoices WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
        [invoice.order_id]
      );

      if (invoiceCheckResult.rows.length > 0) {
        const invoiceData = invoiceCheckResult.rows[0];
        const now = new Date();
        const expiresAt = new Date(invoiceData.expires_at);

        if (now > expiresAt) {
          await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
            'cancelled',
            invoice.order_id,
          ]);
          await client.query('COMMIT');
          client.release();

          logger.warn('[PollingService] Invoice expired - order cancelled', {
            orderId: invoice.order_id,
            invoiceId: invoiceData.id,
            expiresAt: invoiceData.expires_at,
            expiredAgo: Math.round((now - expiresAt) / 1000 / 60),
          });

          // Notify user
          try {
            await telegramService.notifyOrderCancelled(order.buyer_telegram_id, {
              orderId: order.id,
              reason: 'Payment window expired',
            });
          } catch (err) {
            logger.error('[PollingService] Failed to notify user', { error: err.message });
          }

          return;
        }
      }

      // ✅ FIX #4: Lock products BEFORE checking stock
      const orderItems = await orderItemQueries.findByOrderIdWithStock(invoice.order_id, client);

      const productIds = orderItems.map((item) => item.product_id).filter(Boolean);

      if (productIds.length > 0) {
        await client.query(
          `SELECT id FROM products 
           WHERE id = ANY($1::int[])
           FOR UPDATE`,
          [productIds]
        );

        logger.info('[PollingService] Products locked for stock check', {
          orderId: invoice.order_id,
          productIds,
        });
      }

      // Re-check stock AFTER lock (fresh data)
      if (orderItems.length === 0) {
        // Fallback: legacy single-item order
        logger.warn('[PollingService] No order_items found - assuming legacy single-item order', {
          orderId: invoice.order_id,
        });

        // Get order with product and shop validation (LEFT JOIN to detect deletions)
        const legacyOrderResult = await client.query(
          `SELECT o.*, p.id as product_id_check, p.stock_quantity, p.is_preorder, p.name as product_name,
                  s.id as shop_id, s.name as shop_name
           FROM orders o
           LEFT JOIN products p ON o.product_id = p.id
           LEFT JOIN shops s ON p.shop_id = s.id
           WHERE o.id = $1`,
          [invoice.order_id]
        );
        const legacyOrder = legacyOrderResult.rows[0];

        // Check if product or shop were deleted
        if (!legacyOrder.product_id_check || !legacyOrder.shop_id) {
          await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
            'cancelled',
            invoice.order_id,
          ]);
          await client.query('COMMIT');
          client.release();

          logger.warn('[PollingService] Product/shop deleted - order cancelled', {
            orderId: invoice.order_id,
            productDeleted: !legacyOrder.product_id_check,
            shopDeleted: !legacyOrder.shop_id,
          });

          // Notify user
          try {
            await telegramService.notifyOrderCancelled(order.buyer_telegram_id, {
              orderId: order.id,
              reason: 'Product no longer available',
            });
          } catch (err) {
            logger.error('[PollingService] Failed to notify user', { error: err.message });
          }

          return;
        }

        // Skip stock check for preorder products
        if (legacyOrder.is_preorder) {
          logger.info('[PollingService] Preorder product - skipping stock check', {
            orderId: invoice.order_id,
            productId: order.product_id,
          });
        } else if (legacyOrder.stock_quantity < order.quantity) {
          // Stock insufficient - cancel order
          await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
            'cancelled',
            invoice.order_id,
          ]);
          await client.query('COMMIT');
          client.release();

          logger.warn(
            '[PollingService] Payment confirmed but stock insufficient - order cancelled',
            {
              orderId: invoice.order_id,
              productId: order.product_id,
              stockAvailable: legacyOrder.stock_quantity,
              quantityNeeded: order.quantity,
            }
          );

          // Notify user about sold out
          try {
            await telegramService.notifyOrderCancelled(order.buyer_telegram_id, {
              orderId: order.id,
              reason: 'Product sold out - refund will be processed',
            });
          } catch (notifError) {
            logger.error('[PollingService] Failed to notify buyer about stock shortage', {
              error: notifError.message,
            });
          }

          return;
        }
      } else {
        // Multi-item order - validate ALL products
        logger.info('[PollingService] Validating multi-item order', {
          orderId: invoice.order_id,
          itemCount: orderItems.length,
        });

        for (const item of orderItems) {
          // Check if product/shop deleted
          if (!item.product_id || !item.shop_id) {
            await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
              'cancelled',
              invoice.order_id,
            ]);
            await client.query('COMMIT');
            client.release();

            logger.warn('[PollingService] Product/shop deleted in multi-item order - cancelled', {
              orderId: invoice.order_id,
              itemId: item.item_id,
              productDeleted: !item.product_id,
              shopDeleted: !item.shop_id,
            });

            // Notify user
            try {
              await telegramService.notifyOrderCancelled(order.buyer_telegram_id, {
                orderId: order.id,
                reason: `"${item.product_name || 'Product'}" no longer available`,
              });
            } catch (notifError) {
              logger.error('[PollingService] Failed to notify buyer', {
                error: notifError.message,
              });
            }

            return;
          }

          // Skip stock check for preorder products
          if (item.is_preorder) {
            logger.info('[PollingService] Preorder item - skipping stock check', {
              orderId: invoice.order_id,
              productId: item.product_id,
              productName: item.product_name,
            });
            continue;
          }

          // Check stock availability
          if (item.stock_quantity < item.ordered_quantity) {
            await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
              'cancelled',
              invoice.order_id,
            ]);
            await client.query('COMMIT');
            client.release();

            logger.warn('[PollingService] Insufficient stock in multi-item order - cancelled', {
              orderId: invoice.order_id,
              productId: item.product_id,
              productName: item.product_name,
              available: item.stock_quantity,
              requested: item.ordered_quantity,
            });

            // Notify user about sold out
            try {
              await telegramService.notifyOrderCancelled(order.buyer_telegram_id, {
                orderId: order.id,
                reason: `"${item.product_name}" sold out - refund will be processed`,
              });
            } catch (notifError) {
              logger.error('[PollingService] Failed to notify buyer', {
                error: notifError.message,
              });
            }

            return;
          }
        }

        logger.info('[PollingService] All items in stock - confirming order', {
          orderId: invoice.order_id,
          itemCount: orderItems.length,
        });
      }

      // Update order status to confirmed
      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
        'confirmed',
        invoice.order_id,
      ]);

      // Deduct stock for ALL items
      if (orderItems.length === 0) {
        // Legacy single-item: deduct from orders.product_id
        const productPreorderCheck = await client.query(
          'SELECT is_preorder FROM products WHERE id = $1',
          [order.product_id]
        );
        if (productPreorderCheck.rows.length > 0 && !productPreorderCheck.rows[0].is_preorder) {
          await productQueries.updateStock(order.product_id, -order.quantity, client);
          logger.info('[PollingService] Stock deducted for legacy single-item order', {
            orderId: invoice.order_id,
            productId: order.product_id,
            quantity: order.quantity,
          });
        }
      } else {
        // Multi-item: deduct each item
        for (const item of orderItems) {
          if (!item.is_preorder) {
            await productQueries.updateStock(item.product_id, -item.ordered_quantity, client);

            logger.info('[PollingService] Stock deducted for item', {
              orderId: invoice.order_id,
              productId: item.product_id,
              quantity: item.ordered_quantity,
            });
          }
        }
      }

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      logger.error('[PollingService] Transaction error in payment confirmation', {
        error: txError.message,
        stack: txError.stack,
      });
      throw txError;
    } finally {
      client.release();
    }

    // Get order details for notification (outside transaction - read-only)
    const order = await orderQueries.findById(invoice.order_id);

    // Read operations - get additional data for seller notification
    const [product, buyer] = await Promise.all([
      productQueries.findById(order.product_id),
      userQueries.findById(order.buyer_id),
    ]);

    // Get seller info
    const shop = await shopQueries.findById(product.shop_id);
    const seller = await userQueries.findById(shop.owner_id);

    // Notify seller about payment confirmation
    try {
      await telegramService.notifyPaymentConfirmedSeller(seller.telegram_id, {
        orderId: order.id,
        productName: product.name,
        quantity: order.quantity,
        totalPrice: order.total_price,
        currency: order.currency,
        buyerUsername: buyer.username || 'Anonymous',
        buyerTelegramId: buyer.telegram_id,
      });
    } catch (notifError) {
      logger.error('[PollingService] Seller notification error', {
        error: notifError.message,
        stack: notifError.stack,
      });
    }

    // Notify buyer via Telegram
    try {
      await telegramService.notifyPaymentConfirmed(order.buyer_telegram_id, {
        id: order.id,
        product_name: product.name,
        quantity: order.quantity,
        total_price: order.total_price,
        currency: order.currency,
        seller_username: seller.username,
        shop_name: shop.name,
      });

      logger.info('[PollingService] User notified successfully', {
        orderId: order.id,
        telegramId: order.buyer_telegram_id,
      });
    } catch (notifError) {
      logger.error('[PollingService] Failed to notify buyer:', {
        error: notifError.message,
        orderId: order.id,
      });
      // Don't throw - notification failure shouldn't fail the whole process
    }
  } catch (error) {
    logger.error('[PollingService] Failed to handle confirmed payment:', {
      error: error.message,
      invoiceId: invoice.id,
      orderId: invoice.order_id || null,
      subscriptionId: invoice.subscription_id || null,
    });
    throw error;
  }
}

/**
 * Handle confirmed subscription payment
 * @param {object} invoice - Invoice record with subscription_id
 */
async function handleSubscriptionPayment(invoice) {
  try {
    logger.info(
      `[PollingService] Processing subscription payment for subscription ${invoice.subscription_id}`
    );

    // Activate subscription via subscriptionService
    // Note: activateSubscription expects (shopId, tier, txHash, currency, expectedAddress)
    // But we need to get subscription details first
    const client = await getClient();
    try {
      // Get subscription details with FOR UPDATE lock (prevent race conditions)
      const subResult = await client.query(
        `SELECT shop_id, tier, user_id, status
         FROM shop_subscriptions
         WHERE id = $1
         FOR UPDATE`,
        [invoice.subscription_id]
      );

      if (subResult.rows.length === 0) {
        logger.error('[PollingService] Subscription not found:', {
          subscriptionId: invoice.subscription_id,
        });
        return;
      }

      const subscription = subResult.rows[0];

      // Skip if already processed (idempotency check)
      if (subscription.status === 'paid' || subscription.status === 'active') {
        logger.info('[PollingService] Subscription already processed (idempotent):', {
          subscriptionId: invoice.subscription_id,
          status: subscription.status,
        });
        return;
      }

      // If shop already exists, activate it
      if (subscription.shop_id) {
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

        // Update subscription status to 'active' AFTER shop is updated
        await client.query(
          `UPDATE shop_subscriptions
           SET status = 'active',
               verified_at = NOW(),
               period_start = $1,
               period_end = $2,
               tx_hash = COALESCE($4, tx_hash),
               currency = $5,
               amount = COALESCE($6, amount)
           WHERE id = $3`,
          [
            periodStart,
            periodEnd,
            invoice.subscription_id,
            invoice.tx_hash,
            invoice.currency,
            invoice.expected_amount,
          ]
        );

        logger.info('[PollingService] Subscription activated and shop updated', {
          subscriptionId: invoice.subscription_id,
          shopId: subscription.shop_id,
          tier: subscription.tier,
        });

        try {
          const ownerResult = await client.query(
            `SELECT s.name AS shop_name, u.telegram_id
               FROM shops s
               JOIN users u ON s.owner_id = u.id
              WHERE s.id = $1`,
            [subscription.shop_id]
          );
          const owner = ownerResult.rows[0];
          if (owner?.telegram_id) {
            await telegramService.notifySubscriptionActivated(owner.telegram_id, {
              shopName: owner.shop_name,
              tier: subscription.tier,
              nextPaymentDue: periodEnd,
            });
          }

          // ✅ Broadcast subscription payment confirmation to frontend
          broadcastService.broadcastToUser(subscription.user_id, {
            type: 'subscription_payment_confirmed',
            subscriptionId: invoice.subscription_id,
            shopId: subscription.shop_id,
            status: 'active',
            tier: subscription.tier,
          });
        } catch (notifError) {
          logger.error('[PollingService] Owner notification error', {
            error: notifError.message,
            subscriptionId: invoice.subscription_id,
          });
        }
      } else {
        // ✅ AUTO-CREATE SHOP: Prevent money loss from JWT expiration
        logger.info('[PollingService] Subscription paid, auto-creating shop', {
          subscriptionId: invoice.subscription_id,
          tier: subscription.tier,
          userId: subscription.user_id,
        });

        try {
          // Get user details
          const userResult = await client.query(
            'SELECT telegram_id, username FROM users WHERE id = $1',
            [subscription.user_id]
          );
          const user = userResult.rows[0];

          if (!user) {
            logger.error('[PollingService] User not found for subscription', {
              subscriptionId: invoice.subscription_id,
              userId: subscription.user_id,
            });
            return;
          }

          // Create shop with auto-generated name
          const shopName = `Shop_${user.username || user.telegram_id}_${Date.now()}`;
          const shopResult = await client.query(
            `INSERT INTO shops (name, owner_id, tier, subscription_status, registration_paid, is_active)
             VALUES ($1, $2, $3, 'active', true, true)
             RETURNING id, name`,
            [shopName, subscription.user_id, subscription.tier]
          );

          const newShop = shopResult.rows[0];

          logger.info('[PollingService] Shop auto-created successfully', {
            shopId: newShop.id,
            shopName: newShop.name,
            tier: subscription.tier,
          });

          // Link subscription to shop
          const periodStart = new Date();
          const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

          await client.query(
            `UPDATE shop_subscriptions
             SET shop_id = $1,
                 status = 'active',
                 period_start = $2,
                 period_end = $3,
                 tx_hash = COALESCE($5, tx_hash),
                 currency = $6,
                 amount = COALESCE($7, amount)
             WHERE id = $4`,
            [
              newShop.id,
              periodStart,
              periodEnd,
              invoice.subscription_id,
              invoice.tx_hash,
              invoice.currency,
              invoice.expected_amount,
            ]
          );

          // Update shop with payment due date
          await client.query(
            `UPDATE shops
             SET next_payment_due = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [periodEnd, newShop.id]
          );

          logger.info('[PollingService] Subscription activated with auto-created shop', {
            subscriptionId: invoice.subscription_id,
            shopId: newShop.id,
            shopName: newShop.name,
          });

          // Notify user about shop creation
          try {
            await telegramService.notifySubscriptionActivated(user.telegram_id, {
              shopName: newShop.name,
              tier: subscription.tier,
              nextPaymentDue: periodEnd,
              autoCreated: true,
            });
          } catch (notifError) {
            logger.error('[PollingService] Notification error', {
              error: notifError.message,
            });
          }

          // ✅ Broadcast subscription payment confirmation to frontend
          broadcastService.broadcastToUser(subscription.user_id, {
            type: 'subscription_payment_confirmed',
            subscriptionId: invoice.subscription_id,
            shopId: newShop.id,
            shopName: newShop.name,
            status: 'active',
            tier: subscription.tier,
            autoCreated: true,
          });
        } catch (shopCreationError) {
          logger.error('[PollingService] Shop auto-creation failed', {
            error: shopCreationError.message,
            subscriptionId: invoice.subscription_id,
            userId: subscription.user_id,
          });

          // Notify admin about failure (critical - money was paid!)
          try {
            await telegramService.notifyAdminError({
              type: 'shop_creation_failed',
              subscriptionId: invoice.subscription_id,
              userId: subscription.user_id,
              error: shopCreationError.message,
            });
          } catch (adminNotifError) {
            logger.error('[PollingService] Admin notification failed', {
              error: adminNotifError.message,
            });
          }
        }
      }
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('[PollingService] Failed to handle subscription payment:', {
      error: error.message,
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription_id,
    });
    throw error;
  }
}

/**
 * Handle expired invoices - mark as expired
 */
async function handleExpiredInvoices() {
  try {
    const expiredInvoices = await invoiceQueries.findExpired();

    if (expiredInvoices.length === 0) {
      return;
    }

    logger.info(`[PollingService] Found ${expiredInvoices.length} expired invoices`);

    for (const invoice of expiredInvoices) {
      await invoiceQueries.updateStatus(invoice.id, 'expired');

      // Update order status to 'cancelled' (only for order invoices)
      if (invoice.order_id) {
        await orderQueries.updateStatus(invoice.order_id, 'cancelled');
      }

      // For subscription invoices, mark subscription as cancelled (constraint doesn't allow 'failed')
      if (invoice.subscription_id) {
        const client = await getClient();
        try {
          await client.query(`UPDATE shop_subscriptions SET status = 'cancelled' WHERE id = $1`, [
            invoice.subscription_id,
          ]);
          logger.info('[PollingService] Subscription cancelled due to expired invoice:', {
            subscriptionId: invoice.subscription_id,
            invoiceId: invoice.id,
          });
        } finally {
          client.release();
        }
      }

      logger.info('[PollingService] Invoice expired:', {
        invoiceId: invoice.id,
        orderId: invoice.order_id || null,
        subscriptionId: invoice.subscription_id || null,
      });
    }
  } catch (error) {
    logger.error('[PollingService] Failed to handle expired invoices:', {
      error: error.message,
    });
  }
}

/**
 * Manually trigger a poll (for testing or admin purposes)
 * @returns {Promise<object>} Poll results
 */
export async function manualPoll() {
  logger.info('[PollingService] Manual poll triggered');

  const before = { ...stats };

  await checkPendingPayments();

  const after = { ...stats };

  return {
    before,
    after,
    processed: after.pollCount - before.pollCount,
    found: after.paymentsFound - before.paymentsFound,
    confirmed: after.paymentsConfirmed - before.paymentsConfirmed,
  };
}

// Exported for manual/explicit confirmations (API/script reuse)
export { handleSubscriptionPayment };

export default {
  startPolling,
  stopPolling,
  getStats,
  resetStats,
  manualPoll,
  handleSubscriptionPayment,
};
