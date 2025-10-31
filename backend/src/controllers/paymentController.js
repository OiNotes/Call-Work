import { paymentQueries, orderQueries, productQueries, shopQueries, userQueries, invoiceQueries } from '../models/db.js';
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
    try {
      const { orderId, txHash, currency } = req.body;

      // Get order
      const order = await orderQueries.findById(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Check if order belongs to user
      if (order.buyer_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Check if order already has a verified payment
      const existingPayments = await paymentQueries.findByOrderId(orderId);
      const verifiedPayment = existingPayments.find(p => p.status === 'confirmed');

      if (verifiedPayment) {
        return res.status(400).json({
          success: false,
          error: 'Order already paid'
        });
      }

      // Check if this transaction was already submitted
      const existingTx = await paymentQueries.findByTxHash(txHash);

      if (existingTx) {
        return res.status(400).json({
          success: false,
          error: 'Transaction already submitted',
          payment: existingTx
        });
      }

      // Get invoice to retrieve payment address
      const invoice = await invoiceQueries.findByOrderId(orderId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found for this order'
        });
      }

      // Verify payment with blockchain using invoice address
      const verification = await cryptoService.verifyTransaction(
        txHash,
        invoice.address,
        order.total_price,
        currency
      );

      if (!verification.verified) {
        // Create failed payment record
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

      let payment;

      // If payment is confirmed, use transaction for atomicity
      if (verification.status === 'confirmed') {
        // CRITICAL: Use transaction for atomicity (payment + order status + stock updates)
        const client = await getClient();
        try {
          await client.query('BEGIN');

          // Create payment record inside transaction
          payment = await paymentQueries.create({
            orderId,
            txHash,
            amount: verification.amount,
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

          // Update order status
          await client.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            ['confirmed', orderId]
          );

          // Update stock atomically
          await productQueries.updateStock(order.product_id, -order.quantity, client);
          await productQueries.unreserveStock(order.product_id, order.quantity, client);

          await client.query('COMMIT');
        } catch (txError) {
          await client.query('ROLLBACK');
          logger.error('Transaction error in payment confirmation', { error: txError.message, stack: txError.stack });
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
          logger.error('Seller notification error', { error: notifError.message, stack: notifError.stack });
        }

        // Notify buyer
        try {
          await telegramService.notifyPaymentConfirmed(order.buyer_telegram_id, {
            id: order.id,
            product_name: order.product_name,
            total_price: order.total_price,
            currency: order.currency
          });
        } catch (notifError) {
          logger.error('Buyer notification error', { error: notifError.message, stack: notifError.stack });
        }
      } else {
        // Payment not confirmed yet - create payment record without transaction
        payment = await paymentQueries.create({
          orderId,
          txHash,
          amount: verification.amount,
          currency,
          status: verification.status
        });

        // Update payment with confirmations
        if (verification.confirmations) {
          await paymentQueries.updateStatus(
            payment.id,
            verification.status,
            verification.confirmations
          );
        }
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
      logger.error('Verify payment error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to verify payment'
      });
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

      // If payment is still pending, check blockchain again
      if (payment.status === 'pending') {
        // Get invoice to retrieve payment address
        const invoice = await invoiceQueries.findByOrderId(order.id);

        if (!invoice) {
          return res.status(404).json({
            success: false,
            error: 'Invoice not found for this order'
          });
        }

        const verification = await cryptoService.verifyTransaction(
          payment.tx_hash,
          invoice.address,
          order.total_price,
          payment.currency
        );

        if (verification.verified && verification.status === 'confirmed') {
          // CRITICAL: Use transaction for atomicity (payment + order status updates)
          const client = await getClient();
          try {
            await client.query('BEGIN');

            // Update payment status
            await client.query(
              `UPDATE payments SET status = $1, confirmations = $2, updated_at = NOW() WHERE id = $3`,
              ['confirmed', verification.confirmations, payment.id]
            );

            // Update order status
            await client.query(
              'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
              ['confirmed', order.id]
            );

            // Update stock atomically
            await productQueries.updateStock(order.product_id, -order.quantity, client);
            await productQueries.unreserveStock(order.product_id, order.quantity, client);

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
      const supportedCurrencies = ['BTC', 'ETH', 'USDT', 'TON'];
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
        case 'TON':
          // TON transfer format
          paymentURI = `ton://transfer/${address}?amount=${amount}`;
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
