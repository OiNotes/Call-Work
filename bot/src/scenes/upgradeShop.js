/**
 * Upgrade Shop Scene
 * 
 * Multi-step wizard for upgrading from BASIC to PRO tier
 * 
 * Steps:
 * 1. Show current subscription and upgrade cost (prorated)
 * 2. Select cryptocurrency
 * 3. Show payment address and amount
 * 4. User sends tx_hash
 * 5. Verify payment and upgrade subscription
 */

import { Scenes, Markup } from 'telegraf';
import api from '../utils/api.js';
import logger from '../utils/logger.js';
import * as smartMessage from '../utils/smartMessage.js';
import { reply as cleanReply, replyHTML as cleanReplyHTML } from '../utils/cleanReply.js';
import { messages, buttons as buttonText } from '../texts/messages.js';
import { showSellerMainMenu } from '../utils/sellerNavigation.js';
const { seller: sellerMessages, general: generalMessages } = messages;

// Crypto payment addresses (should match backend)
const PAYMENT_ADDRESSES = {
  BTC: process.env.BTC_PAYMENT_ADDRESS || '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  ETH: process.env.ETH_PAYMENT_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  USDT: process.env.USDT_PAYMENT_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  LTC: process.env.LTC_PAYMENT_ADDRESS || 'LTC1A2B3C4D5E6F7G8H9J0K1L2M3N4P5Q6R'
};

