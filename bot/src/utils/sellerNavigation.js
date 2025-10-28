import { sellerMenu, sellerMenuNoShop, sellerToolsMenu } from '../keyboards/seller.js';
import { shopApi, orderApi } from './api.js';
import * as smartMessage from './smartMessage.js';
import logger from './logger.js';
import { messages } from '../texts/messages.js';

const { seller: sellerMessages, general: generalMessages } = messages;

const formatDate = (dateValue) => {
  if (!dateValue) {
    return null;
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split('T')[0];
};

export const showSellerMainMenu = async (ctx) => {
  try {
    if (!ctx.session.token) {
      await smartMessage.send(ctx, {
        text: generalMessages.authorizationRequired,
        keyboard: sellerMenuNoShop
      });
      return false;
    }

    let shopId = ctx.session.shopId;
    let shopName = ctx.session.shopName;

    if (!shopId) {
      const shops = await shopApi.getMyShop(ctx.session.token);
      if (!Array.isArray(shops) || shops.length === 0) {
        await smartMessage.send(ctx, {
          text: sellerMessages.noShop,
          keyboard: sellerMenuNoShop
        });
        return false;
      }
      const [shop] = shops;
      shopId = shop.id;
      shopName = shop.name;
      ctx.session.shopId = shopId;
      ctx.session.shopName = shopName;
      ctx.session.shopTier = shop.tier;
      ctx.session.isShopOwner = true;
    }

    let weekRevenue = 0;
    try {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);

      const analytics = await orderApi.getAnalytics(
        shopId,
        formatDate(weekAgo) || weekAgo.toISOString().split('T')[0],
        formatDate(today) || today.toISOString().split('T')[0],
        ctx.session.token
      );
      weekRevenue = analytics?.summary?.totalRevenue || 0;
    } catch (analyticsError) {
      logger.warn('Failed to fetch weekly analytics for seller menu', {
        error: analyticsError.message
      });
    }

    let activeCount = 0;
    try {
      activeCount = await orderApi.getActiveOrdersCount(shopId, ctx.session.token);
    } catch (countError) {
      logger.warn('Failed to fetch active orders count for seller menu', {
        error: countError.message
      });
    }

    const header = sellerMessages.shopPanelWithStats(shopName || 'Магазин', weekRevenue, activeCount);
    await smartMessage.send(ctx, {
      text: header,
      keyboard: sellerMenu(activeCount)
    });
    return true;
  } catch (error) {
    logger.error('Error showing seller main menu:', error);
    await smartMessage.send(ctx, {
      text: generalMessages.actionFailed,
      keyboard: sellerMenuNoShop
    });
    return false;
  }
};

export const showSellerToolsMenu = async (ctx, isOwnerOverride = null) => {
  try {
    const isOwner = isOwnerOverride ?? ctx.session.isShopOwner ?? false;
    await smartMessage.send(ctx, {
      text: sellerMessages.toolsIntro,
      keyboard: sellerToolsMenu(isOwner)
    });
    return true;
  } catch (error) {
    logger.error('Error showing seller tools menu:', error);
    await smartMessage.send(ctx, {
      text: generalMessages.actionFailed,
      keyboard: sellerMenuNoShop
    });
    return false;
  }
};
