import { shopQueries } from '../models/db.js';
import { dbErrorHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { activatePromoSubscription } from '../services/subscriptionService.js';

const PROMO_CODE = 'comi9999';

/**
 * Shop Controller
 */
export const shopController = {
  /**
   * Create new shop
   * Any user can create a shop - they become a seller by creating one
   */
  create: async (req, res) => {
    try {
      const { name, description, logo, promoCode, tier = 'basic', subscriptionId } = req.body;
      const normalizedPromo = promoCode?.trim().toLowerCase();
      const wantsPro = tier === 'pro';

      logger.info('[ShopController] Creating shop:', {
        userId: req.user.id,
        name,
        tier,
        subscriptionId
      });

      // Validate tier
      if (!['basic', 'pro'].includes(tier)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tier. Must be "basic" or "pro"'
        });
      }

      // Check if user already has a shop
      const existingShops = await shopQueries.findByOwnerId(req.user.id);
      if (existingShops.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'User already has a shop'
        });
      }

      // Validate shop name
      if (!name || name.trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Shop name must be at least 3 characters'
        });
      }

      // Check if shop name is already taken
      const nameTaken = await shopQueries.isNameTaken(name);
      if (nameTaken) {
        return res.status(409).json({
          success: false,
          error: 'Shop name already taken. Try another one'
        });
      }

      // Handle subscription-based creation
      if (subscriptionId) {
        const pool = (await import('../config/database.js')).default;
        const client = await pool.connect();

        try {
          await client.query('BEGIN');

          // Verify subscription exists and belongs to user
          const subscriptionCheck = await client.query(
            `SELECT id, tier, status, user_id, shop_id
             FROM shop_subscriptions
             WHERE id = $1`,
            [subscriptionId]
          );

          if (subscriptionCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
              success: false,
              error: 'Subscription not found'
            });
          }

          const subscription = subscriptionCheck.rows[0];

          // Verify subscription belongs to user
          if (subscription.user_id !== req.user.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({
              success: false,
              error: 'Subscription belongs to another user'
            });
          }

          // Verify subscription is paid
          if (subscription.status !== 'paid') {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: `Subscription not paid yet (status: ${subscription.status})`
            });
          }

          // Verify subscription not already linked
          if (subscription.shop_id !== null) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: 'Subscription already linked to a shop'
            });
          }

          // Create shop
          const shopResult = await client.query(
            `INSERT INTO shops
             (owner_id, name, description, logo, tier, subscription_status, is_active, registration_paid)
             VALUES ($1, $2, $3, $4, $5, 'active', true, true)
             RETURNING *`,
            [req.user.id, name.trim(), description, logo, subscription.tier]
          );

          const shop = shopResult.rows[0];

          // Link subscription to shop
          await client.query(
            `UPDATE shop_subscriptions
             SET shop_id = $1
             WHERE id = $2`,
            [shop.id, subscriptionId]
          );

          await client.query('COMMIT');

          logger.info('[ShopController] Shop created and linked to subscription:', {
            shopId: shop.id,
            subscriptionId,
            userId: req.user.id
          });

          return res.status(201).json({
            success: true,
            data: shop
          });

        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }

      // Handle promo code creation (existing flow)
      if (wantsPro && normalizedPromo !== PROMO_CODE) {
        return res.status(402).json({
          success: false,
          error: 'PRO plan requires payment or valid promo code'
        });
      }

      let shop = await shopQueries.create({
        ownerId: req.user.id,
        name,
        description,
        logo,
        tier
      });

      if (wantsPro) {
        if (normalizedPromo === PROMO_CODE) {
          try {
            shop = await activatePromoSubscription(shop.id, req.user.id, normalizedPromo);
          logger.info(`Promo code applied for shop ${shop.id} by user ${req.user.id}`);
        } catch (promoError) {
          logger.error('Promo activation failed', { error: promoError.message, stack: promoError.stack });

          // Check if it's idempotency error (promo already used)
          if (promoError.message === 'Promo code already used by this user') {
            return res.status(409).json({
              success: false,
              error: 'This promo code has already been used by your account'
            });
          }

          try {
            await shopQueries.delete(shop.id);
          } catch (cleanupError) {
            logger.error('Failed to rollback shop after promo failure', { error: cleanupError.message, stack: cleanupError.stack });
          }
          return res.status(500).json({
            success: false,
            error: 'Failed to apply promo code. Shop was not created.'
          });
        }
        }
      }

      return res.status(201).json({
        success: true,
        data: shop
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

      logger.error('Create shop error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to create shop'
      });
    }
  },

  /**
   * Get shop by ID
   */
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const shop = await shopQueries.findById(id);

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: shop
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

      logger.error('Get shop error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get shop'
      });
    }
  },

  /**
   * Get shops by seller (current user)
   * Any user can check if they have shops - having a shop makes them a seller
   */
  getMyShops: async (req, res) => {
    try {
      const shops = await shopQueries.findByOwnerId(req.user.id);

      return res.status(200).json({
        success: true,
        data: shops
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

      logger.error('Get my shops error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get shops'
      });
    }
  },

  /**
   * Update shop
   */
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, logo, isActive } = req.body;

      // Check if shop exists and belongs to user
      const existingShop = await shopQueries.findById(id);

      if (!existingShop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      if (existingShop.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only update your own shops'
        });
      }

      // Check if new name is already taken (if name is being updated)
      if (name && name !== existingShop.name) {
        const nameTaken = await shopQueries.isNameTaken(name, id);
        if (nameTaken) {
          return res.status(409).json({
            success: false,
            error: 'Shop name already taken. Try another one'
          });
        }
      }

      const shop = await shopQueries.update(id, {
        name,
        description,
        logo,
        isActive
      });

      return res.status(200).json({
        success: true,
        data: shop
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

      logger.error('Update shop error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to update shop'
      });
    }
  },

  /**
   * Delete shop
   */
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if shop exists and belongs to user
      const existingShop = await shopQueries.findById(id);

      if (!existingShop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      if (existingShop.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own shops'
        });
      }

      await shopQueries.delete(id);

      return res.status(200).json({
        success: true,
        message: 'Shop deleted successfully'
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

      logger.error('Delete shop error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to delete shop'
      });
    }
  },

  /**
   * List all active shops
   */
  listActive: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const offset = (page - 1) * limit;

      const shops = await shopQueries.listActive(limit, offset);

      return res.status(200).json({
        success: true,
        data: shops,
        pagination: {
          page,
          limit,
          total: shops.length
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

      logger.error('List shops error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to list shops'
      });
    }
  },

  /**
   * Search active shops by name
   */
  search: async (req, res) => {
    try {
      const term = (req.query.q || req.query.query || '').trim();

      if (term.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters long'
        });
      }

      const limit = parseInt(req.query.limit, 10) || 10;
      const shops = await shopQueries.searchByName(
        term,
        limit,
        req.user?.id ?? null
      );

      return res.status(200).json({
        success: true,
        data: shops
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

      logger.error('Search shops error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to search shops'
      });
    }
  },

  /**
   * Get shop wallets
   */
  getWallets: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if shop exists and belongs to user
      const shop = await shopQueries.findById(id);

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      if (shop.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only view your own shop wallets'
        });
      }

      // Return wallet data
      return res.status(200).json({
        success: true,
        data: {
          wallet_btc: shop.wallet_btc || null,
          wallet_eth: shop.wallet_eth || null,
          wallet_usdt: shop.wallet_usdt || null,
          wallet_ton: shop.wallet_ton || null,
          updated_at: shop.updated_at
        }
      });

    } catch (error) {
      logger.error('Get wallets error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get wallets'
      });
    }
  },

  /**
   * Update shop wallets
   */
  updateWallets: async (req, res) => {
    try {
      const { id } = req.params;
      const { wallet_btc, wallet_eth, wallet_usdt, wallet_ton } = req.body;

      // Check if shop exists and belongs to user
      const existingShop = await shopQueries.findById(id);

      if (!existingShop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      if (existingShop.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only update your own shop wallets'
        });
      }

      // Build update object (only include provided fields)
      const walletUpdates = {};
      if (wallet_btc !== undefined) {walletUpdates.wallet_btc = wallet_btc;}
      if (wallet_eth !== undefined) {walletUpdates.wallet_eth = wallet_eth;}
      if (wallet_usdt !== undefined) {walletUpdates.wallet_usdt = wallet_usdt;}
      if (wallet_ton !== undefined) {walletUpdates.wallet_ton = wallet_ton;}

      // Update wallets
      const shop = await shopQueries.updateWallets(id, walletUpdates);

      return res.status(200).json({
        success: true,
        data: {
          wallet_btc: shop.wallet_btc || null,
          wallet_eth: shop.wallet_eth || null,
          wallet_usdt: shop.wallet_usdt || null,
          wallet_ton: shop.wallet_ton || null
        }
      });

    } catch (error) {
      logger.error('Update wallets error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to update wallets'
      });
    }
  }
};

export default shopController;
