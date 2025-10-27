import { orderQueries, productQueries, shopQueries } from '../models/db.js';
import { getClient } from '../config/database.js';
import { dbErrorHandler } from '../middleware/errorHandler.js';
import telegramService from '../services/telegram.js';
import logger from '../utils/logger.js';

/**
 * Order Controller
 */
export const orderController = {
  /**
   * Create new order
   */
  create: async (req, res) => {
    const client = await getClient();

    try {
      const { productId, quantity, deliveryAddress } = req.body;

      // Start transaction
      await client.query('BEGIN');

      // Lock product row for update (prevents race condition)
      const productResult = await client.query(
        'SELECT * FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );

      const product = productResult.rows[0];

      if (!product) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      if (!product.is_active) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Product is not available'
        });
      }

      // Check stock (ATOMIC: prevents overselling)
      if (product.stock_quantity < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Insufficient stock. Available: ${product.stock_quantity}`
        });
      }

      // Calculate total price
      const totalPrice = product.price * quantity;

      // Create order (pass client for transaction)
      const order = await orderQueries.create({
        buyerId: req.user.id,
        productId,
        quantity,
        totalPrice,
        currency: product.currency,
        deliveryAddress
      }, client);

      // Decrease product stock (pass client for transaction)
      await productQueries.updateStock(productId, -quantity, client);

      // Commit transaction
      await client.query('COMMIT');

      // Notify seller about new order (outside transaction)
      try {
        await telegramService.notifyNewOrder(product.owner_id, {
          id: order.id,
          product_name: product.name,
          total_price: totalPrice,
          currency: product.currency,
          buyer_username: req.user.username
        });
      } catch (notifError) {
        logger.error('Notification error', { error: notifError.message, stack: notifError.stack });
        // Don't fail the order creation if notification fails
      }

      return res.status(201).json({
        success: true,
        data: order
      });

    } catch (error) {
      // Rollback transaction on any error (catch potential rollback errors)
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Rollback error', { error: rollbackError.message });
      }
      
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {})
        });
      }

      logger.error('Create order error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to create order'
      });
    } finally {
      // CRITICAL: Always release client back to pool (prevents connection leak)
      client.release();
    }
  },

  /**
   * Get order by ID
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const order = await orderQueries.findById(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Check if user has access to this order
      if (order.buyer_id !== req.user.id && order.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      return res.status(200).json({
        success: true,
        data: order
      });

    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {})
        });
      }

      logger.error('Get order error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get order'
      });
    }
  },

  /**
   * Get orders for current user
   */
  getMyOrders: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;
      const type = req.query.type; // 'buyer' or 'seller'

      let orders;

      if (type === 'seller') {
        // Get orders as seller - only if user has shops
        const shops = await shopQueries.findByOwnerId(req.user.id);

        if (!shops || shops.length === 0) {
          return res.status(403).json({
            success: false,
            error: 'You need to create a shop first to view seller orders'
          });
        }

        orders = await orderQueries.findByOwnerId(req.user.id, limit, offset);
      } else {
        // Get orders as buyer (default)
        orders = await orderQueries.findByBuyerId(req.user.id, limit, offset);
      }

      return res.status(200).json({
        success: true,
        data: orders
      });

    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {})
        });
      }

      logger.error('Get my orders error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get orders'
      });
    }
  },

  /**
   * Update order status
   */
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Get order
      const existingOrder = await orderQueries.findById(id);

      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Only seller can update order status (except cancellation)
      if (status !== 'cancelled' && existingOrder.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Only seller can update order status'
        });
      }

      // Buyer can cancel their own pending orders
      if (status === 'cancelled' && existingOrder.buyer_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only cancel your own orders'
        });
      }

      const order = await orderQueries.updateStatus(id, status);

      // Notify buyer about status update
      try {
        await telegramService.notifyOrderStatusUpdate(existingOrder.buyer_telegram_id, {
          id: order.id,
          status: order.status,
          product_name: existingOrder.product_name
        });
      } catch (notifError) {
        logger.error('Notification error', { error: notifError.message, stack: notifError.stack });
      }

      return res.status(200).json({
        success: true,
        data: order
      });

    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {})
        });
      }

      logger.error('Update order status error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to update order status'
      });
    }
  },

  /**
   * Get sales analytics for seller
   */
  getAnalytics: async (req, res) => {
    try {
      const { from, to } = req.query;
      const userId = req.user.id;

      // Validate required parameters
      if (!from || !to) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: from and to dates (YYYY-MM-DD format)'
        });
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(from) || !dateRegex.test(to)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD (e.g., 2025-01-01)'
        });
      }

      // Parse dates
      const fromDate = new Date(from);
      const toDate = new Date(to);

      // Validate date range
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date values'
        });
      }

      if (fromDate > toDate) {
        return res.status(400).json({
          success: false,
          error: 'from date must be before or equal to to date'
        });
      }

      // Check if dates are in the future
      const now = new Date();
      if (fromDate > now) {
        return res.status(400).json({
          success: false,
          error: 'from date cannot be in the future'
        });
      }

      // Add 1 day to toDate for exclusive upper bound (to include the entire day)
      const toDateExclusive = new Date(toDate);
      toDateExclusive.setDate(toDateExclusive.getDate() + 1);

      // Query analytics data
      const client = await getClient();
      try {
        // Get summary statistics
        const summaryResult = await client.query(
          `SELECT
            COUNT(*) as total_orders,
            SUM(CASE WHEN o.status IN ('confirmed', 'shipped', 'delivered') THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN o.status IN ('confirmed', 'shipped', 'delivered') THEN o.total_price ELSE 0 END) as total_revenue,
            AVG(CASE WHEN o.status IN ('confirmed', 'shipped', 'delivered') THEN o.total_price ELSE NULL END) as avg_order_value
          FROM orders o
          JOIN products p ON o.product_id = p.id
          JOIN shops s ON p.shop_id = s.id
          WHERE s.owner_id = $1
            AND o.created_at >= $2
            AND o.created_at < $3`,
          [userId, fromDate, toDateExclusive]
        );

        // Get top products
        const topProductsResult = await client.query(
          `SELECT
            p.id,
            p.name,
            COUNT(o.id) as quantity,
            SUM(o.total_price) as revenue
          FROM orders o
          JOIN products p ON o.product_id = p.id
          JOIN shops s ON p.shop_id = s.id
          WHERE s.owner_id = $1
            AND o.created_at >= $2
            AND o.created_at < $3
            AND o.status IN ('confirmed', 'shipped', 'delivered')
          GROUP BY p.id, p.name
          ORDER BY revenue DESC
          LIMIT 10`,
          [userId, fromDate, toDateExclusive]
        );

        const summary = summaryResult.rows[0];
        const topProducts = topProductsResult.rows;

        return res.status(200).json({
          success: true,
          data: {
            period: {
              from,
              to
            },
            summary: {
              totalRevenue: parseFloat(summary.total_revenue || 0),
              totalOrders: parseInt(summary.total_orders || 0, 10),
              completedOrders: parseInt(summary.completed_orders || 0, 10),
              avgOrderValue: parseFloat(summary.avg_order_value || 0)
            },
            topProducts: topProducts.map(product => ({
              id: product.id,
              name: product.name,
              quantity: parseInt(product.quantity, 10),
              revenue: parseFloat(product.revenue)
            }))
          }
        });

      } finally {
        client.release();
      }

    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {})
        });
      }

      logger.error('Get analytics error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get analytics'
      });
    }
  }
};

export default orderController;
