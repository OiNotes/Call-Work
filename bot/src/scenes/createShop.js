import { Scenes } from 'telegraf';
import { successButtons, cancelButton } from '../keyboards/common.js';
import { shopApi } from '../utils/api.js';
import logger from '../utils/logger.js';
import * as smartMessage from '../utils/smartMessage.js';
import { reply as cleanReply } from '../utils/cleanReply.js';
import { messages } from '../texts/messages.js';

const { seller: sellerMessages, general: generalMessages, start: startMessages } = messages;

/**
 * Create Shop Scene - Simplified (NO PAYMENT)
 * Steps:
 * 1. Enter shop name
 * 2. Complete (create shop with tier/promo from chooseTier scene)
 */

// Step 1: Enter shop name
const enterShopName = async (ctx) => {
  try {
    // Get tier and promo from scene state (passed from chooseTier)
    const sceneState = ctx.scene.state;
    if (sceneState.tier) {
      ctx.wizard.state.tier = sceneState.tier;
    }
    if (sceneState.promoCode) {
      ctx.wizard.state.promoCode = sceneState.promoCode;
    }

    logger.info('shop_create_step:name', {
      userId: ctx.from.id,
      tier: ctx.wizard.state.tier,
      hasPromo: !!ctx.wizard.state.promoCode
    });

    const message = `${sellerMessages.createShopNamePrompt}\n${sellerMessages.createShopNameHint}`;

    await cleanReply(ctx, message, cancelButton);

    return ctx.wizard.next();
  } catch (error) {
    logger.error('Error in enterShopName step:', error);
    throw error;
  }
};

// Step 2: Handle shop name and create shop immediately
const handleShopNameAndCreate = async (ctx) => {
  try {
    // Get shop name from message
    if (!ctx.message || !ctx.message.text) {
      await cleanReply(ctx, sellerMessages.createShopNamePrompt);
      return;
    }

    // Track user message for cleanup
    if (!ctx.wizard.state.userMessageIds) {
      ctx.wizard.state.userMessageIds = [];
    }
    ctx.wizard.state.userMessageIds.push(ctx.message.message_id);

    const shopName = ctx.message.text.trim();

    // Validation: length 3-100 characters
    if (shopName.length < 3 || shopName.length > 100) {
      await cleanReply(ctx, `${sellerMessages.createShopNameInvalidLength}\n${sellerMessages.createShopNameHint}`);
      return;
    }

    const validNamePattern = /^[a-zA-Z0-9_]+$/u;
    if (!validNamePattern.test(shopName)) {
      await cleanReply(ctx, `${sellerMessages.createShopNameInvalidChars}\n${sellerMessages.createShopNameHint}`);
      return;
    }

    // Create shop immediately
    await createShop(ctx, shopName);
  } catch (error) {
    logger.error('Error creating shop:', error);

    await smartMessage.send(ctx, {
      text: sellerMessages.createShopError,
      keyboard: successButtons
    });

    return await ctx.scene.leave();
  }
};

// Helper function to create shop
const createShop = async (ctx, shopName) => {
  let loadingMsg = null;
  try {
    // Get tier and promo from wizard state (set from chooseTier scene)
    const tier = ctx.wizard.state.tier || 'basic';
    const promoCode = ctx.wizard.state.promoCode || '';

    logger.info('shop_create_step:save', {
      userId: ctx.from.id,
      shopName,
      tier,
      promoProvided: Boolean(promoCode)
    });

    if (!ctx.session.token) {
      logger.error('Missing auth token when creating shop', {
        userId: ctx.from.id,
        session: ctx.session
      });

      await cleanReply(
        ctx,
        generalMessages.authorizationRequired,
        successButtons
      );
      return await ctx.scene.leave();
    }

    loadingMsg = await cleanReply(ctx, sellerMessages.createShopSaving);

    const payload = {
      name: shopName,
      description: `Магазин ${shopName}`,
      tier: tier
    };

    if (promoCode) {
      payload.promoCode = promoCode;
    }

    const shop = await shopApi.createShop(payload, ctx.session.token);

    if (!shop || !shop.id) {
      logger.error('Shop creation failed: invalid shop object received', { shop });
      throw new Error('Invalid shop object from API');
    }

    ctx.session.shopId = shop.id;
    ctx.session.shopName = shop.name;

    logger.info('shop_created', {
      shopId: shop.id,
      shopName: shop.name,
      userId: ctx.from.id,
      tier: shop.tier
    });

    try {
      await ctx.deleteMessage(loadingMsg.message_id);
    } catch (error) {
      logger.debug(`Could not delete loading message:`, error.message);
    }

    const tierLabel = shop.tier?.toUpperCase?.() || shop.tier || 'BASIC';
    const successText = promoCode
      ? sellerMessages.createShopPromoSuccess(shop.name)
      : sellerMessages.createShopSuccess(shop.name, tierLabel);

    await smartMessage.send(ctx, {
      text: successText,
      keyboard: successButtons
    });

    return await ctx.scene.leave();
  } catch (error) {
    logger.error('Error creating shop:', error);

    if (loadingMsg) {
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (deleteError) {
        logger.debug(`Could not delete loading message:`, deleteError.message);
      }
    }

    // Parse backend error message
    const errorMsg = error.response?.data?.error || error.message || '';

    // Handle "Shop name already taken" error
    if (errorMsg.toLowerCase().includes('already taken') ||
        errorMsg.toLowerCase().includes('уже занято') ||
        errorMsg.toLowerCase().includes('already exists')) {

      await cleanReply(ctx, sellerMessages.createShopNameTaken);

      // Don't leave scene - allow user to try again
      return;
    }

    // Generic error - leave scene
    await smartMessage.send(ctx, {
      text: sellerMessages.createShopError,
      keyboard: successButtons
    });

    return await ctx.scene.leave();
  }
};

// Create wizard scene (SIMPLIFIED - 2 steps only)
const createShopScene = new Scenes.WizardScene(
  'createShop',
  enterShopName,
  handleShopNameAndCreate
);

// Handle scene leave
createShopScene.leave(async (ctx) => {
  // Delete user messages (shop name input)
  const userMsgIds = ctx.wizard.state.userMessageIds || [];
  for (const msgId of userMsgIds) {
    try {
      await ctx.deleteMessage(msgId);
    } catch (error) {
      // Message may already be deleted or too old
      logger.debug(`Could not delete user message ${msgId}:`, error.message);
    }
  }

  ctx.wizard.state = {};
  logger.info(`User ${ctx.from?.id} left createShop scene`);
});

// Handle cancel action within scene
createShopScene.action('cancel_scene', async (ctx) => {
  try {
    await ctx.answerCbQuery(); // Silent
    logger.info('shop_create_cancelled', { userId: ctx.from.id });

    await ctx.scene.leave();

    // Silent transition - edit message without "Отменено" text
    await ctx.editMessageText(startMessages.welcome, successButtons);
  } catch (error) {
    logger.error('Error in cancel_scene handler:', error);
    // Local error handling - don't throw to avoid infinite spinner
    try {
      await smartMessage.send(ctx, {
        text: generalMessages.actionFailed,
        keyboard: successButtons
      });
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
});

export default createShopScene;
