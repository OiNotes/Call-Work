import { productQueries, shopQueries, workerQueries } from '../database/queries/index.js';
import { dbErrorHandler, asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { broadcast } from '../utils/websocket.js';
import { getClient } from '../config/database.js';

/**
 * Helper: Check if user is authorized to manage shop products
 * (owner OR worker)
 */
async function isAuthorizedToManageShop(shopId, userId) {
  const shop = await shopQueries.findById(shopId);
  if (!shop) {
    return false;
  }

  // Check if owner
  if (shop.owner_id === userId) {
    return true;
  }

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
  create: asyncHandler(async (req, res) => {
    try {
      const { shopId, name, description, price, is_preorder } = req.body;
      const stockQuantity = req.body.stockQuantity ?? req.body.stock ?? 0;
      // Currency is now legacy field - products are priced in USD only
      const currency = req.body.currency || 'USD';

      // Verify shop exists and user is authorized (owner OR worker)
      const shop = await shopQueries.findById(shopId);

      if (!shop) {
        throw new NotFoundError('Shop');
      }

      // Check authorization: owner OR worker
      const isOwner = shop.owner_id === req.user.id;
      const isWorker = isOwner
        ? false
        : !!(await workerQueries.findByShopAndUser(shopId, req.user.id));

      if (!isOwner && !isWorker) {
        throw new UnauthorizedError('You can only add products to shops you own or manage as a worker');
      }

      const product = await productQueries.create({
        shopId,
        name,
        description,
        price,
        currency,
        stockQuantity,
        isPreorder: is_preorder,
      });

      return res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {}),
        });
      }

      logger.error('Create product error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),


  /**
   * Get product by ID
   */
  getById: asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      const product = await productQueries.findById(id);

      if (!product) {
        throw new NotFoundError('Product');
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
        time_left:
          discountActive && product.discount_expires_at
            ? new Date(product.discount_expires_at).getTime() - now.getTime()
            : null,
      };

      return res.status(200).json({
        success: true,
        data: enrichedProduct,
      });
    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {}),
        });
      }

      logger.error('Get product error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),


  /**
   * List products with filters
   */
  list: asyncHandler(async (req, res) => {
    try {
      const page = Number.parseInt(req.query.page, 10) || 1;
      if (!Number.isInteger(page) || page <= 0) {
        throw new ValidationError('Invalid page parameter');
      }

      const limit = Number.parseInt(req.query.limit, 10) || 50;
      if (!Number.isInteger(limit) || limit <= 0 || limit > 1000) {
        throw new ValidationError('Invalid limit parameter (must be 1-1000)');
      }

      const offset = (page - 1) * limit;

      const filters = {
        shopId: req.query.shopId
          ? (() => {
              const id = Number.parseInt(req.query.shopId, 10);
              return Number.isInteger(id) && id > 0 ? id : undefined;
            })()
          : undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : true,
        limit,
        offset,
      };

      logger.info('[Products List] Request:', {
        shopId: filters.shopId,
        isActive: filters.isActive,
        limit: filters.limit,
        offset: filters.offset,
        userId: req.user?.id,
      });

      const products = await productQueries.list(filters);

      logger.info('[Products List] Results:', {
        count: products.length,
        shopId: filters.shopId,
        productIds: products.map((p) => p.id),
      });

      // Enrich products with discount info
      const enrichedProducts = products.map((product) => {
        const now = new Date();
        const hasDiscount = product.discount_percentage > 0;
        const isExpired =
          product.discount_expires_at && new Date(product.discount_expires_at) < now;
        const discountActive = hasDiscount && !isExpired;

        return {
          ...product,
          discount_active: discountActive,
          discounted_price: product.price, // Current price (already discounted)
          time_left:
            discountActive && product.discount_expires_at
              ? new Date(product.discount_expires_at).getTime() - now.getTime()
              : null,
        };
      });

      return res.status(200).json({
        success: true,
        data: enrichedProducts,
        pagination: {
          page,
          limit,
          total: enrichedProducts.length,
        },
      });
    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {}),
        });
      }

      logger.error('List products error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),


  /**
   * Update product
   */
  update: asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, isActive, is_preorder } = req.body;
      const stockQuantity = req.body.stockQuantity ?? req.body.stock;
      const discountPercentage = req.body.discountPercentage ?? req.body.discount_percentage;
      const discountExpiresAt = req.body.discountExpiresAt ?? req.body.discount_expires_at;
      const originalPrice = req.body.originalPrice ?? req.body.original_price;

      // Check if product exists
      const existingProduct = await productQueries.findById(id);

      if (!existingProduct) {
        throw new NotFoundError('Product');
      }

      // Check authorization via shop (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(existingProduct.shop_id, req.user.id);
      if (!isAuthorized) {
        throw new UnauthorizedError('You can only update products in shops you own or manage as a worker');
      }

      const product = await productQueries.update(id, {
        name,
        description,
        price,
        stockQuantity,
        isActive,
        discountPercentage,
        discountExpiresAt,
        originalPrice,
        isPreorder: is_preorder,
      });

      // Broadcast product update to WebSocket clients for real-time sync
      broadcast('product:updated', {
        shopId: product.shop_id,
        product,
      });

      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {}),
        });
      }

      logger.error('Update product error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),


  /**
   * Delete product
   */
  delete: asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;

      // Check if product exists
      const existingProduct = await productQueries.findById(id);

      if (!existingProduct) {
        throw new NotFoundError('Product');
      }

      // Check authorization via shop (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(existingProduct.shop_id, req.user.id);
      if (!isAuthorized) {
        throw new UnauthorizedError('You can only delete products in shops you own or manage as a worker');
      }

      await productQueries.delete(id);

      return res.status(200).json({
        success: true,
        message: 'Product deleted successfully',
      });
    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {}),
        });
      }

      logger.error('Delete product error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),


  /**
   * Bulk delete all products from a shop
   */
  bulkDeleteAll: asyncHandler(async (req, res) => {
    try {
      const { shopId } = req.body;

      // Verify shop exists and user is authorized
      const shop = await shopQueries.findById(shopId);

      if (!shop) {
        throw new NotFoundError('Shop');
      }

      // Check authorization (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(shopId, req.user.id);
      if (!isAuthorized) {
        throw new UnauthorizedError('You can only delete products from shops you own or manage as a worker');
      }

      const deletedProducts = await productQueries.bulkDeleteByShopId(shopId);

      return res.status(200).json({
        success: true,
        message: `${deletedProducts.length} product(s) deleted successfully`,
        data: {
          deletedCount: deletedProducts.length,
          deletedProducts,
        },
      });
    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {}),
        });
      }

      logger.error('Bulk delete all products error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),


  /**
   * Bulk delete specific products by IDs
   */
  bulkDeleteByIds: asyncHandler(async (req, res) => {
    try {
      const { shopId, productIds } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new ValidationError('productIds must be a non-empty array');
      }

      // Verify shop exists and user is authorized
      const shop = await shopQueries.findById(shopId);

      if (!shop) {
        throw new NotFoundError('Shop');
      }

      // Check authorization (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(shopId, req.user.id);
      if (!isAuthorized) {
        throw new UnauthorizedError('You can only delete products from shops you own or manage as a worker');
      }

      const deletedProducts = await productQueries.bulkDeleteByIds(productIds, shopId);

      return res.status(200).json({
        success: true,
        message: `${deletedProducts.length} product(s) deleted successfully`,
        data: {
          deletedCount: deletedProducts.length,
          deletedProducts,
        },
      });
    } catch (error) {
      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
          ...(handledError.details ? { details: handledError.details } : {}),
        });
      }

      logger.error('Bulk delete products error', { error: error.message, stack: error.stack });
      throw error;
    }
  }),


  /**
   * Apply bulk discount to all products in a shop
   */
  applyBulkDiscount: asyncHandler(async (req, res) => {
    const client = await getClient();

    try {
      const { percentage, type, duration, excluded_product_ids = [] } = req.body;
      const shopId = req.body.shopId || req.user?.shopId;

      // Validation
      if (!shopId) {
        throw new ValidationError('Shop ID required');
      }

      // Validate excluded_product_ids is array
      if (!Array.isArray(excluded_product_ids)) {
        throw new ValidationError('excluded_product_ids must be array');
      }

      if (!percentage || percentage < 0 || percentage > 100) {
        throw new ValidationError('Discount percentage must be between 0 and 100');
      }

      if (!['permanent', 'timer'].includes(type)) {
        throw new ValidationError('Type must be "permanent" or "timer"');
      }

      if (type === 'timer' && !duration) {
        throw new ValidationError('Duration required for timer discount');
      }

      // Check authorization (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(shopId, req.user.id);
      if (!isAuthorized) {
        throw new UnauthorizedError('You can only apply discounts to shops you own or manage as a worker');
      }

      // Begin transaction for bulk discount with row-level locks
      await client.query('BEGIN');
      logger.info('applyBulkDiscount: Transaction started', { shopId, percentage, type });

      // Apply discount with transaction client
      const result = await productQueries.applyBulkDiscount(
        shopId,
        {
          percentage,
          type,
          duration: duration || null,
          excludedProductIds: excluded_product_ids,
        },
        client
      );

      // Commit transaction
      await client.query('COMMIT');
      logger.info('applyBulkDiscount: Transaction committed', {
        shopId,
        percentage,
        type,
        productsUpdated: result.productsUpdated,
        productsExcluded: result.productsExcluded,
      });

      return res.status(200).json({
        success: true,
        data: {
          productsUpdated: result.productsUpdated,
          productsExcluded: result.productsExcluded,
          products: result.updatedProducts,
        },
      });
    } catch (error) {
      // Rollback on error
      try {
        await client.query('ROLLBACK');
        logger.warn('applyBulkDiscount: Transaction rolled back', { error: error.message });
      } catch (rollbackError) {
        logger.error('applyBulkDiscount: Rollback failed', { error: rollbackError.message });
      }

      logger.error('Apply bulk discount error', {
        error: error.message,
        stack: error.stack,
      });

      if (error.code) {
        const handledError = dbErrorHandler(error);
        return res.status(handledError.statusCode).json({
          success: false,
          error: handledError.message,
        });
      }

      throw error;
    } finally {
      // Always release client
      client.release();
      logger.debug('applyBulkDiscount: Client released');
    }
  }),


  /**
   * Remove bulk discount from all products in a shop
   */
  removeBulkDiscount: asyncHandler(async (req, res) => {
    const client = await getClient();

    try {
      const shopId = req.body.shopId || req.user?.shopId;

      if (!shopId) {
        throw new ValidationError('Shop ID required');
      }

      // Check authorization (owner OR worker)
      const isAuthorized = await isAuthorizedToManageShop(shopId, req.user.id);
      if (!isAuthorized) {
        throw new UnauthorizedError('You can only remove discounts from shops you own or manage as a worker');
      }

      // Begin transaction for bulk discount removal with row-level locks
      await client.query('BEGIN');
      logger.info('removeBulkDiscount: Transaction started', { shopId });

      const products = await productQueries.removeBulkDiscount(shopId, client);

      // Commit transaction
      await client.query('COMMIT');
      logger.info('removeBulkDiscount: Transaction committed', {
        shopId,
        productsCount: products.length,
      });

      return res.status(200).json({
        success: true,
        data: {
          productsUpdated: products.length,
          products,
        },
      });
    } catch (error) {
      // Rollback on error
      try {
        await client.query('ROLLBACK');
        logger.warn('removeBulkDiscount: Transaction rolled back', { error: error.message });
      } catch (rollbackError) {
        logger.error('removeBulkDiscount: Rollback failed', { error: rollbackError.message });
      }

      logger.error('Remove bulk discount error', {
        error: error.message,
      });

      throw error;
    } finally {
      // Always release client
      client.release();
      logger.debug('removeBulkDiscount: Client released');
    }
  }),


  /**
   * Bulk update specific products by IDs
   * Uses PostgreSQL transaction to ensure atomicity
   */
  bulkUpdateProducts: asyncHandler(async (req, res) => {
    const client = await getClient();

    try {
      const { updates } = req.body;
      const userId = req.user.id;

      // Validation
      if (!Array.isArray(updates) || updates.length === 0) {
        throw new ValidationError('updates must be a non-empty array');
      }

      // Maximum 50 products per request
      if (updates.length > 50) {
        throw new ValidationError('Maximum 50 products per request');
      }

      // Get user's shop
      const shops = await shopQueries.findByOwnerId(userId);
      if (!shops || shops.length === 0) {
        throw new NotFoundError('Shop');
      }
      const shopId = shops[0].id;

      // Begin transaction
      await client.query('BEGIN');
      logger.info('bulkUpdateProducts: Transaction started', {
        userId,
        shopId,
        productsCount: updates.length,
      });

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
              error,
            });
            failCount++;
            // Rollback на первой же ошибке
            throw new Error(error);
          }

          // Check that product belongs to shop (with row-level lock to prevent race conditions)
          const productResult = await client.query(
            'SELECT id, shop_id FROM products WHERE id = $1 FOR UPDATE',
            [productId]
          );
          const product = productResult.rows[0];
          if (!product) {
            const error = `Product not found: ${productId}`;
            logger.warn('bulkUpdateProducts: product not found', { productId, userId });
            results.push({
              productId,
              success: false,
              error: 'Product not found',
            });
            failCount++;
            throw new Error(error);
          }

          // Check authorization via shop (owner OR worker)
          const isAuthorized = await isAuthorizedToManageShop(product.shop_id, userId);
          if (!isAuthorized) {
            const error = `Access denied for product ${productId}`;
            logger.warn('bulkUpdateProducts: access denied', {
              productId,
              userId,
              shopId: product.shop_id,
            });
            results.push({
              productId,
              success: false,
              error: 'Access denied',
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
            originalPrice,
            isPreorder,
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
            discountExpiresAt ?? null,
            isPreorder ?? null,
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
                 is_preorder = COALESCE($10::BOOLEAN, is_preorder),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING id, shop_id, name, description, price, currency, stock_quantity, original_price, discount_percentage, discount_expires_at, is_active, is_preorder, created_at, updated_at`,
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
            success: true,
          });
          successCount++;

          logger.debug('bulkUpdateProducts: product updated', {
            productId,
            shopId: updated.shop_id,
          });
        } catch (error) {
          logger.error('bulkUpdateProducts: error for product', {
            productId: item.productId,
            error: error.message,
            stack: error.stack,
          });

          // При любой ошибке - rollback всей транзакции
          await client.query('ROLLBACK');
          logger.warn('bulkUpdateProducts: Transaction rolled back', {
            userId,
            shopId,
            failedProductId: item.productId,
            error: error.message,
          });

          return res.status(500).json({
            success: false,
            error: `Bulk update failed: ${error.message}`,
            details: {
              failedProductId: item.productId,
              processedCount: successCount + failCount,
            },
          });
        }
      }

      // Commit transaction
      await client.query('COMMIT');
      logger.info('bulkUpdateProducts: Transaction committed', {
        userId,
        shopId,
        successCount,
        failCount,
      });

      // Broadcast updates via WebSocket AFTER successful commit
      updatedProducts.forEach((product) => {
        broadcast('product:updated', {
          shopId: product.shop_id,
          product,
        });
      });

      return res.status(200).json({
        success: true,
        data: {
          updated: successCount,
          failed: failCount,
          results,
        },
      });
    } catch (error) {
      // Rollback если ошибка произошла вне цикла
      try {
        await client.query('ROLLBACK');
        logger.warn('bulkUpdateProducts: Transaction rolled back (outer catch)', {
          error: error.message,
        });
      } catch (rollbackError) {
        logger.error('bulkUpdateProducts: Rollback failed', { error: rollbackError.message });
      }

      logger.error('bulkUpdateProducts error', {
        error: error.message,
        stack: error.stack,
      });

      throw error;
    } finally {
      // Always release client
      client.release();
      logger.debug('bulkUpdateProducts: Client released');
    }
  }),
};
