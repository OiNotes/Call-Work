import { orderQueries, orderItemQueries, productQueries, shopQueries, invoiceQueries } from '../models/db.js';
import { getClient } from '../config/database.js';
import { dbErrorHandler } from '../middleware/errorHandler.js';
import telegramService from '../services/telegram.js';
import logger from '../utils/logger.js';
import { generateAddress } from '../services/walletService.js';
import { getCryptoPrice, convertUsdToCrypto, roundCryptoAmount } from '../services/cryptoPriceService.js';
import { validateStatusTransition } from '../utils/orderStateValidator.js';

/**
 * Order Controller
 */
const VALID_ORDER_STATUSES = new Set(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']);
const STATUS_ALIASES = new Map([
  ['completed', 'delivered'],
  ['complete', 'delivered'],
  ['active', 'confirmed']
]);

const parseStatusFilter = (statusParam) => {
  if (!statusParam) {
    return [];
  }

  const normalized = new Set();

  statusParam
    .split(',')
    .map((status) => status.trim().toLowerCase())
    .filter(Boolean)
    .forEach((status) => {
      const mapped = STATUS_ALIASES.get(status) || status;
      if (VALID_ORDER_STATUSES.has(mapped)) {
        normalized.add(mapped);
      }
    });

  return Array.from(normalized);
};

export const orderController = {
  /**
   * Create new order
   * ✅ MULTI-ITEM SUPPORT: Now accepts either single item or multiple items
   * 
   * Request body formats:
   * 1. Legacy (backward compatible):
   *    { productId: 1, quantity: 5, deliveryAddress: null }
   * 
   * 2. Multi-item (new):
   *    { items: [{ productId: 1, quantity: 5 }, { productId: 2, quantity: 3 }], deliveryAddress: null }
   */
  create: async (req, res) => {
    const client = await getClient();

    try {
      const { productId, quantity, items, deliveryAddress } = req.body;

      // ✅ BACKWARD COMPATIBLE: Convert legacy format to items array
      let cartItems = [];
      if (items && Array.isArray(items) && items.length > 0) {
        // New multi-item format
        cartItems = items;
      } else if (productId && quantity) {
        // Legacy single-item format
        cartItems = [{ productId, quantity }];
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either items array or productId+quantity required'
        });
      }

      if (cartItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cart is empty'
        });
      }

      // ✅ FIX: Log incoming cart for debugging intermittent issues
      logger.debug('Creating order with cart', {
        userId: req.user.id,
        itemCount: cartItems.length,
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      });

      // Start transaction
      await client.query('BEGIN');

      // Step 1: Fetch and lock all products
      const productIds = cartItems.map(item => item.productId);
      const productResult = await client.query(
        `SELECT id, shop_id, name, description, price, currency,
                stock_quantity, reserved_quantity, is_active, is_preorder,
                created_at, updated_at
         FROM products WHERE id = ANY($1::int[]) FOR UPDATE`,
        [productIds]
      );

      const productsMap = new Map();
      productResult.rows.forEach(p => productsMap.set(p.id, p));

      // Step 2: Validate all items
      const validatedItems = [];
      let totalPrice = 0;
      let currency = null;
      let shopId = null; // Track shop_id for multi-shop validation

      for (const item of cartItems) {
        const product = productsMap.get(item.productId);

        // Check product exists
        if (!product) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            error: `Product ID ${item.productId} not found`
          });
        }

        // Check product is active
        if (!product.is_active) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Product "${product.name}" is not available`
          });
        }

        // Check stock availability (skip for preorders)
        if (!product.is_preorder) {
          const available = product.stock_quantity - (product.reserved_quantity || 0);
          if (available < item.quantity) {
            // ✅ FIX: Log stock validation failures for debugging
            logger.warn('❌ Insufficient stock for order', {
              userId: req.user.id,
              productId: product.id,
              productName: product.name,
              stockTotal: product.stock_quantity,
              stockReserved: product.reserved_quantity || 0,
              stockAvailable: available,
              requestedQuantity: item.quantity,
              shortfall: item.quantity - available
            });

            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: `Insufficient stock for "${product.name}". Available: ${available}, requested: ${item.quantity}`
            });
          }
        }

        // Validate shop_id consistency (all items must be from same shop)
        if (shopId === null) {
          shopId = product.shop_id;
        } else if (shopId !== product.shop_id) {
          await client.query('ROLLBACK');
          
          logger.warn('❌ Multi-shop order attempt blocked', {
            userId: req.user.id,
            productIds: cartItems.map(c => c.productId),
            shopIds: [shopId, product.shop_id],
            itemCount: cartItems.length
          });
          
          return res.status(400).json({
            success: false,
            error: 'Cannot order products from multiple shops in one order. Please complete orders separately.',
            code: 'MULTI_SHOP_ORDER'
          });
        }

        // Validate currency consistency (all items must have same currency)
        if (currency === null) {
          currency = product.currency;
        } else if (currency !== product.currency) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Mixed currencies not allowed. Expected ${currency}, got ${product.currency} for "${product.name}"`
          });
        }

        // Calculate item total
        const itemTotal = product.price * item.quantity;
        totalPrice += itemTotal;

        validatedItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          price: product.price,
          currency: product.currency,
          shopId: product.shop_id
        });
      }

      // Step 2.5: Log validation success
      logger.info('✅ All products from same shop', {
        shopId,
        productCount: validatedItems.length,
        totalPrice,
        currency
      });

      // Step 3: Create order with total price
      // Note: For multi-item orders, product_id stores first item's ID for backward compatibility
      const order = await orderQueries.create({
        buyerId: req.user.id,
        productId: validatedItems[0].productId,
        quantity: validatedItems.reduce((sum, item) => sum + item.quantity, 0), // Total quantity
        totalPrice,
        currency,
        deliveryAddress
      }, client);

      // Step 4: Create order items records
      await orderItemQueries.createBatch(order.id, validatedItems, client);

      // Step 5: Stock will be deducted only after payment confirmation
      // No reservation at order creation - first come, first served on payment

      // Commit transaction
      await client.query('COMMIT');

      logger.info('Order created successfully', {
        orderId: order.id,
        buyerId: req.user.id,
        itemCount: validatedItems.length,
        totalPrice,
        currency
      });

      return res.status(201).json({
        success: true,
        data: {
          ...order,
          items: validatedItems // Include items in response
        }
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
   * P0-DB-3 FIX: Add MAX_LIMIT to prevent unbounded queries
   */
  getMyOrders: async (req, res) => {
    try {
      // P0-DB-3 FIX: Enforce maximum limit to prevent memory exhaustion
      const MAX_LIMIT = 1000;
      const requestedLimit = parseInt(req.query.limit, 10) || 50;
      const limit = Math.min(requestedLimit, MAX_LIMIT);
      
      const page = parseInt(req.query.page, 10) || 1;
      const offset = (page - 1) * limit;
      const type = req.query.type; // 'buyer' or 'seller'
      const hasShopFilter = typeof req.query.shop_id !== 'undefined';
      const shopId = hasShopFilter ? parseInt(req.query.shop_id, 10) : null;
      const statusFilter = parseStatusFilter(req.query.status);

      let orders;

      if (hasShopFilter) {
        if (!Number.isInteger(shopId) || shopId <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid shop_id'
          });
        }

        const shop = await shopQueries.findById(shopId);

        if (!shop) {
          return res.status(404).json({
            success: false,
            error: 'Shop not found'
          });
        }

        if (shop.owner_id !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'You can only view your own shop orders'
          });
        }

        orders = await orderQueries.findByShopId(shopId, {
          limit,
          offset,
          statuses: statusFilter
        });

      } else if (type === 'seller') {
        // Get orders as seller - only if user has shops
        const shops = await shopQueries.findByOwnerId(req.user.id);

        if (!shops || shops.length === 0) {
          return res.status(403).json({
            success: false,
            error: 'You need to create a shop first to view seller orders'
          });
        }

        orders = await orderQueries.findByOwnerId(req.user.id, {
          limit,
          offset,
          statuses: statusFilter
        });
      } else {
        // Get orders as buyer (default)
        orders = await orderQueries.findByBuyerId(req.user.id, limit, offset);
      }

      return res.status(200).json({
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          maxLimit: MAX_LIMIT,
          hasMore: orders.length === limit
        }
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
   * ✅ БАГ #6 FIX: Returns stock when cancelling confirmed orders
   */
  updateStatus: async (req, res) => {
    const client = await getClient();

    try {
      const { id } = req.params;
      const { status } = req.body;

      await client.query('BEGIN');

      // Get order with current status
      const existingOrder = await orderQueries.findById(id);

      if (!existingOrder) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Only seller can update order status (except cancellation)
      if (status !== 'cancelled' && existingOrder.owner_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'Only seller can update order status'
        });
      }

      // Buyer can cancel their own orders
      if (status === 'cancelled' && existingOrder.buyer_id !== req.user.id && existingOrder.owner_id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'You can only cancel your own orders'
        });
      }

      // Validate state transition (state machine check)
      const transition = validateStatusTransition(existingOrder.status, status);

      if (!transition.valid) {
        await client.query('ROLLBACK');
        logger.warn(`Invalid status transition: ${existingOrder.status} → ${status} for order ${id}`);
        return res.status(422).json({
          success: false,
          error: transition.error,
          code: 'INVALID_STATUS_TRANSITION'
        });
      }

      // Handle idempotent update (same status requested)
      if (transition.idempotent) {
        await client.query('ROLLBACK');
        logger.info(`Idempotent status update for order ${id}: already in status ${status}`);
        return res.status(200).json({
          success: true,
          idempotent: true,
          message: `Order is already in status ${status}`,
          data: existingOrder
        });
      }

      // ✅ БАГ #6 FIX: Return stock if cancelling a confirmed order
      if (status === 'cancelled' && existingOrder.status === 'confirmed') {
        logger.info('Cancelling confirmed order - returning stock', {
          orderId: id,
          userId: req.user.id,
          previousStatus: existingOrder.status
        });

        // Get all order items
        const orderItems = await orderItemQueries.findByOrderIdWithStock(id, client);

        // Return stock for each non-preorder item
        for (const item of orderItems) {
          if (!item.is_preorder && item.product_id) {
            await productQueries.updateStock(
              item.product_id,
              item.ordered_quantity, // Positive value = add back
              client
            );

            logger.info('Stock returned for cancelled item', {
              orderId: id,
              productId: item.product_id,
              productName: item.product_name,
              quantityReturned: item.ordered_quantity
            });
          }
        }

        // Fallback: Check legacy single-item order format
        if (orderItems.length === 0 && existingOrder.product_id && existingOrder.quantity) {
          logger.warn('No order_items found - checking legacy product_id', {
            orderId: id,
            productId: existingOrder.product_id
          });

          // Get product to check is_preorder
          const productResult = await client.query(
            'SELECT is_preorder FROM products WHERE id = $1',
            [existingOrder.product_id]
          );

          if (productResult.rows.length > 0 && !productResult.rows[0].is_preorder) {
            await productQueries.updateStock(
              existingOrder.product_id,
              existingOrder.quantity,
              client
            );

            logger.info('Stock returned for legacy order', {
              orderId: id,
              productId: existingOrder.product_id,
              quantity: existingOrder.quantity
            });
          }
        }
      } else if (status === 'cancelled') {
        logger.info('Cancelling non-confirmed order - no stock to return', {
          orderId: id,
          currentStatus: existingOrder.status
        });
      }

      // Update order status
      await client.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
        [status, id]
      );

      await client.query('COMMIT');

      // Fetch updated order
      const order = await orderQueries.findById(id);

      logger.info('Order status updated successfully', {
        orderId: id,
        previousStatus: existingOrder.status,
        newStatus: status,
        userId: req.user.id
      });

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
      // Rollback transaction on error
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

      logger.error('Update order status error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to update order status'
      });
    } finally {
      client.release();
    }
  },

  /**
   * Get count of active orders (confirmed status)
   */
  getActiveCount: async (req, res) => {
    try {
      const shopId = req.query.shop_id;

      if (!shopId) {
        return res.status(400).json({
          success: false,
          error: 'shop_id required'
        });
      }

      // Verify shop ownership
      const shop = await shopQueries.findById(shopId);
      if (!shop || shop.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Count confirmed orders only
      const client = await getClient();
      try {
        const result = await client.query(
          `SELECT COUNT(*) as count
           FROM orders o
           JOIN products p ON o.product_id = p.id
           WHERE p.shop_id = $1 AND o.status = 'confirmed'`,
          [shopId]
        );

        const count = parseInt(result.rows[0].count);
        return res.status(200).json({
          success: true,
          data: { count }
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

      logger.error('Get active orders count error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get active orders count'
      });
    }
  },

  /**
   * Bulk update order status
   */
  bulkUpdateStatus: async (req, res) => {
    const client = await getClient();

    try {
      const { order_ids, status } = req.body;
      const userId = req.user.id;

      // Start transaction
      await client.query('BEGIN');

      // Get all orders with ownership check
      const ordersResult = await client.query(
        `SELECT o.id, o.status as current_status, o.buyer_id,
                p.shop_id, s.owner_id, p.name as product_name,
                u.username as buyer_username, u.telegram_id as buyer_telegram_id
         FROM orders o
         JOIN products p ON o.product_id = p.id
         JOIN shops s ON p.shop_id = s.id
         JOIN users u ON o.buyer_id = u.id
         WHERE o.id = ANY($1::int[])`,
        [order_ids]
      );

      const foundOrders = ordersResult.rows;

      // Check if all orders were found
      if (foundOrders.length !== order_ids.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'One or more orders not found'
        });
      }

      // Verify user owns all shops (authorization check)
      const unauthorized = foundOrders.find(order => order.owner_id !== userId);
      if (unauthorized) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to update these orders'
        });
      }

      // Validate state transitions for all orders before updating
      const invalidTransitions = [];
      for (const order of foundOrders) {
        const transition = validateStatusTransition(order.current_status, status);
        if (!transition.valid && !transition.idempotent) {
          invalidTransitions.push({
            order_id: order.id,
            current_status: order.current_status,
            requested_status: status,
            error: transition.error
          });
        }
      }

      if (invalidTransitions.length > 0) {
        await client.query('ROLLBACK');
        logger.warn(`Bulk update rejected due to invalid transitions:`, invalidTransitions);
        return res.status(422).json({
          success: false,
          error: 'One or more orders cannot transition to the requested status',
          code: 'INVALID_STATUS_TRANSITIONS',
          details: invalidTransitions
        });
      }

      // Bulk update status - only for orders that are not already in that status
      const updateResult = await client.query(
        `UPDATE orders
         SET status = $1, updated_at = NOW()
         WHERE id = ANY($2::int[]) AND status != $1
         RETURNING id, status, product_id, buyer_id, quantity, total_price, currency, created_at, updated_at`,
        [status, order_ids]
      );

      const updatedOrders = updateResult.rows;

      // Count idempotent updates (orders already in target status)
      const idempotentCount = foundOrders.length - updatedOrders.length;

      // Commit transaction
      await client.query('COMMIT');

      // Build response with additional details
      const ordersWithDetails = updatedOrders.map(order => {
        const original = foundOrders.find(o => o.id === order.id);
        return {
          id: order.id,
          status: order.status,
          product_name: original?.product_name || null,
          buyer_username: original?.buyer_username || null,
          quantity: order.quantity,
          total_price: parseFloat(order.total_price),
          currency: order.currency,
          updated_at: order.updated_at
        };
      });

      // Send Telegram notifications (non-blocking)
      foundOrders.forEach(async (order) => {
        try {
          if (order.buyer_telegram_id) {
            await telegramService.notifyOrderStatusUpdate(order.buyer_telegram_id, {
              id: order.id,
              status,
              product_name: order.product_name
            });
          }
        } catch (notifError) {
          logger.error('Bulk notification error', {
            orderId: order.id,
            error: notifError.message
          });
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          updated_count: updatedOrders.length,
          idempotent_count: idempotentCount,
          total_processed: foundOrders.length,
          orders: ordersWithDetails
        }
      });

    } catch (error) {
      // Rollback on error
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

      logger.error('Bulk update status error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to update order statuses'
      });
    } finally {
      client.release();
    }
  },

  /**
   * Generate invoice for order with HD wallet address generation
   */
  generateInvoice: async (req, res) => {
    console.log('🔵 [createInvoice] START', {
      orderId: req.params.id,
      chain: req.body.chain,
      currency: req.body.currency,
      userId: req.user?.id
    });
    
    try {
      const { id: orderId } = req.params;
      const { chain } = req.body;

      // Map chain names for consistency
      const chainMapping = {
        'BTC': 'BTC',
        'ETH': 'ETH',
        'LTC': 'LTC',
        'USDT': 'USDT_ERC20', // Default USDT to ERC20
        'USDT_ERC20': 'USDT_ERC20',
        'USDT_TRC20': 'USDT_TRC20'
      };

      // Validate chain
      const normalizedChain = chain ? chainMapping[chain.toUpperCase()] : null;
      const supportedChains = ['BTC', 'ETH', 'LTC', 'USDT_ERC20', 'USDT_TRC20'];
      
      console.log('🔵 [createInvoice] Validation:', {
        orderId,
        chain,
        normalizedChain,
        supportedChains
      });

      if (!normalizedChain || !supportedChains.includes(normalizedChain)) {
        console.error('🔴 [createInvoice] ERROR: Invalid chain');
        return res.status(400).json({
          success: false,
          error: `Invalid chain. Supported: ${supportedChains.join(', ')}`
        });
      }

      // Get order
      console.log('🔵 [createInvoice] Fetching order:', orderId);
      const order = await orderQueries.findById(orderId);

      if (!order) {
        console.error('🔴 [createInvoice] ERROR: Order not found');
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }
      
      console.log('🟢 [createInvoice] Order found:', {
        id: order.id,
        buyer_id: order.buyer_id,
        total_price: order.total_price
      });

      // Check ownership
      if (order.buyer_id !== req.user.id) {
        console.error('🔴 [createInvoice] ERROR: Access denied');
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Check if invoice already exists for this order
      console.log('🔵 [createInvoice] Checking for existing invoice...');
      const existingInvoice = await invoiceQueries.findByOrderId(orderId);
      
      if (existingInvoice && existingInvoice.status === 'pending') {
        console.log('🟢 [createInvoice] Existing invoice found, returning:', existingInvoice.id);
        // Return existing pending invoice
        return res.status(200).json({
          success: true,
          data: {
            id: existingInvoice.id,
            address: existingInvoice.address,
            cryptoAmount: parseFloat(existingInvoice.expected_amount),
            chain: existingInvoice.chain,
            currency: existingInvoice.currency,
            expiresAt: existingInvoice.expires_at,
            status: existingInvoice.status
          }
        });
      }
      
      console.log('🔵 [createInvoice] No existing invoice, creating new...');

      // Get next address index for this chain
      console.log('🔵 [createInvoice] Getting next address index for:', normalizedChain);
      const addressIndex = await invoiceQueries.getNextIndex(normalizedChain);
      console.log('🔵 [createInvoice] Address index:', addressIndex);

      // Get xpub from environment
      const xpubKey = `HD_XPUB_${normalizedChain.split('_')[0]}`; // BTC, ETH, LTC, USDT
      const xpub = process.env[xpubKey];
      
      console.log('🔵 [createInvoice] Xpub key:', xpubKey, 'exists:', !!xpub);

      if (!xpub) {
        logger.error(`[Invoice] Missing xpub for ${normalizedChain}: ${xpubKey}`);
        console.error('🔴 [createInvoice] ERROR: Missing xpub');
        return res.status(500).json({
          success: false,
          error: `Payment system not configured for ${normalizedChain}. Please contact support.`
        });
      }

      // Generate unique HD wallet address
      console.log('🔵 [createInvoice] Calling wallet service...');
      const { address, derivationPath } = await generateAddress(
        normalizedChain.split('_')[0], // Remove _ERC20/_TRC20 suffix
        xpub,
        addressIndex
      );
      console.log('🟢 [createInvoice] Wallet generated:', address);

      // Get real-time crypto price
      const priceChain = normalizedChain.startsWith('USDT') ? 'USDT_ERC20' : normalizedChain;
      console.log('🔵 [createInvoice] Fetching crypto price for:', priceChain);
      const cryptoPrice = await getCryptoPrice(priceChain);
      console.log('🔵 [createInvoice] Crypto price:', cryptoPrice);

      if (!cryptoPrice) {
        console.error('🔴 [createInvoice] ERROR: Unable to fetch crypto price');
        return res.status(500).json({
          success: false,
          error: `Unable to fetch ${normalizedChain} price. Please try again later.`
        });
      }

      // Convert USD to crypto amount with proper precision
      const rawCryptoAmount = convertUsdToCrypto(parseFloat(order.total_price), cryptoPrice);
      const cryptoAmount = roundCryptoAmount(rawCryptoAmount, priceChain);
      
      console.log('🔵 [createInvoice] Crypto amount calculation:', {
        usdAmount: order.total_price,
        cryptoPrice,
        rawCryptoAmount,
        roundedCryptoAmount: cryptoAmount
      });

      // Calculate expiration (1 hour from now)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Create invoice in database
      console.log('🔵 [createInvoice] Creating invoice in database...');
      const invoice = await invoiceQueries.create({
        orderId: parseInt(orderId),
        chain: normalizedChain,
        address,
        addressIndex,
        expectedAmount: cryptoAmount,
        currency: normalizedChain,
        webhookSubscriptionId: null, // Will be set by webhook service
        expiresAt
      });
      
      console.log('🟢 [createInvoice] Invoice created in DB:', invoice.id);

      logger.info('[Invoice] Generated', {
        orderId,
        chain: normalizedChain,
        address,
        derivationPath,
        addressIndex,
        cryptoAmount,
        usdAmount: order.total_price,
        cryptoPrice
      });
      
      const responseData = {
        success: true,
        data: {
          id: invoice.id,
          address,
          cryptoAmount,
          chain: normalizedChain,
          currency: normalizedChain,
          usdAmount: parseFloat(order.total_price),
          cryptoPrice,
          expiresAt: invoice.expires_at,
          status: invoice.status
        }
      };
      
      console.log('🟢 [createInvoice] SUCCESS - Returning invoice:', responseData);

      return res.status(200).json(responseData);

    } catch (error) {
      console.error('🔴 [createInvoice] CATCH ERROR:', {
        message: error.message,
        stack: error.stack,
        orderId: req.params.id,
        chain: req.body.chain
      });
      
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {})
        });
      }

      logger.error('Generate invoice error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to generate invoice'
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
