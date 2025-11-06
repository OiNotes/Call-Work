import { shopQueries } from '../models/db.js';
import { dbErrorHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import { validateAddress } from '../services/walletService.js';

/**
 * Wallet Controller
 * Manages crypto wallet addresses for shops
 */
export const walletController = {
  /**
   * Get shop wallet addresses
   */
  getWallets: async (req, res) => {
    try {
      const { shopId } = req.params;

      // Get shop by ID
      const shop = await shopQueries.findById(shopId);

      if (!shop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Verify shop ownership
      if (shop.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only view wallet addresses for your own shops'
        });
      }

      // Return wallet addresses
      return res.status(200).json({
        success: true,
        data: {
          shopId: shop.id,
          shopName: shop.name,
          wallets: {
            btc: shop.wallet_btc || null,
            eth: shop.wallet_eth || null,
            usdt: shop.wallet_usdt || null,
            ltc: shop.wallet_ltc || null
          }
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

      logger.error('Get wallets error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to get wallet addresses'
      });
    }
  },

  /**
   * Update shop wallet addresses
   * WALLET-VALIDATION: Validate all crypto addresses before database update
   */
  updateWallets: async (req, res) => {
    try {
      const { shopId } = req.params;
      const {
        walletBtc,
        walletEth,
        walletUsdt,
        walletLtc
      } = req.body;

      // Check if shop exists
      const existingShop = await shopQueries.findById(shopId);

      if (!existingShop) {
        return res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
      }

      // Verify shop ownership
      if (existingShop.owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only update wallet addresses for your own shops'
        });
      }

      // WALLET-VALIDATION: Validate Bitcoin address
      if (walletBtc && walletBtc.trim()) {
        const isValid = validateAddress(walletBtc.trim(), 'BTC');
        if (!isValid) {
          logger.warn(`[Wallet Validation] Invalid BTC address attempt`, {
            userId: req.user.id,
            shopId: shopId,
            address: walletBtc.substring(0, 8) + '...'
          });
          return res.status(400).json({
            success: false,
            error: `Invalid Bitcoin address format: ${walletBtc}`
          });
        }
      }

      // WALLET-VALIDATION: Validate Ethereum address
      if (walletEth && walletEth.trim()) {
        const isValid = validateAddress(walletEth.trim(), 'ETH');
        if (!isValid) {
          logger.warn(`[Wallet Validation] Invalid ETH address attempt`, {
            userId: req.user.id,
            shopId: shopId,
            address: walletEth.substring(0, 8) + '...'
          });
          return res.status(400).json({
            success: false,
            error: `Invalid Ethereum address format: ${walletEth}`
          });
        }
      }

      // WALLET-VALIDATION: Validate USDT address (ERC20 = Ethereum format)
      if (walletUsdt && walletUsdt.trim()) {
        const isValid = validateAddress(walletUsdt.trim(), 'ETH');
        if (!isValid) {
          logger.warn(`[Wallet Validation] Invalid USDT address attempt`, {
            userId: req.user.id,
            shopId: shopId,
            address: walletUsdt.substring(0, 8) + '...'
          });
          return res.status(400).json({
            success: false,
            error: `Invalid USDT (ERC20) address format: ${walletUsdt}`
          });
        }
      }

      // WALLET-VALIDATION: Validate Litecoin address
      if (walletLtc && walletLtc.trim()) {
        const isValid = validateAddress(walletLtc.trim(), 'LTC');
        if (!isValid) {
          logger.warn(`[Wallet Validation] Invalid LTC address attempt`, {
            userId: req.user.id,
            shopId: shopId,
            address: walletLtc.substring(0, 8) + '...'
          });
          return res.status(400).json({
            success: false,
            error: `Invalid Litecoin address format: ${walletLtc}`
          });
        }
      }

      // Check for duplicate wallet addresses BEFORE updating
      const { query } = await import('../config/database.js');

      if (walletBtc) {
        const duplicateBtc = await query(
          'SELECT id, name FROM shops WHERE wallet_btc = $1 AND id != $2',
          [walletBtc, shopId]
        );
        if (duplicateBtc.rows.length > 0) {
          return res.status(409).json({
            success: false,
            error: `Bitcoin address already used by shop "${duplicateBtc.rows[0].name}"`
          });
        }
      }

      if (walletEth) {
        const duplicateEth = await query(
          'SELECT id, name FROM shops WHERE wallet_eth = $1 AND id != $2',
          [walletEth, shopId]
        );
        if (duplicateEth.rows.length > 0) {
          return res.status(409).json({
            success: false,
            error: `Ethereum address already used by shop "${duplicateEth.rows[0].name}"`
          });
        }
      }

      if (walletUsdt) {
        const duplicateUsdt = await query(
          'SELECT id, name FROM shops WHERE wallet_usdt = $1 AND id != $2',
          [walletUsdt, shopId]
        );
        if (duplicateUsdt.rows.length > 0) {
          return res.status(409).json({
            success: false,
            error: `USDT address already used by shop "${duplicateUsdt.rows[0].name}"`
          });
        }
      }

      if (walletLtc) {
        const duplicateLtc = await query(
          'SELECT id, name FROM shops WHERE wallet_ltc = $1 AND id != $2',
          [walletLtc, shopId]
        );
        if (duplicateLtc.rows.length > 0) {
          return res.status(409).json({
            success: false,
            error: `Litecoin address already used by shop "${duplicateLtc.rows[0].name}"`
          });
        }
      }

      // Build update query dynamically based on provided fields
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (walletBtc !== undefined) {
        updates.push(`wallet_btc = $${paramCount}`);
        values.push(walletBtc || null);
        paramCount++;
      }

      if (walletEth !== undefined) {
        updates.push(`wallet_eth = $${paramCount}`);
        values.push(walletEth || null);
        paramCount++;
      }

      if (walletUsdt !== undefined) {
        updates.push(`wallet_usdt = $${paramCount}`);
        values.push(walletUsdt || null);
        paramCount++;
      }

      if (walletLtc !== undefined) {
        updates.push(`wallet_ltc = $${paramCount}`);
        values.push(walletLtc || null);
        paramCount++;
      }

      // If no updates provided
      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No wallet addresses provided to update'
        });
      }

      // Add updated_at
      updates.push(`updated_at = NOW()`);

      // Add shop ID as last parameter
      values.push(shopId);

      // Execute update query (query already imported above)
      const result = await query(
        `UPDATE shops
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING id, name, wallet_btc, wallet_eth, wallet_usdt, wallet_ltc, updated_at`,
        values
      );

      const updatedShop = result.rows[0];

      return res.status(200).json({
        success: true,
        data: {
          shopId: updatedShop.id,
          shopName: updatedShop.name,
          wallets: {
            btc: updatedShop.wallet_btc || null,
            eth: updatedShop.wallet_eth || null,
            usdt: updatedShop.wallet_usdt || null,
            ltc: updatedShop.wallet_ltc || null
          },
          updatedAt: updatedShop.updated_at
        },
        message: 'Wallet addresses updated successfully'
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

      logger.error('Update wallets error', { error: error.message, stack: error.stack });
      return res.status(500).json({
        success: false,
        error: 'Failed to update wallet addresses'
      });
    }
  }
};

export default walletController;