const upgradeShopScene = new Scenes.WizardScene(
  'upgrade_shop',
  
  // Step 1: Show current subscription and upgrade cost
  async (ctx) => {
    try {
      const shopId = ctx.session.shopId;

      if (!shopId) {
        await smartMessage.send(ctx, { text: '❌ Магазин не найден.' });
        return ctx.scene.leave();
      }

      const token = ctx.session.token;
      if (!token) {
        await smartMessage.send(ctx, { text: generalMessages.authorizationRequired });
        return ctx.scene.leave();
      }

      // Get current subscription status
      const statusResponse = await api.get(`/subscriptions/status/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { subscription, shop } = statusResponse.data;

      // Check if already PRO
      if (subscription?.tier === 'pro') {
        await cleanReply(ctx,
          sellerMessages.upgrade.alreadyPro,
          Markup.inlineKeyboard([
            [Markup.button.callback(buttonText.backToMenu, 'seller:menu')]
          ])
        );
        return ctx.scene.leave();
      }

      // Check if has active BASIC subscription
      if (!subscription || subscription.tier !== 'basic' || subscription.status !== 'active') {
        await cleanReply(ctx,
          sellerMessages.upgrade.notEligible,
          Markup.inlineKeyboard([
            [Markup.button.callback(buttonText.paySubscription, 'subscription:pay')],
            [Markup.button.callback(buttonText.backToMenu, 'seller:menu')]
          ])
        );
        return ctx.scene.leave();
      }

      // Get upgrade cost
      const costResponse = await api.get(`/subscriptions/upgrade-cost/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { upgradeCost, remainingDays } = costResponse.data;

      const message = `Улучшить до PRO

Сейчас: BASIC
Доплата: $${upgradeCost.toFixed(2)}

Получите:
• Безлимит товаров (сейчас до 4)
• Автозакуп из других магазинов
• Уведомления подписчикам при смене канала`;

      await cleanReplyHTML(
        ctx,
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback(buttonText.confirm, 'upgrade:confirm')],
          [Markup.button.callback(buttonText.cancel, 'seller:menu')]
        ])
      );

      // Save data for next steps
      ctx.wizard.state.shopId = shopId;
      ctx.wizard.state.shopName = shop.name;
      ctx.wizard.state.upgradeCost = upgradeCost;
      ctx.wizard.state.remainingDays = remainingDays;

      return ctx.wizard.next();
    } catch (error) {
      logger.error('[UpgradeShop] Step 1 error:', error);

      const errorMsg = error.response?.data?.error || error.message;
      await cleanReply(ctx, sellerMessages.upgrade.error(errorMsg), Markup.inlineKeyboard([
        [Markup.button.callback(buttonText.backToMenu, 'seller:menu')]
      ]));

      return ctx.scene.leave();
    }
  },

  // Step 2: Handle confirmation and show crypto options
  async (ctx) => {
    if (!ctx.callbackQuery) {
      return;
    }

    const data = ctx.callbackQuery.data;

    // Handle cancel
    if (data === 'seller:menu') {
      await ctx.answerCbQuery(sellerMessages.upgrade.cancelled);
      await ctx.scene.leave();
      await showSellerMainMenu(ctx);
      return;
    }

    if (data !== 'upgrade:confirm') {
      await ctx.answerCbQuery(generalMessages.invalidChoice);
      return;
    }

    await ctx.answerCbQuery();

    const { upgradeCost } = ctx.wizard.state;

    const message = sellerMessages.upgrade.chooseCrypto(upgradeCost.toFixed(2));

    await ctx.editMessageText(
      message,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(buttonText.cryptoBTC, 'upgrade:crypto:BTC')],
          [Markup.button.callback(buttonText.cryptoETH, 'upgrade:crypto:ETH')],
          [Markup.button.callback(buttonText.cryptoUSDT, 'upgrade:crypto:USDT')],
          [Markup.button.callback(buttonText.cryptoLTC, 'upgrade:crypto:LTC')],
          [Markup.button.callback(buttonText.back, 'upgrade:back')],
          [Markup.button.callback(buttonText.cancel, 'seller:menu')]
        ])
      }
    );

    return ctx.wizard.next();
  },

  // Step 3: Handle crypto selection and show payment address
  async (ctx) => {
    if (!ctx.callbackQuery) {
      return;
    }

    const data = ctx.callbackQuery.data;

    // Handle back
    if (data === 'upgrade:back') {
      await ctx.answerCbQuery();
      return ctx.wizard.back();
    }

    // Handle cancel
    if (data === 'seller:menu') {
      await ctx.answerCbQuery(sellerMessages.upgrade.cancelled);
      await ctx.scene.leave();
      await showSellerMainMenu(ctx);
      return;
    }

    // Parse crypto selection
    if (!data.startsWith('upgrade:crypto:')) {
      await ctx.answerCbQuery(sellerMessages.upgrade.unknownCommand, { show_alert: true });
      return;
    }

    const currency = data.replace('upgrade:crypto:', '');
    if (!['BTC', 'ETH', 'USDT', 'LTC'].includes(currency)) {
      await ctx.answerCbQuery(sellerMessages.upgrade.unknownCommand, { show_alert: true });
      return;
    }

    await ctx.answerCbQuery();

    const { upgradeCost } = ctx.wizard.state;
    const paymentAddress = PAYMENT_ADDRESSES[currency];

    ctx.wizard.state.currency = currency;
    ctx.wizard.state.paymentAddress = paymentAddress;

    const message = sellerMessages.upgrade.paymentDetails(upgradeCost.toFixed(2), currency, paymentAddress);

    await ctx.editMessageText(
      message,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(buttonText.cancel, 'seller:menu')]])
      }
    );

    await smartMessage.send(ctx, { text: sellerMessages.upgrade.sendHashPrompt });

    return ctx.wizard.next();
  },

  // Step 4: Handle tx_hash and verify upgrade payment
  async (ctx) => {
    if (ctx.callbackQuery?.data === 'seller:menu') {
      await ctx.answerCbQuery(sellerMessages.upgrade.cancelled);
      await ctx.scene.leave();
      await showSellerMainMenu(ctx);
      return;
    }

    if (ctx.callbackQuery?.data === 'upgrade:retry') {
      await ctx.answerCbQuery();
      const { upgradeCost, currency, paymentAddress } = ctx.wizard.state;
      const reminder = sellerMessages.upgrade.paymentDetails(upgradeCost.toFixed(2), currency, paymentAddress);
      await cleanReplyHTML(ctx, reminder, Markup.inlineKeyboard([[Markup.button.callback(buttonText.cancel, 'seller:menu')]]));
      await smartMessage.send(ctx, { text: sellerMessages.upgrade.sendHashPrompt });
      return;
    }

    if (!ctx.message?.text) {
      await smartMessage.send(ctx, { text: sellerMessages.upgrade.sendHashPrompt });
      return;
    }

    const txHash = ctx.message.text.trim();
    if (txHash.length < 10) {
      await smartMessage.send(ctx, { text: sellerMessages.upgrade.hashInvalid });
      return;
    }

    try {
      const loadingMsg = await smartMessage.send(ctx, { text: sellerMessages.upgrade.verifying });

      const { shopId, currency, paymentAddress } = ctx.wizard.state;
      const token = ctx.session.token;

      const upgradeResponse = await api.post(
        '/subscriptions/upgrade',
        { shopId, txHash, currency, paymentAddress },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { subscription } = upgradeResponse.data;
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

      const endDate = new Date(subscription.periodEnd).toLocaleDateString('ru-RU');
      let successMessage = sellerMessages.upgrade.success(endDate);
      successMessage += `\n\n${sellerMessages.upgrade.benefits}`;

      await cleanReplyHTML(ctx, successMessage, Markup.inlineKeyboard([[Markup.button.callback(buttonText.mainMenu, 'seller:menu')]]));

      return ctx.scene.leave();
    } catch (error) {
      logger.error('[UpgradeShop] Payment verification error:', error);

      const errorData = error.response?.data;
      let errorMessage;
      if (errorData?.error === 'DUPLICATE_TX_HASH') {
        errorMessage = sellerMessages.upgrade.duplicateTx;
      } else if (errorData?.error === 'PAYMENT_VERIFICATION_FAILED') {
        errorMessage = sellerMessages.upgrade.verificationFailed;
      } else {
        errorMessage = sellerMessages.upgrade.verificationError;
      }

      await cleanReplyHTML(
        ctx,
        errorMessage,
        Markup.inlineKeyboard([[
          Markup.button.callback(buttonText.retry, 'upgrade:retry'),
          Markup.button.callback(buttonText.cancel, 'seller:menu')
        ]])
      );

      return;
    }
  },
);

// Leave handler
upgradeShopScene.leave(async (ctx) => {
  ctx.wizard.state = {};
  logger.info('[UpgradeShop] Scene left');
});

export default upgradeShopScene;
