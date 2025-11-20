import {
  paymentQueries,
  orderQueries,
  productQueries,
  shopQueries,
  userQueries,
  orderItemQueries,
  invoiceQueries,
} from '../database/queries/index.js';
import { getClient } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors.js';
import paymentVerificationService from '../services/paymentVerificationService.js';
import telegramService from '../services/telegram.js';
import logger from '../utils/logger.js';
import { amountsMatchWithTolerance } from '../utils/paymentTolerance.js';
import QRCode from 'qrcode';

/**
 * Payment Controller
 */
export const paymentController = {
  /**
   * Verify crypto payment
   */
  verify: asyncHandler(async (req, res) => {
    const client = await getClient();

    try {
      const { orderId, txHash, currency, paymentLink, txLink, transactionUrl } = req.body;

      // ✅ FIX #1: BEGIN transaction FIRST with SERIALIZABLE isolation
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Get order with lock
      const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [
        orderId,
      ]);
      const order = orderResult.rows[0];

      if (!order) {
        await client.query('ROLLBACK');
        throw new NotFoundError('Order');
      }

      // Check if order belongs to user
      if (order.buyer_id !== req.user.id) {
        await client.query('ROLLBACK');
        throw new UnauthorizedError('Access denied');
      }

      // Check order status - only pending orders can be paid
      if (order.status !== 'pending') {
        await client.query('ROLLBACK');
        throw new ValidationError(`Cannot pay for order with status: ${order.status}. Only pending orders can be paid.`);
      }

      // ✅ FIX #1: Check tx_hash INSIDE transaction with FOR UPDATE lock
      const existingTx = await client.query(
        'SELECT * FROM payments WHERE tx_hash = $1 FOR UPDATE',
        [txHash]
      );

      if (existingTx.rows.length > 0) {
        const existingPayment = existingTx.rows[0];

        // Check if TX used for DIFFERENT order (double-spending)
        if (existingPayment.order_id && existingPayment.order_id !== orderId) {
          await client.query('ROLLBACK');
          logger.error('TX reuse attempt detected', {
            txHash,
            existingOrderId: existingPayment.order_id,
            attemptedOrderId: orderId,
          });

          return res.status(400).json({
            success: false,
            error: 'This transaction was already used for a different order',
            code: 'TX_ALREADY_USED',
          });
        }

        // If same order, allow (idempotency)
        if (existingPayment.order_id === orderId) {
          await client.query('ROLLBACK');
          logger.info('Idempotent payment verification request', { txHash, orderId });
          return res.json({
            success: true,
            message: 'Payment already processed',
            data: {
              payment: existingPayment,
              verification: {
                verified: true,
                status: existingPayment.status,
              },
            },
          });
        }
      }

      // ✅ FIX #1: Check if order already paid with FOR UPDATE lock
      const orderPayments = await client.query(
        `SELECT id FROM payments 
         WHERE order_id = $1 AND status = 'confirmed'
         FOR UPDATE`,
        [orderId]
      );

      if (orderPayments.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Order already paid',
        });
      }

      // Get product and shop to retrieve seller's wallet address
      const product = await productQueries.findById(order.product_id);
      if (!product) {
        await client.query('ROLLBACK');
        throw new NotFoundError('Product');
      }

      const shop = await shopQueries.findById(product.shop_id);
      if (!shop) {
        await client.query('ROLLBACK');
        throw new NotFoundError('Shop');
      }

      // Figure out payment context (invoice-aware)
      const normalizedCurrency = (currency || order.currency || 'USDT').toUpperCase();

      // Use latest invoice if it exists to enforce address/amount
      let activeInvoice = null;
      try {
        const invoiceResult = await client.query(
          'SELECT * FROM invoices WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
          [orderId]
        );
        activeInvoice = invoiceResult.rows[0] || null;
      } catch (invoiceError) {
        logger.warn('Invoice lookup failed', {
          orderId,
          error: invoiceError.message,
        });
      }

      const paymentCurrency = (activeInvoice?.currency || normalizedCurrency).toUpperCase();
      const chainHint = activeInvoice?.chain || null;
      const expectedAmount = activeInvoice?.crypto_amount
        ? parseFloat(activeInvoice.crypto_amount)
        : parseFloat(order.total_price);

      // Get seller's wallet address for the currency (fallback when no invoice address)
      const walletField = `wallet_${paymentCurrency.toLowerCase()}`;
      const sellerAddress = shop[walletField];
      const targetAddress = activeInvoice?.address || sellerAddress;

      if (!targetAddress) {
        throw new ValidationError(`Seller has not configured ${paymentCurrency} wallet`);
      }

      // ✅ FIX #6: Check invoice not reused for different order
      const invoiceCheck = await client.query(
        `SELECT id, order_id FROM invoices
         WHERE address = $1 AND order_id != $2 FOR UPDATE`,
        [targetAddress, orderId]
      );

      if (invoiceCheck.rows.length > 0) {
        await client.query('ROLLBACK');

        logger.error('Invoice address reuse detected', {
          txHash,
          orderId,
          conflictingOrderId: invoiceCheck.rows[0].order_id,
          address: targetAddress,
        });

        return res.status(400).json({
          success: false,
          error: 'This payment address is already associated with another order',
          code: 'INVOICE_REUSE',
        });
      }

      // Verify payment with unified verifier (supports hash OR explorer link + address scan)
      const verification = await paymentVerificationService.verifyIncomingPayment({
        txHash,
        paymentLink: paymentLink || txLink || transactionUrl,
        address: targetAddress,
        amount: expectedAmount,
        currency: paymentCurrency,
        chain: chainHint,
      });

      if (!verification.verified) {
        await client.query('ROLLBACK');

        const failedTxHash = verification.txHash || txHash;

        // Save failed attempt if we have a hash to prevent reuse
        if (failedTxHash) {
          await paymentQueries.create({
            orderId,
            txHash: failedTxHash,
            amount: expectedAmount,
            currency: paymentCurrency,
            status: 'failed',
          });
        }

        return res.status(400).json({
          success: false,
          error: verification.error || 'Payment verification failed',
          code: verification.code || 'PAYMENT_NOT_VERIFIED',
        });
      }

      const verifiedTxHash = verification.txHash || txHash;

      // Extra safety: tolerance check on top of verifier
      if (
        !amountsMatchWithTolerance(
          verification.amount,
          expectedAmount,
          undefined,
          paymentCurrency
        )
      ) {
        await client.query('ROLLBACK');

        logger.error('Payment amount mismatch', {
          orderId,
          txHash: verifiedTxHash,
          expected: expectedAmount,
          received: verification.amount,
        });

        return res.status(400).json({
          success: false,
          error: `Payment amount insufficient. Expected ${expectedAmount}, received ${verification.amount}`,
          code: 'AMOUNT_MISMATCH',
        });
      }

      // Align invoice state with verification result
      if (activeInvoice?.id) {
        await client.query(
          `UPDATE invoices
           SET status = $1,
               tx_hash = COALESCE($3, tx_hash),
               paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END,
               updated_at = NOW()
           WHERE id = $2`,
          [verification.status === 'confirmed' ? 'paid' : verification.status, activeInvoice.id, verifiedTxHash]
        );
      }

      let payment;

      // If payment is confirmed, use transaction for atomicity
      if (verification.status === 'confirmed') {
        // Create payment record inside transaction (use existing client)
        payment = await paymentQueries.create(
          {
            orderId,
            txHash: verifiedTxHash,
            amount: expectedAmount,
            currency: paymentCurrency,
            status: verification.status,
          },
          client
        );

        // Update payment with confirmations if available
        if (verification.confirmations) {
          await client.query(
            `UPDATE payments SET confirmations = $1, updated_at = NOW() WHERE id = $2`,
            [verification.confirmations, payment.id]
          );
        }

        // ✅ БАГ #4 FIX: Check invoice expiry
        const invoiceResult = await client.query(
          'SELECT id, expires_at FROM invoices WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
          [orderId]
        );

        if (invoiceResult.rows.length > 0) {
          const invoiceRow = invoiceResult.rows[0];
          const now = new Date();
          const expiresAt = new Date(invoiceRow.expires_at);

          if (now > expiresAt) {
            await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
              'cancelled',
              orderId,
            ]);
            await client.query('COMMIT');

            logger.warn('Invoice expired - order cancelled', {
              orderId,
              invoiceId: invoiceRow.id,
              expiresAt: invoiceRow.expires_at,
              currentTime: now.toISOString(),
              expiredAgo: Math.round((now - expiresAt) / 1000 / 60),
            });

            return res.status(400).json({
              success: false,
              error: 'Payment window expired. Please create a new order.',
              code: 'INVOICE_EXPIRED',
            });
          }

          logger.info('Invoice valid - within expiry window', {
            orderId,
            expiresAt: invoiceRow.expires_at,
            remainingMinutes: Math.round((expiresAt - now) / 1000 / 60),
          });
        }

        // ✅ FIX #4: Lock products BEFORE checking stock
        const orderItems = await orderItemQueries.findByOrderIdWithStock(orderId, client);

        const productIds = orderItems.map((item) => item.product_id).filter(Boolean);

        if (productIds.length > 0) {
          await client.query(
            `SELECT id FROM products 
               WHERE id = ANY($1::int[])
               FOR UPDATE`,
            [productIds]
          );

          logger.info('Products locked for stock check', {
            orderId,
            productIds,
          });
        }

        // Re-check stock AFTER lock (fresh data)
        if (orderItems.length === 0) {
          // Fallback: legacy single-item order (backward compatibility)
          logger.warn('No order_items found - assuming legacy single-item order', {
            orderId,
          });

          // Check if product and shop still exist (legacy check)
          const productShopCheck = await client.query(
            `SELECT p.stock_quantity, p.is_preorder, p.name as product_name,
                      s.id as shop_id, s.name as shop_name
               FROM products p
               LEFT JOIN shops s ON p.shop_id = s.id
               WHERE p.id = $1`,
            [order.product_id]
          );

          if (productShopCheck.rows.length === 0 || !productShopCheck.rows[0].shop_id) {
            // Product or shop deleted - cancel order
            await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
              'cancelled',
              orderId,
            ]);
            await client.query('COMMIT');

            logger.warn('Payment confirmed but product/shop deleted - order cancelled', {
              orderId,
              productDeleted: productShopCheck.rows.length === 0,
              shopDeleted: productShopCheck.rows.length > 0 && !productShopCheck.rows[0].shop_id,
            });

            return res.status(400).json({
              success: false,
              error: 'This product is no longer available. Order cancelled.',
              code: 'PRODUCT_UNAVAILABLE',
            });
          }

          const currentProduct = productShopCheck.rows[0];

          // Skip stock check for preorder products
          if (currentProduct.is_preorder) {
            logger.info('Preorder product - skipping stock check', {
              orderId,
              productId: order.product_id,
            });
          } else if (currentProduct.stock_quantity < order.quantity) {
            // Stock insufficient - cancel order
            await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
              'cancelled',
              orderId,
            ]);
            await client.query('COMMIT');

            logger.warn('Payment confirmed but stock insufficient - order cancelled', {
              orderId,
              productId: order.product_id,
              stockAvailable: currentProduct.stock_quantity,
              quantityNeeded: order.quantity,
            });

            return res.status(400).json({
              success: false,
              error: 'Sorry, this product is sold out. Your payment will be refunded.',
              code: 'STOCK_INSUFFICIENT',
            });
          }
        } else {
          // Multi-item order - validate ALL products
          logger.info('Validating multi-item order', {
            orderId,
            itemCount: orderItems.length,
          });

          for (const item of orderItems) {
            // Check if product/shop deleted
            if (!item.product_id || !item.shop_id) {
              await client.query(
                'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                ['cancelled', orderId]
              );
              await client.query('COMMIT');

              logger.warn('Product/shop deleted in multi-item order - cancelled', {
                orderId,
                itemId: item.item_id,
                productDeleted: !item.product_id,
                shopDeleted: !item.shop_id,
              });

              return res.status(400).json({
                success: false,
                error: 'One or more products are no longer available. Order cancelled.',
                code: 'PRODUCT_UNAVAILABLE',
              });
            }

            // Skip stock check for preorder products
            if (item.is_preorder) {
              logger.info('Preorder item - skipping stock check', {
                orderId,
                productId: item.product_id,
                productName: item.product_name,
              });
              continue;
            }

            // Check stock availability
            if (item.stock_quantity < item.ordered_quantity) {
              await client.query(
                'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                ['cancelled', orderId]
              );
              await client.query('COMMIT');

              logger.warn('Insufficient stock in multi-item order - cancelled', {
                orderId,
                productId: item.product_id,
                productName: item.product_name,
                available: item.stock_quantity,
                requested: item.ordered_quantity,
              });

              return res.status(400).json({
                success: false,
                error: `Sorry, "${item.product_name}" is sold out. Your payment will be refunded.`,
                code: 'STOCK_INSUFFICIENT',
              });
            }
          }

          logger.info('All items in stock - confirming order', {
            orderId,
            itemCount: orderItems.length,
          });
        }

        // Update order status to confirmed
        await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
          'confirmed',
          orderId,
        ]);

        // Deduct stock for ALL items
        if (orderItems.length === 0) {
          // Legacy single-item: deduct from orders.product_id
          const productShopCheck = await client.query(
            'SELECT is_preorder FROM products WHERE id = $1',
            [order.product_id]
          );
          if (productShopCheck.rows.length > 0 && !productShopCheck.rows[0].is_preorder) {
            await productQueries.updateStock(order.product_id, -order.quantity, client);
            logger.info('Stock deducted for legacy single-item order', {
              orderId,
              productId: order.product_id,
              quantity: order.quantity,
            });
          }
        } else {
          // Multi-item: deduct each item
          for (const item of orderItems) {
            if (!item.is_preorder) {
              await productQueries.updateStock(item.product_id, -item.ordered_quantity, client);

              logger.info('Stock deducted for item', {
                orderId,
                productId: item.product_id,
                quantity: item.ordered_quantity,
              });
            }
          }
        }

        // Commit transaction
        await client.query('COMMIT');

        // Read operations (outside transaction - read-only)
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
          logger.error('Seller notification error', {
            error: notifError.message,
            stack: notifError.stack,
          });
        }

        // Notify buyer
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
        } catch (notifError) {
          logger.error('Buyer notification error', {
            error: notifError.message,
            stack: notifError.stack,
          });
        }
      } else {
        // Payment not confirmed yet - create pending payment and commit
        payment = await paymentQueries.create(
          {
            orderId,
            txHash: verifiedTxHash,
            amount: expectedAmount,
            currency: paymentCurrency,
            status: verification.status,
          },
          client
        );

        // Update payment with confirmations
        if (verification.confirmations) {
          await client.query(
            `UPDATE payments SET confirmations = $1, updated_at = NOW() WHERE id = $2`,
            [verification.confirmations, payment.id]
          );
        }

        // Commit transaction
        await client.query('COMMIT');
      }

      return res.status(200).json({
        success: true,
        data: {
          payment,
          verification: {
            verified: verification.verified,
            confirmations: verification.confirmations,
            status: verification.status,
          },
        },
      });
    } catch (error) {
      // Rollback on any error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Rollback error in verify', { error: rollbackError.message });
      }

      logger.error('Verify payment error', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      client.release();
    }
  }),


  /**
   * Get payment by order ID
   */
  getByOrder: asyncHandler(async (req, res) => {
    try {
      const { orderId } = req.params;

      // Get order to check access
      const order = await orderQueries.findById(orderId);

      if (!order) {
        throw new NotFoundError('Order');
      }

      // Check if user has access (buyer or seller)
      const isBuyer = order.buyer_id === req.user.id;

      // Get seller ID through product → shop → owner
      let isSeller = false;
      if (!isBuyer) {
        const product = await productQueries.findById(order.product_id);
        if (product) {
          const shop = await shopQueries.findById(product.shop_id);
          isSeller = shop && shop.owner_id === req.user.id;
        }
      }

      if (!isBuyer && !isSeller) {
        throw new UnauthorizedError('Access denied');
      }

      const payments = await paymentQueries.findByOrderId(orderId);

      return res.status(200).json({
        success: true,
        data: payments,
      });
    } catch (error) {
      logger.error('Get payment error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),


  /**
   * Check payment status (for polling)
  */
  checkStatus: asyncHandler(async (req, res) => {
    try {
      const { txHash, paymentLink, txLink, transactionUrl } = req.query;

      if (!txHash) {
        throw new ValidationError('Transaction hash required');
      }

      const payment = await paymentQueries.findByTxHash(txHash);

      if (!payment) {
        throw new NotFoundError('Payment');
      }

      // Get order to check access
      const order = await orderQueries.findById(payment.order_id);

      // Get product and shop (needed for both access check and wallet address)
      const product = await productQueries.findById(order.product_id);
      if (!product) {
        throw new NotFoundError('Product');
      }

      const shop = await shopQueries.findById(product.shop_id);
      if (!shop) {
        throw new NotFoundError('Shop');
      }

      // Check if user has access (buyer or seller)
      const isBuyer = order.buyer_id === req.user.id;
      const isSeller = shop.owner_id === req.user.id;

      if (!isBuyer && !isSeller) {
        throw new UnauthorizedError('Access denied');
      }

      // If payment is still pending, check blockchain again
      if (payment.status === 'pending') {
        const invoice = await invoiceQueries.findByOrderId(order.id);
        const paymentCurrency = (invoice?.currency || payment.currency || order.currency).toUpperCase();
        const chainHint = invoice?.chain || null;
        const expectedAmount = invoice?.crypto_amount
          ? parseFloat(invoice.crypto_amount)
          : parseFloat(order.total_price);

        const walletField = `wallet_${paymentCurrency.toLowerCase()}`;
        const sellerAddress = invoice?.address || shop[walletField];

        if (!sellerAddress) {
          throw new ValidationError(`Seller has not configured ${paymentCurrency} wallet`);
        }

        const verification = await paymentVerificationService.verifyIncomingPayment({
          txHash: payment.tx_hash,
          paymentLink: req.query.paymentLink || req.query.txLink || req.query.transactionUrl,
          address: sellerAddress,
          amount: expectedAmount,
          currency: paymentCurrency,
          chain: chainHint,
        });

        if (!verification.verified) {
          throw new ValidationError(verification.error || 'Payment verification failed');
        }

        // ✅ FIX #3: Verify amount matches order total (checkStatus) with tolerance
        if (
          !amountsMatchWithTolerance(
            verification.amount,
            expectedAmount,
            undefined,
            paymentCurrency
          )
        ) {
          logger.error('Payment amount mismatch (checkStatus)', {
            orderId: order.id,
            txHash: payment.tx_hash,
            expected: expectedAmount,
            received: verification.amount,
            shortage: expectedAmount - verification.amount,
          });

          return res.status(400).json({
            success: false,
            error: `Payment amount insufficient. Expected ${expectedAmount}, received ${verification.amount}`,
            code: 'AMOUNT_MISMATCH',
          });
        }

        if (verification.status === 'confirmed') {
          // CRITICAL: Use transaction for atomicity (payment + order status updates)
          const client = await getClient();
          try {
            await client.query('BEGIN');

            // Update payment status
            await client.query(
              `UPDATE payments SET status = $1, confirmations = $2, updated_at = NOW() WHERE id = $3`,
              ['confirmed', verification.confirmations, payment.id]
            );

            // Sync invoice state with payment confirmation
            if (invoice?.id) {
              await client.query(
                `UPDATE invoices
                 SET status = 'paid',
                     tx_hash = COALESCE($2, tx_hash),
                     paid_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $1`,
                [invoice.id, payment.tx_hash]
              );
            }

            // ✅ БАГ #4 FIX: Check invoice expiry
            const invoiceResult = await client.query(
              'SELECT id, expires_at FROM invoices WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
              [order.id]
            );

            if (invoiceResult.rows.length > 0) {
              const invoiceRow = invoiceResult.rows[0];
              const now = new Date();
              const expiresAt = new Date(invoiceRow.expires_at);

              if (now > expiresAt) {
                await client.query(
                  'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                  ['cancelled', order.id]
                );
                await client.query('COMMIT');

                logger.warn('Invoice expired - order cancelled (checkStatus)', {
                  orderId: order.id,
                  invoiceId: invoiceRow.id,
                  expiresAt: invoiceRow.expires_at,
                  currentTime: now.toISOString(),
                  expiredAgo: Math.round((now - expiresAt) / 1000 / 60),
                });

                // Update in-memory payment object
                payment.status = 'confirmed';
                payment.confirmations = verification.confirmations;

                return res.status(400).json({
                  success: false,
                  error: 'Payment window expired. Please create a new order.',
                  code: 'INVOICE_EXPIRED',
                });
              }

              logger.info('Invoice valid - within expiry window (checkStatus)', {
                orderId: order.id,
                expiresAt: invoiceRow.expires_at,
                remainingMinutes: Math.round((expiresAt - now) / 1000 / 60),
              });
            }

            // ✅ FIX #4: Lock products BEFORE checking stock (checkStatus)
            const orderItems = await orderItemQueries.findByOrderIdWithStock(order.id, client);

            const productIds = orderItems.map((item) => item.product_id).filter(Boolean);

            if (productIds.length > 0) {
              await client.query(
                `SELECT id FROM products 
                 WHERE id = ANY($1::int[])
                 FOR UPDATE`,
                [productIds]
              );

              logger.info('Products locked for stock check (checkStatus)', {
                orderId: order.id,
                productIds,
              });
            }

            // Re-check stock AFTER lock
            if (orderItems.length === 0) {
              // Fallback: legacy single-item order (backward compatibility)
              logger.warn(
                'No order_items found - assuming legacy single-item order (checkStatus)',
                {
                  orderId: order.id,
                }
              );

              // Check if product and shop still exist (legacy check)
              const productShopCheck = await client.query(
                `SELECT p.stock_quantity, p.is_preorder, p.name as product_name,
                        s.id as shop_id, s.name as shop_name
                 FROM products p
                 LEFT JOIN shops s ON p.shop_id = s.id
                 WHERE p.id = $1`,
                [order.product_id]
              );

              if (productShopCheck.rows.length === 0 || !productShopCheck.rows[0].shop_id) {
                // Product or shop deleted - cancel order
                await client.query(
                  'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                  ['cancelled', order.id]
                );
                await client.query('COMMIT');

                logger.warn(
                  'Payment confirmed but product/shop deleted - order cancelled (checkStatus)',
                  {
                    orderId: order.id,
                    productDeleted: productShopCheck.rows.length === 0,
                    shopDeleted:
                      productShopCheck.rows.length > 0 && !productShopCheck.rows[0].shop_id,
                  }
                );

                // Update in-memory payment object
                payment.status = 'confirmed';
                payment.confirmations = verification.confirmations;

                // Return with error
                return res.status(400).json({
                  success: false,
                  error: 'This product is no longer available. Order cancelled.',
                  code: 'PRODUCT_UNAVAILABLE',
                });
              }

              const currentProduct = productShopCheck.rows[0];

              // Skip stock check for preorder products
              if (currentProduct.is_preorder) {
                logger.info('Preorder product - skipping stock check in checkStatus', {
                  orderId: order.id,
                  productId: order.product_id,
                });
              } else if (currentProduct.stock_quantity < order.quantity) {
                // Stock insufficient - cancel order
                await client.query(
                  'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                  ['cancelled', order.id]
                );
                await client.query('COMMIT');

                logger.warn(
                  'Payment confirmed but stock insufficient - order cancelled (checkStatus)',
                  {
                    orderId: order.id,
                    productId: order.product_id,
                    stockAvailable: currentProduct.stock_quantity,
                    quantityNeeded: order.quantity,
                  }
                );

                // Update in-memory payment object
                payment.status = 'confirmed';
                payment.confirmations = verification.confirmations;

                // Return with warning
                return res.status(200).json({
                  success: true,
                  data: payment,
                  warning: 'Product sold out - order cancelled, refund will be processed',
                });
              }
            } else {
              // Multi-item order - validate ALL products
              logger.info('Validating multi-item order (checkStatus)', {
                orderId: order.id,
                itemCount: orderItems.length,
              });

              for (const item of orderItems) {
                // Check if product/shop deleted
                if (!item.product_id || !item.shop_id) {
                  await client.query(
                    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                    ['cancelled', order.id]
                  );
                  await client.query('COMMIT');

                  logger.warn(
                    'Product/shop deleted in multi-item order - cancelled (checkStatus)',
                    {
                      orderId: order.id,
                      itemId: item.item_id,
                      productDeleted: !item.product_id,
                      shopDeleted: !item.shop_id,
                    }
                  );

                  // Update in-memory payment object
                  payment.status = 'confirmed';
                  payment.confirmations = verification.confirmations;

                  return res.status(400).json({
                    success: false,
                    error: 'One or more products are no longer available. Order cancelled.',
                    code: 'PRODUCT_UNAVAILABLE',
                  });
                }

                // Skip stock check for preorder products
                if (item.is_preorder) {
                  logger.info('Preorder item - skipping stock check (checkStatus)', {
                    orderId: order.id,
                    productId: item.product_id,
                    productName: item.product_name,
                  });
                  continue;
                }

                // Check stock availability
                if (item.stock_quantity < item.ordered_quantity) {
                  await client.query(
                    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                    ['cancelled', order.id]
                  );
                  await client.query('COMMIT');

                  logger.warn('Insufficient stock in multi-item order - cancelled (checkStatus)', {
                    orderId: order.id,
                    productId: item.product_id,
                    productName: item.product_name,
                    available: item.stock_quantity,
                    requested: item.ordered_quantity,
                  });

                  // Update in-memory payment object
                  payment.status = 'confirmed';
                  payment.confirmations = verification.confirmations;

                  return res.status(200).json({
                    success: true,
                    data: payment,
                    warning: `"${item.product_name}" sold out - order cancelled, refund will be processed`,
                  });
                }
              }

              logger.info('All items in stock - confirming order (checkStatus)', {
                orderId: order.id,
                itemCount: orderItems.length,
              });
            }

            // Update order status to confirmed
            await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
              'confirmed',
              order.id,
            ]);

            // Deduct stock for ALL items
            if (orderItems.length === 0) {
              // Legacy single-item: deduct from orders.product_id
              const productPreorderCheck = await client.query(
                'SELECT is_preorder FROM products WHERE id = $1',
                [order.product_id]
              );
              if (
                productPreorderCheck.rows.length > 0 &&
                !productPreorderCheck.rows[0].is_preorder
              ) {
                await productQueries.updateStock(order.product_id, -order.quantity, client);
                logger.info('Stock deducted for legacy single-item order (checkStatus)', {
                  orderId: order.id,
                  productId: order.product_id,
                  quantity: order.quantity,
                });
              }
            } else {
              // Multi-item: deduct each item
              for (const item of orderItems) {
                if (!item.is_preorder) {
                  await productQueries.updateStock(item.product_id, -item.ordered_quantity, client);

                  logger.info('Stock deducted for item (checkStatus)', {
                    orderId: order.id,
                    productId: item.product_id,
                    quantity: item.ordered_quantity,
                  });
                }
              }
            }

            await client.query('COMMIT');

            // Update in-memory payment object
            payment.status = 'confirmed';
            payment.confirmations = verification.confirmations;
          } catch (txError) {
            await client.query('ROLLBACK');
            logger.error('Transaction error in checkStatus', {
              error: txError.message,
              stack: txError.stack,
            });
            throw txError;
          } finally {
            client.release();
          }

          // Read operations (outside transaction - read-only)
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
            logger.error('Seller notification error in checkStatus', {
              error: notifError.message,
              stack: notifError.stack,
            });
          }

          // Notify buyer
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
          } catch (notifError) {
            logger.error('Buyer notification error in checkStatus', {
              error: notifError.message,
              stack: notifError.stack,
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      logger.error('Check payment status error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),


  /**
   * Generate QR code for payment
   */
  generateQR: asyncHandler(async (req, res) => {
    try {
      const { address, amount, currency } = req.body;

      // Validate inputs (explicit checks to avoid falsy issues with amount: 0)
      if (!address || amount === undefined || amount === null || !currency) {
        throw new ValidationError('Missing required fields: address, amount, currency');
      }

      // Validate amount is positive number
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new ValidationError('Amount must be a positive number greater than 0');
      }

      // Validate currency
      const supportedCurrencies = ['BTC', 'ETH', 'USDT', 'LTC'];
      if (!supportedCurrencies.includes(currency.toUpperCase())) {
        throw new ValidationError(`Unsupported currency. Supported: ${supportedCurrencies.join(', ')}`);
      }

      // Generate payment URI based on currency standard
      let paymentURI;
      switch (currency.toUpperCase()) {
        case 'BTC':
          // BIP-21: bitcoin:address?amount=X
          paymentURI = `bitcoin:${address}?amount=${amount}`;
          break;
        case 'ETH':
          // EIP-681: ethereum:address?value=X (value in wei)
          paymentURI = `ethereum:${address}?value=${amount}`;
          break;
        case 'USDT':
          // TRC-20 Tron format
          // TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t is USDT contract on Tron
          paymentURI = `tronlink://send?token=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&to=${address}&amount=${amount}`;
          break;
        case 'LTC':
          // BIP-21: litecoin:address?amount=X
          paymentURI = `litecoin:${address}?amount=${amount}`;
          break;
      }

      logger.info('Generating QR code', {
        currency,
        addressPrefix: address.substring(0, 10),
        amount,
      });

      // Generate QR code as data URL
      const qrDataURL = await QRCode.toDataURL(paymentURI, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 512,
        margin: 2,
      });

      return res.status(200).json({
        success: true,
        data: {
          qrCode: qrDataURL,
          paymentURI,
          address,
          amount,
          currency,
        },
      });
    } catch (error) {
      logger.error('QR generation error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),
};

export default paymentController;
