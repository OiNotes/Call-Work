/**
 * Pay Subscription Scene
 * 
 * Multi-step wizard for paying monthly shop subscription
 * 
 * Steps:
 * 1. Show pricing and select tier (free $25 or pro $35)
 * 2. Select cryptocurrency
 * 3. Show payment address and amount
 * 4. User sends tx_hash
 * 5. Verify payment and activate subscription
 */

import { Scenes, Markup } from 'telegraf';
import api from '../utils/api.js';
import logger from '../utils/logger.js';
import * as smartMessage from '../utils/smartMessage.js';
import { reply as cleanReply, replyHTML as cleanReplyHTML } from '../utils/cleanReply.js';
import { messages, buttons as buttonText } from '../texts/messages.js';
import { showSellerMainMenu } from '../utils/sellerNavigation.js';

const { general: generalMessages, seller: sellerMessages, subscription: subMessages } = messages;

// Crypto payment addresses (should match backend)
const PAYMENT_ADDRESSES = {
  BTC: process.env.BTC_PAYMENT_ADDRESS || '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  ETH: process.env.ETH_PAYMENT_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  USDT: process.env.USDT_PAYMENT_ADDRESS || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  LTC: process.env.LTC_PAYMENT_ADDRESS || 'LTC1A2B3C4D5E6F7G8H9J0K1L2M3N4P5Q6R'
};

