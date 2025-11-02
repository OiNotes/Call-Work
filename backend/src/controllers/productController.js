import { productQueries, shopQueries, workerQueries } from '../models/db.js';
import { dbErrorHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

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
        isActive
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
      const { percentage, type, duration } = req.body;
      const shopId = req.body.shopId || req.user?.shopId;

      // Validation
      if (!shopId) {
        return res.status(400).json({
          success: false,
          error: 'Shop ID required'
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
      const products = await productQueries.applyBulkDiscount(shopId, {
        percentage,
        type,
        duration: duration || null
      });

      logger.info('Bulk discount applied', {
        shopId,
        percentage,
        type,
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
  }
};

export default productController;
