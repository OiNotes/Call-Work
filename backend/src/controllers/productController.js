import { productQueries, shopQueries, workerQueries } from '../models/db.js';
import { dbErrorHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { broadcast } from '../utils/websocket.js';
import { getClient } from '../config/database.js';

/**
 * Helper: Check if user is authorized to manage shop products
 * (owner OR worker)
 */
async function isAuthorizedToManageShop(shopId, userId) {
  const shop = await shopQueries.findById(shopId);
  if (!shop) {return false;}

  // Check if owner
  if (shop.owner_id === userId) {return true;}

  // Check if worker
  const worker = await workerQueries.findByShopAndUser(shopId, userId);
  return !!worker;
}

/**
 * Product Controller
 */
export const productController = {
  /**
   * Create new product
   */
  create: async (req, res) => {
    try {
      const {
        shopId,
        name,
        description,
        price
      } = req.body;
      const stockQuantity = req.body.stockQuantity ?? req.body.stock ?? 0;
      // Currency is now legacy field - products are priced in USD only
      const currency = req.body.currency || 'USD';

      // Verify shop exists and user is authorized (owner OR worker)
      const shop = await shopQueries.findById(shopId);

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Check authorization: owner OR worker
      const isOwner = shop.owner_id === req.user.id;
      const isWorker = isOwner ? false : !!(await workerQueries.findByShopAndUser(shopId, req.user.id));

      if (!isOwner && !isWorker) {
        return res.status(403).json({
          success: false,
          error: 'You can only add products to shops you own or manage as a worker'
        });
      }

      const product = await productQueries.create({
        shopId,
        name,
        description,
        price,
        currency,
        stockQuantity
      });

      return res.status(201).json({
        success: true,
        data: product
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

      logger.error('Create product error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to create product'
      });
    }
  },

  /**
   * Get product by ID
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const product = await productQueries.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      // Enrich product with discount info
      const now = new Date();
      const hasDiscount = product.discount_percentage > 0;
      const isExpired = product.discount_expires_at && new Date(product.discount_expires_at) < now;
      const discountActive = hasDiscount && !isExpired;

      const enrichedProduct = {
        ...product,
        discount_active: discountActive,
        discounted_price: product.price, // Current price (already discounted)
        time_left: discountActive && product.discount_expires_at
          ? new Date(product.discount_expires_at).getTime() - now.getTime()
          : null
      };

      return res.status(200).json({
        success: true,
        data: enrichedProduct
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

      logger.error('Get product error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get product'
      });
    }
  },

  /**
   * List products with filters
   */
  list: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      const filters = {
        shopId: req.query.shopId ? parseInt(req.query.shopId) : undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : true,
        limit,
        offset
      };

      logger.info('[Products List] Request:', {
        shopId: filters.shopId,
        isActive: filters.isActive,
        limit: filters.limit,
        offset: filters.offset,
        userId: req.user?.id
      });

      const products = await productQueries.list(filters);

      logger.info('[Products List] Results:', {
      count: products.length,
      shopId: filters.shopId,
      productIds: products.map(p => p.id)
      });

      // Enrich products with discount info
      const enrichedProducts = products.map(product => {
      const now = new Date();
      const hasDiscount = product.discount_percentage > 0;
      const isExpired = product.discount_expires_at && new Date(product.discount_expires_at) < now;
      const discountActive = hasDiscount && !isExpired;

      return {
          ...product,
        discount_active: discountActive,
        discounted_price: product.price, // Current price (already discounted)
        time_left: discountActive && product.discount_expires_at
          ? new Date(product.discount_expires_at).getTime() - now.getTime()
          : null
      };
    });

    return res.status(200).json({
      success: true,
      data: enrichedProducts,
      pagination: {
        page,
        limit,
        total: enrichedProducts.length
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

      logger.error('List products error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to list products'
      });
    }
  },

  /**
   * Update product
   */
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        price,
        isActive
      } = req.body;
      const stockQuantity = req.body.stockQuantity ?? req.body.stock;
      const discountPercentage = req.body.discountPercentage ?? req.body.discount_percentage;
      const discountExpiresAt = req.body.discountExpiresAt ?? req.body.discount_expires_at;
      const originalPrice = req.body.originalPrice ?? req.body.original_price;

      // Check if product exists
      const existingProduct = await productQueries.findById(id);

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      // Check authorization via shop (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(existingProduct.shop_id, req.user.id);
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'You can only update products in shops you own or manage as a worker'
        });
      }

      const product = await productQueries.update(id, {
        name,
        description,
        price,
        stockQuantity,
        isActive,
        discountPercentage,
        discountExpiresAt,
        originalPrice
      });

      // Broadcast product update to WebSocket clients for real-time sync
      broadcast('product:updated', {
        shopId: product.shop_id,
        product
      });

      return res.status(200).json({
        success: true,
        data: product
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

      logger.error('Update product error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to update product'
      });
    }
  },

  /**
   * Delete product
   */
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if product exists
      const existingProduct = await productQueries.findById(id);

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          error: 'Product not found'
        });
      }

      // Check authorization via shop (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(existingProduct.shop_id, req.user.id);
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete products in shops you own or manage as a worker'
        });
      }

      await productQueries.delete(id);

      return res.status(200).json({
        success: true,
        message: 'Product deleted successfully'
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

      logger.error('Delete product error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to delete product'
      });
    }
  },

  /**
   * Bulk delete all products from a shop
   */
  bulkDeleteAll: async (req, res) => {
    try {
      const { shopId } = req.body;

      // Verify shop exists and user is authorized
      const shop = await shopQueries.findById(shopId);

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Check authorization (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(shopId, req.user.id);
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete products from shops you own or manage as a worker'
        });
      }

      const deletedProducts = await productQueries.bulkDeleteByShopId(shopId);

      return res.status(200).json({
        success: true,
        message: `${deletedProducts.length} product(s) deleted successfully`,
        data: {
          deletedCount: deletedProducts.length,
          deletedProducts
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

      logger.error('Bulk delete all products error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to delete products'
      });
    }
  },

  /**
   * Bulk delete specific products by IDs
   */
  bulkDeleteByIds: async (req, res) => {
    try {
      const { shopId, productIds } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'productIds must be a non-empty array'
        });
      }

      // Verify shop exists and user is authorized
      const shop = await shopQueries.findById(shopId);

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Check authorization (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(shopId, req.user.id);
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete products from shops you own or manage as a worker'
        });
      }

      const deletedProducts = await productQueries.bulkDeleteByIds(productIds, shopId);

      return res.status(200).json({
        success: true,
        message: `${deletedProducts.length} product(s) deleted successfully`,
        data: {
          deletedCount: deletedProducts.length,
          deletedProducts
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

      logger.error('Bulk delete products error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to delete products'
      });
    }
  },

  /**
   * Apply bulk discount to all products in a shop
   */
  applyBulkDiscount: async (req, res) => {
    try {
      const { percentage, type, duration, excluded_product_ids = [] } = req.body;
      const shopId = req.body.shopId || req.user?.shopId;

      // Validation
      if (!shopId) {
        return res.status(400).json({
          success: false,
          error: 'Shop ID required'
        });
      }
      
      // Validate excluded_product_ids is array
      if (!Array.isArray(excluded_product_ids)) {
        return res.status(400).json({
          success: false,
          error: 'excluded_product_ids must be array'
        });
      }

      if (!percentage || percentage < 0 || percentage > 100) {
        return res.status(400).json({
          success: false,
          error: 'Discount percentage must be between 0 and 100'
        });
      }

      if (!['permanent', 'timer'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Type must be "permanent" or "timer"'
        });
      }

      if (type === 'timer' && !duration) {
        return res.status(400).json({
          success: false,
          error: 'Duration required for timer discount'
        });
      }

      // Check authorization (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(shopId, req.user.id);
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'You can only apply discounts to shops you own or manage as a worker'
        });
      }

      // Apply discount
      const result = await productQueries.applyBulkDiscount(shopId, {
        percentage,
        type,
        duration: duration || null,
        excludedProductIds: excluded_product_ids
      });

      logger.info('Bulk discount applied', {
        shopId,
        percentage,
        type,
        productsUpdated: result.productsUpdated,
        productsExcluded: result.productsExcluded
      });

      return res.status(200).json({
        success: true,
        data: {
          productsUpdated: result.productsUpdated,
          productsExcluded: result.productsExcluded,
          products: result.updatedProducts
        }
      });

    } catch (error) {
      logger.error('Apply bulk discount error', {
        error: error.message,
        stack: error.stack
      });

      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to apply bulk discount'
      });
    }
  },

  /**
   * Remove bulk discount from all products in a shop
   */
  removeBulkDiscount: async (req, res) => {
    try {
      const shopId = req.body.shopId || req.user?.shopId;

      if (!shopId) {
        return res.status(400).json({
          success: false,
          error: 'Shop ID required'
        });
      }

      // Check authorization (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(shopId, req.user.id);
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'You can only remove discounts from shops you own or manage as a worker'
        });
      }

      const products = await productQueries.removeBulkDiscount(shopId);

      logger.info('Bulk discount removed', {
        shopId,
        productsCount: products.length
      });

      return res.status(200).json({
        success: true,
        data: {
          productsUpdated: products.length,
          products
        }
      });

    } catch (error) {
      logger.error('Remove bulk discount error', {
        error: error.message
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to remove bulk discount'
      });
    }
  },

  /**
   * Bulk update specific products by IDs
   * Uses PostgreSQL transaction to ensure atomicity
   */
  bulkUpdateProducts: async (req, res) => {
    const client = await getClient();
    
    try {
      const { updates } = req.body;
      const userId = req.user.id;

      // Validation
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'updates must be a non-empty array'
        });
      }

      // Maximum 50 products per request
      if (updates.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 50 products per request'
        });
      }

      // Get user's shop
      const shops = await shopQueries.findByOwnerId(userId);
      if (!shops || shops.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }
      const shopId = shops[0].id;

      // Begin transaction
      await client.query('BEGIN');
      logger.info('bulkUpdateProducts: Transaction started', { userId, shopId, productsCount: updates.length });

      // Update each product within transaction
      const results = [];
      let successCount = 0;
      let failCount = 0;
      const updatedProducts = [];

      for (const item of updates) {
        try {
          const { productId, updates: productUpdates } = item;

          if (!productId) {
            const error = 'productId is required';
            logger.warn('bulkUpdateProducts: validation error', { productId: null, error });
            results.push({
              productId: null,
              success: false,
              error
            });
            failCount++;
            // Rollback на первой же ошибке
            throw new Error(error);
          }

          // Check that product belongs to shop
          const product = await productQueries.findById(productId);
          if (!product) {
            const error = `Product not found: ${productId}`;
            logger.warn('bulkUpdateProducts: product not found', { productId, userId });
            results.push({
              productId,
              success: false,
              error: 'Product not found'
            });
            failCount++;
            throw new Error(error);
          }

          // Check authorization via shop (owner OR worker)
          const isAuthorized = await isAuthorizedToManageShop(product.shop_id, userId);
          if (!isAuthorized) {
            const error = `Access denied for product ${productId}`;
            logger.warn('bulkUpdateProducts: access denied', { productId, userId, shopId: product.shop_id });
            results.push({
              productId,
              success: false,
              error: 'Access denied'
            });
            failCount++;
            throw new Error(error);
          }

          // Update product (using transaction client if productQueries supports it)
          // Since productQueries.update doesn't support client param, use direct SQL
          const {
            name,
            description,
            price,
            stockQuantity,
            isActive,
            discountPercentage,
            discountExpiresAt,
            originalPrice
          } = productUpdates;

          const params = [
            productId,
            name ?? null,
            description ?? null,
            price ?? null,
            stockQuantity ?? null,
            isActive ?? null,
            discountPercentage ?? null,
            originalPrice ?? null,
            discountExpiresAt ?? null
          ];

          const updateResult = await client.query(
            `UPDATE products
             SET name = COALESCE($2, name),
                 description = COALESCE($3, description),
                 price = COALESCE(
                   $4::NUMERIC,
                   CASE
                     WHEN $7::INTEGER = 0 AND original_price IS NOT NULL THEN original_price
                     ELSE price
                   END
                 ),
                 stock_quantity = COALESCE($5::INTEGER, stock_quantity),
                 is_active = COALESCE($6::BOOLEAN, is_active),
                 original_price = CASE
                   WHEN $7::INTEGER = 0 THEN NULL
                   WHEN $8::NUMERIC IS NOT NULL THEN $8
                   ELSE original_price
                 END,
                 discount_percentage = COALESCE($7::INTEGER, discount_percentage),
                 discount_expires_at = CASE
                   WHEN $7::INTEGER = 0 THEN NULL
                   WHEN $9::TIMESTAMP IS NOT NULL THEN $9
                   ELSE discount_expires_at
                 END,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, shop_id, name, description, price, currency, stock_quantity, original_price, discount_percentage, discount_expires_at, is_active, created_at, updated_at`,
            params
          );

          if (updateResult.rows.length === 0) {
            const error = `Failed to update product ${productId}`;
            logger.error('bulkUpdateProducts: update failed', { productId, params });
            throw new Error(error);
          }

          const updated = updateResult.rows[0];
          updatedProducts.push(updated);

          results.push({
            productId,
            success: true
          });
          successCount++;

          logger.debug('bulkUpdateProducts: product updated', { productId, shopId: updated.shop_id });

        } catch (error) {
          logger.error('bulkUpdateProducts: error for product', {
            productId: item.productId,
            error: error.message,
            stack: error.stack
          });
          
          // При любой ошибке - rollback всей транзакции
          await client.query('ROLLBACK');
          logger.warn('bulkUpdateProducts: Transaction rolled back', { 
            userId, 
            shopId, 
            failedProductId: item.productId,
            error: error.message 
          });
          
          return res.status(500).json({
            success: false,
            error: `Bulk update failed: ${error.message}`,
            details: {
              failedProductId: item.productId,
              processedCount: successCount + failCount
            }
          });
        }
      }

      // Commit transaction
      await client.query('COMMIT');
      logger.info('bulkUpdateProducts: Transaction committed', {
        userId,
        shopId,
        successCount,
        failCount
      });

      // Broadcast updates via WebSocket AFTER successful commit
      updatedProducts.forEach(product => {
        broadcast('product:updated', {
          shopId: product.shop_id,
          product
        });
      });

      return res.status(200).json({
        success: true,
        data: {
          updated: successCount,
          failed: failCount,
          results
        }
      });

    } catch (error) {
      // Rollback если ошибка произошла вне цикла
      try {
        await client.query('ROLLBACK');
        logger.warn('bulkUpdateProducts: Transaction rolled back (outer catch)', { error: error.message });
      } catch (rollbackError) {
        logger.error('bulkUpdateProducts: Rollback failed', { error: rollbackError.message });
      }

      logger.error('bulkUpdateProducts error', {
        error: error.message,
        stack: error.stack
      });
      
      return res.status(500).json({
        success: false,
        error: `Database error: ${error.message}`
      });
    } finally {
      // Always release client
      client.release();
      logger.debug('bulkUpdateProducts: Client released');
    }
  }
};