const paySubscriptionScene = new Scenes.WizardScene(
  'pay_subscription',
  
  // Step 1: Show pricing and tier selection
  async (ctx) => {
    try {
      const shopId = ctx.session.shopId;

      if (!shopId) {
        await smartMessage.send(ctx, { text: generalMessages.shopRequired });
        return ctx.scene.leave();
      }

      // Get current subscription status
      const token = ctx.session.token;
      if (!token) {
        await smartMessage.send(ctx, { text: generalMessages.authorizationRequired });
        return ctx.scene.leave();
      }
      await api.get(`/subscriptions/status/${shopId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const shopName = ctx.session.shopName || 'Магазин';

      const message = [
        subMessages.chooseTierIntro,
        subMessages.tierDescriptionBasic,
        subMessages.tierDescriptionPro
      ].join('\n\n');

      await cleanReplyHTML(
        ctx,
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback(buttonText.tierBasic, 'subscription:tier:basic')],
          [Markup.button.callback(buttonText.tierPro, 'subscription:tier:pro')],
          [Markup.button.callback(buttonText.cancel, 'seller:menu')]
        ])
      );

      // Save shop info for next steps
      ctx.wizard.state.shopId = shopId;
      ctx.wizard.state.shopName = shopName;
      if (!ctx.session.shopName) {
        ctx.session.shopName = shopName;
      }

      return ctx.wizard.next();
    } catch (error) {
      logger.error('[PaySubscription] Step 1 error:', error);
      
      const errorMsg = error.response?.data?.error || error.message;
      await cleanReply(ctx, `❌ Ошибка: ${errorMsg}`, Markup.inlineKeyboard([
        [Markup.button.callback(buttonText.backToMenu, 'seller:menu')]
      ]));
      
      return ctx.scene.leave();
    }
  },

  // Step 2: Handle tier selection and show crypto options
  async (ctx) => {
    if (!ctx.callbackQuery) {
      return;
    }

    const data = ctx.callbackQuery.data;

    // Handle cancel
    if (data === 'seller:menu') {
      await ctx.answerCbQuery(subMessages.cancelled);
      await ctx.scene.leave();
      await showSellerMainMenu(ctx);
      return;
    }

    if (!data.startsWith('subscription:tier:')) {
      await ctx.answerCbQuery(subMessages.unknownCommand, { show_alert: true });
      return;
    }

    const tier = data.replace('subscription:tier:', '');
    if (tier !== 'basic' && tier !== 'pro') {
      await ctx.answerCbQuery(subMessages.invalidTier);
      return;
    }

    await ctx.answerCbQuery();

    const amount = tier === 'pro' ? 35 : 25;
    ctx.wizard.state.tier = tier;
    ctx.wizard.state.amount = amount;

    const message = subMessages.confirmPrompt(tier, amount);

    await ctx.editMessageText(
      message,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(buttonText.cryptoBTC, 'subscription:crypto:BTC')],
          [Markup.button.callback(buttonText.cryptoETH, 'subscription:crypto:ETH')],
          [Markup.button.callback(buttonText.cryptoUSDT, 'subscription:crypto:USDT')],
          [Markup.button.callback(buttonText.cryptoLTC, 'subscription:crypto:LTC')],
          [Markup.button.callback(buttonText.back, 'subscription:back')]
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
    if (data === 'subscription:back') {
      await ctx.answerCbQuery();
      return ctx.wizard.back();
    }

    // Handle cancel
    if (data === 'seller:menu') {
      await ctx.answerCbQuery(subMessages.cancelled);
      await ctx.scene.leave();
      await showSellerMainMenu(ctx);
      return;
    }

    // Parse crypto selection
    if (!data.startsWith('subscription:crypto:')) {
      await ctx.answerCbQuery(generalMessages.invalidChoice);
      return;
    }

    const currency = data.replace('subscription:crypto:', '');
    if (!['BTC', 'ETH', 'USDT', 'LTC'].includes(currency)) {
      await ctx.answerCbQuery(subMessages.invalidCrypto);
      return;
    }

    await ctx.answerCbQuery();

    const { tier, amount } = ctx.wizard.state;
    const paymentAddress = PAYMENT_ADDRESSES[currency];

    ctx.wizard.state.currency = currency;
    ctx.wizard.state.paymentAddress = paymentAddress;

    const message = `Оплата\n\nТариф: ${tier.toUpperCase()} - ${amount}\nВалюта: ${currency}\n\nАдрес:\n<code>${paymentAddress}</code>\n\nПосле оплаты отправьте TX Hash\n\nПример TX Hash:\n0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b`;

    await ctx.editMessageText(
      message,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'seller:menu')]
        ])
      }
    );

    return ctx.wizard.next();
  },

  // Step 4: Handle tx_hash and verify payment
  async (ctx) => {
    if (ctx.callbackQuery?.data === 'seller:menu') {
      await ctx.answerCbQuery(subMessages.cancelled);
      await ctx.scene.leave();
      await showSellerMainMenu(ctx);
      return;
    }

    if (ctx.callbackQuery?.data === 'subscription:retry') {
      await ctx.answerCbQuery();
      const { tier, amount, currency, paymentAddress } = ctx.wizard.state;
      const reminder = subMessages.paymentDetails(tier, amount, currency, paymentAddress);
      await cleanReplyHTML(ctx, reminder, Markup.inlineKeyboard([[Markup.button.callback(buttonText.cancel, 'seller:menu')]]));
      await smartMessage.send(ctx, { text: subMessages.sendHashPrompt });
      return;
    }

    if (!ctx.message?.text) {
      await smartMessage.send(ctx, { text: subMessages.sendHashPrompt });
      return;
    }

    const txHash = ctx.message.text.trim();
    if (txHash.length < 10) {
      await smartMessage.send(ctx, { text: subMessages.hashInvalid });
      return;
    }

    try {
      const loadingMsg = await smartMessage.send(ctx, { text: subMessages.verifying });

      const { shopId, tier, currency, paymentAddress } = ctx.wizard.state;
      const token = ctx.session.token;

      const paymentResponse = await api.post(
        '/subscriptions/pay',
        { shopId, tier, txHash, currency, paymentAddress },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { subscription } = paymentResponse.data;
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

      const endDate = new Date(subscription.periodEnd).toLocaleDateString('ru-RU');
      let successMessage = subMessages.verificationSuccess(tier, endDate, subscription.id);
      if (tier === 'pro') {
        successMessage += `\n\n${subMessages.proBenefits}`;
      }

      await cleanReplyHTML(ctx, successMessage, Markup.inlineKeyboard([[Markup.button.callback(buttonText.mainMenu, 'seller:menu')]]));

      await ctx.scene.leave();

      // Явно вернуть в меню продавца
      const { showSellerMainMenu } = await import('../handlers/seller/index.js');
      await showSellerMainMenu(ctx);
      return;
    } catch (error) {
      logger.error('[PaySubscription] Payment verification error:', error);

      const errorData = error.response?.data;
      let errorMessage;
      if (errorData?.error === 'DUPLICATE_TX_HASH') {
        errorMessage = subMessages.duplicateTx;
      } else if (errorData?.error === 'PAYMENT_VERIFICATION_FAILED') {
        errorMessage = subMessages.verificationFailed;
      } else {
        errorMessage = subMessages.verificationError;
      }

      await cleanReplyHTML(
        ctx,
        errorMessage,
        Markup.inlineKeyboard([[
          Markup.button.callback(buttonText.retry, 'subscription:retry'),
          Markup.button.callback(buttonText.cancel, 'seller:menu')
        ]])
      );

      return;
    }
  }

);

// Leave handler
paySubscriptionScene.leave(async (ctx) => {
  ctx.wizard.state = {};
  logger.info('[PaySubscription] Scene left');
});

export default paySubscriptionScene;
