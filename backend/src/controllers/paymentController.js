import { paymentQueries, orderQueries, productQueries, shopQueries, userQueries, orderItemQueries, invoiceQueries } from '../models/db.js';
import { getClient } from '../config/database.js';
import cryptoService from '../services/crypto.js';
import telegramService from '../services/telegram.js';
import logger from '../utils/logger.js';
import QRCode from 'qrcode';

/**
 * Payment Controller
 */
export const paymentController = {
  /**
   * Verify crypto payment
   */
  verify: async (req, res) => {
    const client = await getClient();
    
    try {
      const { orderId, txHash, currency } = req.body;

      // ✅ FIX #1: BEGIN transaction FIRST with SERIALIZABLE isolation
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

      // Get order with lock
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );
      const order = orderResult.rows[0];

      if (!order) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Check if order belongs to user
      if (order.buyer_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Check order status - only pending orders can be paid
      if (order.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Cannot pay for order with status: ${order.status}. Only pending orders can be paid.`
        });
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
            attemptedOrderId: orderId
          });
          
          return res.status(400).json({
            success: false,
            error: 'This transaction was already used for a different order',
            code: 'TX_ALREADY_USED'
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
                status: existingPayment.status
              }
            }
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
          error: 'Order already paid'
        });
      }

      // Get product and shop to retrieve seller's wallet address
      const product = await productQueries.findById(order.product_id);
      if (!product) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      const shop = await shopQueries.findById(product.shop_id);
      if (!shop) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Get seller's wallet address for the currency
      const walletField = `wallet_${currency.toLowerCase()}`;
      const sellerAddress = shop[walletField];

      if (!sellerAddress) {
        return res.status(400).json({
          success: false,
          error: `Seller has not configured ${currency} wallet`
        });
      }

      // ✅ FIX #6: Check invoice not reused for different order
      const invoiceCheck = await client.query(
        `SELECT id, order_id FROM invoices 
         WHERE address = $1 AND order_id != $2`,
        [sellerAddress, orderId]
      );

      if (invoiceCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        
        logger.error('Invoice address reuse detected', {
          txHash,
          orderId,
          conflictingOrderId: invoiceCheck.rows[0].order_id,
          address: sellerAddress
        });
        
        return res.status(400).json({
          success: false,
          error: 'This payment address is already associated with another order',
          code: 'INVOICE_REUSE'
        });
      }

      // Verify payment with blockchain using seller's address
      const verification = await cryptoService.verifyTransaction(
        txHash,
        sellerAddress,
        order.total_price,
        currency
      );

      if (!verification.verified) {
        await client.query('ROLLBACK');
        
        // Create failed payment record (outside transaction)
        await paymentQueries.create({
          orderId,
          txHash,
          amount: order.total_price,
          currency,
          status: 'failed'
        });

        return res.status(400).json({
          success: false,
          error: verification.error || 'Payment verification failed'
        });
      }

      // ✅ FIX #3: Verify amount matches order total
      if (verification.amount < parseFloat(order.total_price)) {
        await client.query('ROLLBACK');
        
        logger.error('Payment amount mismatch', {
          orderId,
          txHash,
          expected: order.total_price,
          received: verification.amount,
          shortage: parseFloat(order.total_price) - verification.amount
        });
        
        return res.status(400).json({
          success: false,
          error: `Payment amount insufficient. Expected ${order.total_price}, received ${verification.amount}`,
          code: 'AMOUNT_MISMATCH'
        });
      }

      let payment;

      // If payment is confirmed, use transaction for atomicity
      if (verification.status === 'confirmed') {
        // Create payment record inside transaction (use existing client)
        payment = await paymentQueries.create({
          orderId,
          txHash,
          amount: order.total_price,  // ✅ FIX #3: Use order.total_price, NOT verification.amount
          currency,
          status: verification.status
        }, client);

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
            const invoice = invoiceResult.rows[0];
            const now = new Date();
            const expiresAt = new Date(invoice.expires_at);
            
            if (now > expiresAt) {
              await client.query(
                'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                ['cancelled', orderId]
              );
              await client.query('COMMIT');
              
              logger.warn('Invoice expired - order cancelled', {
                orderId,
                invoiceId: invoice.id,
                expiresAt: invoice.expires_at,
                currentTime: now.toISOString(),
                expiredAgo: Math.round((now - expiresAt) / 1000 / 60)
              });
              
              return res.status(400).json({
                success: false,
                error: 'Payment window expired. Please create a new order.',
                code: 'INVOICE_EXPIRED'
              });
            }
            
            logger.info('Invoice valid - within expiry window', {
              orderId,
              expiresAt: invoice.expires_at,
              remainingMinutes: Math.round((expiresAt - now) / 1000 / 60)
            });
          }

          // ✅ FIX #4: Lock products BEFORE checking stock
          const orderItems = await orderItemQueries.findByOrderIdWithStock(orderId, client);
          
          const productIds = orderItems.map(item => item.product_id).filter(Boolean);
          
          if (productIds.length > 0) {
            await client.query(
              `SELECT id FROM products 
               WHERE id = ANY($1::int[])
               FOR UPDATE`,
              [productIds]
            );
            
            logger.info('Products locked for stock check', {
              orderId,
              productIds
            });
          }
          
          // Re-check stock AFTER lock (fresh data)
          if (orderItems.length === 0) {
            // Fallback: legacy single-item order (backward compatibility)
            logger.warn('No order_items found - assuming legacy single-item order', {
              orderId
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
              await client.query(
                'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                ['cancelled', orderId]
              );
              await client.query('COMMIT');
              
              logger.warn('Payment confirmed but product/shop deleted - order cancelled', {
                orderId,
                productDeleted: productShopCheck.rows.length === 0,
                shopDeleted: productShopCheck.rows.length > 0 && !productShopCheck.rows[0].shop_id
              });
              
              return res.status(400).json({
                success: false,
                error: 'This product is no longer available. Order cancelled.',
                code: 'PRODUCT_UNAVAILABLE'
              });
            }
            
            const currentProduct = productShopCheck.rows[0];
            
            // Skip stock check for preorder products
            if (currentProduct.is_preorder) {
              logger.info('Preorder product - skipping stock check', {
                orderId,
                productId: order.product_id
              });
            } else if (currentProduct.stock_quantity < order.quantity) {
              // Stock insufficient - cancel order
              await client.query(
                'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                ['cancelled', orderId]
              );
              await client.query('COMMIT');
              
              logger.warn('Payment confirmed but stock insufficient - order cancelled', {
                orderId,
                productId: order.product_id,
                stockAvailable: currentProduct.stock_quantity,
                quantityNeeded: order.quantity
              });
              
              return res.status(400).json({
                success: false,
                error: 'Sorry, this product is sold out. Your payment will be refunded.',
                code: 'STOCK_INSUFFICIENT'
              });
            }
          } else {
            // Multi-item order - validate ALL products
            logger.info('Validating multi-item order', {
              orderId,
              itemCount: orderItems.length
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
                  shopDeleted: !item.shop_id
                });
                
                return res.status(400).json({
                  success: false,
                  error: 'One or more products are no longer available. Order cancelled.',
                  code: 'PRODUCT_UNAVAILABLE'
                });
              }
              
              // Skip stock check for preorder products
              if (item.is_preorder) {
                logger.info('Preorder item - skipping stock check', {
                  orderId,
                  productId: item.product_id,
                  productName: item.product_name
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
                  requested: item.ordered_quantity
                });
                
                return res.status(400).json({
                  success: false,
                  error: `Sorry, "${item.product_name}" is sold out. Your payment will be refunded.`,
                  code: 'STOCK_INSUFFICIENT'
                });
              }
            }
            
            logger.info('All items in stock - confirming order', {
              orderId,
              itemCount: orderItems.length
            });
          }

          // Update order status to confirmed
          await client.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            ['confirmed', orderId]
          );

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
                quantity: order.quantity
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
                  quantity: item.ordered_quantity
                });
              }
            }
          }

        // Commit transaction
        await client.query('COMMIT');

        // Read operations (outside transaction - read-only)
        const [product, buyer] = await Promise.all([
          productQueries.findById(order.product_id),
          userQueries.findById(order.buyer_id)
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
            buyerTelegramId: buyer.telegram_id
          });
        } catch (notifError) {
          logger.error('Seller notification error', { error: notifError.message, stack: notifError.stack });
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
            shop_name: shop.name
          });
        } catch (notifError) {
          logger.error('Buyer notification error', { error: notifError.message, stack: notifError.stack });
        }
      } else {
        // Payment not confirmed yet - create pending payment and commit
        payment = await paymentQueries.create({
          orderId,
          txHash,
          amount: order.total_price,  // ✅ FIX #3: Use order.total_price
          currency,
          status: verification.status
        }, client);

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
            status: verification.status
          }
        }
      });

    } catch (error) {
      // Rollback on any error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Rollback error in verify', { error: rollbackError.message });
      }
      
      logger.error('Verify payment error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to verify payment'
      });
    } finally {
      client.release();
    }
  },

  /**
   * Get payment by order ID
   */
  getByOrder: async (req, res) => {
    try {
      const { orderId } = req.params;

      // Get order to check access
      const order = await orderQueries.findById(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
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
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const payments = await paymentQueries.findByOrderId(orderId);

      return res.status(200).json({
        success: true,
        data: payments
      });

    } catch (error) {
      logger.error('Get payment error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get payment'
      });
    }
  },

  /**
   * Check payment status (for polling)
   */
  checkStatus: async (req, res) => {
    try {
      const { txHash } = req.query;

      if (!txHash) {
        return res.status(400).json({
          success: false,
          error: 'Transaction hash required'
        });
      }

      const payment = await paymentQueries.findByTxHash(txHash);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found'
        });
      }

      // Get order to check access
      const order = await orderQueries.findById(payment.order_id);

      // Get product and shop (needed for both access check and wallet address)
      const product = await productQueries.findById(order.product_id);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      const shop = await shopQueries.findById(product.shop_id);
      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Check if user has access (buyer or seller)
      const isBuyer = order.buyer_id === req.user.id;
      const isSeller = shop.owner_id === req.user.id;

      if (!isBuyer && !isSeller) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // If payment is still pending, check blockchain again
      if (payment.status === 'pending') {
        // Get seller's wallet address for the currency
        const walletField = `wallet_${payment.currency.toLowerCase()}`;
        const sellerAddress = shop[walletField];

        if (!sellerAddress) {
          return res.status(400).json({
            success: false,
            error: `Seller has not configured ${payment.currency} wallet`
          });
        }

        const verification = await cryptoService.verifyTransaction(
          payment.tx_hash,
          sellerAddress,
          order.total_price,
          payment.currency
        );
        
        if (!verification.verified) {
          return res.status(400).json({
            success: false,
            error: verification.error || 'Payment verification failed'
          });
        }
        
        // ✅ FIX #3: Verify amount matches order total (checkStatus)
        if (verification.amount < parseFloat(order.total_price)) {
          logger.error('Payment amount mismatch (checkStatus)', {
            orderId: order.id,
            txHash: payment.tx_hash,
            expected: order.total_price,
            received: verification.amount,
            shortage: parseFloat(order.total_price) - verification.amount
          });
          
          return res.status(400).json({
            success: false,
            error: `Payment amount insufficient. Expected ${order.total_price}, received ${verification.amount}`,
            code: 'AMOUNT_MISMATCH'
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

            // ✅ БАГ #4 FIX: Check invoice expiry
            const invoiceResult = await client.query(
              'SELECT id, expires_at FROM invoices WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
              [order.id]
            );
            
            if (invoiceResult.rows.length > 0) {
              const invoice = invoiceResult.rows[0];
              const now = new Date();
              const expiresAt = new Date(invoice.expires_at);
              
              if (now > expiresAt) {
                await client.query(
                  'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                  ['cancelled', order.id]
                );
                await client.query('COMMIT');
                
                logger.warn('Invoice expired - order cancelled (checkStatus)', {
                  orderId: order.id,
                  invoiceId: invoice.id,
                  expiresAt: invoice.expires_at,
                  currentTime: now.toISOString(),
                  expiredAgo: Math.round((now - expiresAt) / 1000 / 60)
                });
                
                // Update in-memory payment object
                payment.status = 'confirmed';
                payment.confirmations = verification.confirmations;
                
                return res.status(400).json({
                  success: false,
                  error: 'Payment window expired. Please create a new order.',
                  code: 'INVOICE_EXPIRED'
                });
              }
              
              logger.info('Invoice valid - within expiry window (checkStatus)', {
                orderId: order.id,
                expiresAt: invoice.expires_at,
                remainingMinutes: Math.round((expiresAt - now) / 1000 / 60)
              });
            }

            // ✅ FIX #4: Lock products BEFORE checking stock (checkStatus)
            const orderItems = await orderItemQueries.findByOrderIdWithStock(order.id, client);
            
            const productIds = orderItems.map(item => item.product_id).filter(Boolean);
            
            if (productIds.length > 0) {
              await client.query(
                `SELECT id FROM products 
                 WHERE id = ANY($1::int[])
                 FOR UPDATE`,
                [productIds]
              );
              
              logger.info('Products locked for stock check (checkStatus)', {
                orderId: order.id,
                productIds
              });
            }
            
            // Re-check stock AFTER lock
            if (orderItems.length === 0) {
              // Fallback: legacy single-item order (backward compatibility)
              logger.warn('No order_items found - assuming legacy single-item order (checkStatus)', {
                orderId: order.id
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
                await client.query(
                  'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                  ['cancelled', order.id]
                );
                await client.query('COMMIT');
                
                logger.warn('Payment confirmed but product/shop deleted - order cancelled (checkStatus)', {
                  orderId: order.id,
                  productDeleted: productShopCheck.rows.length === 0,
                  shopDeleted: productShopCheck.rows.length > 0 && !productShopCheck.rows[0].shop_id
                });
                
                // Update in-memory payment object
                payment.status = 'confirmed';
                payment.confirmations = verification.confirmations;
                
                // Return with error
                return res.status(400).json({
                  success: false,
                  error: 'This product is no longer available. Order cancelled.',
                  code: 'PRODUCT_UNAVAILABLE'
                });
              }
              
              const currentProduct = productShopCheck.rows[0];
              
              // Skip stock check for preorder products
              if (currentProduct.is_preorder) {
                logger.info('Preorder product - skipping stock check in checkStatus', {
                  orderId: order.id,
                  productId: order.product_id
                });
              } else if (currentProduct.stock_quantity < order.quantity) {
                // Stock insufficient - cancel order
                await client.query(
                  'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                  ['cancelled', order.id]
                );
                await client.query('COMMIT');
                
                logger.warn('Payment confirmed but stock insufficient - order cancelled (checkStatus)', {
                  orderId: order.id,
                  productId: order.product_id,
                  stockAvailable: currentProduct.stock_quantity,
                  quantityNeeded: order.quantity
                });
                
                // Update in-memory payment object
                payment.status = 'confirmed';
                payment.confirmations = verification.confirmations;
                
                // Return with warning
                return res.status(200).json({
                  success: true,
                  data: payment,
                  warning: 'Product sold out - order cancelled, refund will be processed'
                });
              }
            } else {
              // Multi-item order - validate ALL products
              logger.info('Validating multi-item order (checkStatus)', {
                orderId: order.id,
                itemCount: orderItems.length
              });
              
              for (const item of orderItems) {
                // Check if product/shop deleted
                if (!item.product_id || !item.shop_id) {
                  await client.query(
                    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                    ['cancelled', order.id]
                  );
                  await client.query('COMMIT');
                  
                  logger.warn('Product/shop deleted in multi-item order - cancelled (checkStatus)', {
                    orderId: order.id,
                    itemId: item.item_id,
                    productDeleted: !item.product_id,
                    shopDeleted: !item.shop_id
                  });
                  
                  // Update in-memory payment object
                  payment.status = 'confirmed';
                  payment.confirmations = verification.confirmations;
                  
                  return res.status(400).json({
                    success: false,
                    error: 'One or more products are no longer available. Order cancelled.',
                    code: 'PRODUCT_UNAVAILABLE'
                  });
                }
                
                // Skip stock check for preorder products
                if (item.is_preorder) {
                  logger.info('Preorder item - skipping stock check (checkStatus)', {
                    orderId: order.id,
                    productId: item.product_id,
                    productName: item.product_name
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
                    requested: item.ordered_quantity
                  });
                  
                  // Update in-memory payment object
                  payment.status = 'confirmed';
                  payment.confirmations = verification.confirmations;
                  
                  return res.status(200).json({
                    success: true,
                    data: payment,
                    warning: `"${item.product_name}" sold out - order cancelled, refund will be processed`
                  });
                }
              }
              
              logger.info('All items in stock - confirming order (checkStatus)', {
                orderId: order.id,
                itemCount: orderItems.length
              });
            }

            // Update order status to confirmed
            await client.query(
              'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
              ['confirmed', order.id]
            );

            // Deduct stock for ALL items
            if (orderItems.length === 0) {
              // Legacy single-item: deduct from orders.product_id
              const productPreorderCheck = await client.query(
                'SELECT is_preorder FROM products WHERE id = $1',
                [order.product_id]
              );
              if (productPreorderCheck.rows.length > 0 && !productPreorderCheck.rows[0].is_preorder) {
                await productQueries.updateStock(order.product_id, -order.quantity, client);
                logger.info('Stock deducted for legacy single-item order (checkStatus)', {
                  orderId: order.id,
                  productId: order.product_id,
                  quantity: order.quantity
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
                    quantity: item.ordered_quantity
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
            logger.error('Transaction error in checkStatus', { error: txError.message, stack: txError.stack });
            throw txError;
          } finally {
            client.release();
          }

          // Read operations (outside transaction - read-only)
          const [product, buyer] = await Promise.all([
            productQueries.findById(order.product_id),
            userQueries.findById(order.buyer_id)
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
              buyerTelegramId: buyer.telegram_id
            });
          } catch (notifError) {
            logger.error('Seller notification error in checkStatus', { error: notifError.message, stack: notifError.stack });
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
              shop_name: shop.name
            });
          } catch (notifError) {
            logger.error('Buyer notification error in checkStatus', { error: notifError.message, stack: notifError.stack });
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: payment
      });

    } catch (error) {
      logger.error('Check payment status error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to check payment status'
      });
    }
  },

  /**
   * Generate QR code for payment
   */
  generateQR: async (req, res) => {
    try {
      const { address, amount, currency } = req.body;

      // Validate inputs
      if (!address || !amount || !currency) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: address, amount, currency'
        });
      }

      // Validate currency
      const supportedCurrencies = ['BTC', 'ETH', 'USDT', 'LTC'];
      if (!supportedCurrencies.includes(currency.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Unsupported currency. Supported: ${supportedCurrencies.join(', ')}`
        });
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
        amount
      });

      // Generate QR code as data URL
      const qrDataURL = await QRCode.toDataURL(paymentURI, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 512,
        margin: 2
      });

      return res.status(200).json({
        success: true,
        data: {
          qrCode: qrDataURL,
          paymentURI,
          address,
          amount,
          currency
        }
      });

    } catch (error) {
      logger.error('QR generation error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to generate QR code'
      });
    }
  }
};

export default paymentController;
