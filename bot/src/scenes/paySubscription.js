/**
 * Pay Subscription Scene
 * 
 * Multi-step wizard for paying monthly shop subscription
 * 
 * Steps:
 * 1. Show pricing and select tier (basic $25 or pro $35)
 * 2. Select cryptocurrency
 * 3. Auto-generate payment address via Backend API
 * 4. User clicks "I paid" button
 * 5. Auto-verify payment and activate subscription
 */

import { Scenes, Markup } from 'telegraf';
import QRCode from 'qrcode';
import { subscriptionApi } from '../utils/api.js';
import logger from '../utils/logger.js';
import * as smartMessage from '../utils/smartMessage.js';
import { reply as cleanReply, replyHTML as cleanReplyHTML } from '../utils/cleanReply.js';
import { messages, buttons as buttonText } from '../texts/messages.js';
import { showSellerMainMenu } from '../utils/sellerNavigation.js';

const { general: generalMessages, seller: sellerMessages, subscription: subMessages } = messages;

// Chain mappings (Bot → Backend API format)
const CHAIN_MAPPINGS = {
  BTC: 'BTC',
  LTC: 'LTC',
  ETH: 'ETH',
  USDT: 'USDT_TRC20'
};

const paySubscriptionScene = new Scenes.WizardScene(
  'pay_subscription',
  
  // Step 1: Show pricing and tier selection
  async (ctx) => {
    try {
      // Check if tier was passed on scene entry (from chooseTier scene)
      const enteredWithTier = ctx.scene.state?.tier;
      const createShopAfter = ctx.scene.state?.createShopAfter;

      // FIRST SUBSCRIPTION MODE: User creating first shop (subscriptionId created by chooseTier)
      if (enteredWithTier) {
        const subscriptionId = ctx.scene.state?.subscriptionId;

        if (!subscriptionId) {
          logger.error('[PaySubscription] Missing subscriptionId!', {
            userId: ctx.from.id,
            sceneState: ctx.scene.state
          });

          await cleanReply(ctx, '❌ Ошибка: не удалось создать подписку. Попробуйте снова.');
          return ctx.scene.leave();
        }

        logger.info(`[PaySubscription] Entered with tier: ${enteredWithTier}, subscriptionId: ${subscriptionId}`);

        // Save to wizard state
        ctx.wizard.state.tier = enteredWithTier;
        ctx.wizard.state.subscriptionId = subscriptionId;
        ctx.wizard.state.createShopAfter = createShopAfter;
        const amount = enteredWithTier === 'pro' ? '$35' : '$25';
        ctx.wizard.state.amount = amount;

        // Skip to crypto selection (Step 3)
        const message = subMessages.confirmPrompt(enteredWithTier, amount);

        await cleanReplyHTML(
          ctx,
          message,
          Markup.inlineKeyboard([
            [Markup.button.callback('₿ Bitcoin (BTC)', 'subscription:crypto:BTC')],
            [Markup.button.callback('Ł Litecoin (LTC)', 'subscription:crypto:LTC')],
            [Markup.button.callback('Ξ Ethereum (ETH)', 'subscription:crypto:ETH')],
            [Markup.button.callback('₮ Tether USDT (TRC20)', 'subscription:crypto:USDT')],
            [Markup.button.callback(buttonText.cancel, 'seller:menu')]
          ])
        );

        return ctx.wizard.selectStep(2);
      }

      // RENEWAL MODE: Existing shop renewing subscription
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

      const statusResponse = await subscriptionApi.getStatus(shopId, token);
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

      // Save shop info and subscription ID for next steps
      ctx.wizard.state.shopId = shopId;
      ctx.wizard.state.shopName = shopName;
      ctx.wizard.state.subscriptionId = statusResponse.subscriptionId;

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

    const amount = tier === 'pro' ? '$35' : '$25';
    ctx.wizard.state.tier = tier;
    ctx.wizard.state.amount = amount;

    const message = subMessages.confirmPrompt(tier, amount);

    await ctx.editMessageText(
      message,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(buttonText.cryptoBTC, 'subscription:crypto:BTC')],
          [Markup.button.callback(buttonText.cryptoLTC, 'subscription:crypto:LTC')],
          [Markup.button.callback(buttonText.cryptoETH, 'subscription:crypto:ETH')],
          [Markup.button.callback(buttonText.cryptoUSDT, 'subscription:crypto:USDT')],
          [Markup.button.callback(buttonText.back, 'subscription:back')]
        ])
      }
    );

    return ctx.wizard.next();
  },

  // Step 3: Handle crypto selection and generate payment address
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
    if (!['BTC', 'LTC', 'ETH', 'USDT'].includes(currency)) {
      await ctx.answerCbQuery(subMessages.invalidCrypto);
      return;
    }

    await ctx.answerCbQuery();

    try {
      // Show loading message
      const loadingMsg = await ctx.editMessageText(
        subMessages.generatingInvoice,
        { parse_mode: 'HTML' }
      );

      const { tier, amount, subscriptionId } = ctx.wizard.state;
      const token = ctx.session.token;

      // Map currency to chain format (USDT → USDT_ERC20)
      const chain = CHAIN_MAPPINGS[currency];

      // Generate payment invoice via Backend API
      const invoice = await subscriptionApi.generateSubscriptionInvoice(
        subscriptionId,
        chain,
        token
      );

      // Save invoice details
      ctx.wizard.state.currency = currency;
      ctx.wizard.state.invoiceId = invoice.invoiceId;
      ctx.wizard.state.address = invoice.address;
      ctx.wizard.state.expectedAmount = invoice.expectedAmount;
      ctx.wizard.state.expiresAt = invoice.expiresAt;

      // Display currency name for user
      const currencyDisplayName = subMessages.chainMappings[chain] || currency;

      // Generate QR code for payment address
      const qrCodeBuffer = await QRCode.toBuffer(invoice.address, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Prepare message with crypto amount if available
      const cryptoAmount = invoice.cryptoAmount || null;
      const message = subMessages.invoiceGenerated(
        tier,
        amount,
        currencyDisplayName,
        invoice.address,
        invoice.expiresAt,
        cryptoAmount
      );

      // Delete loading message and send QR code with caption
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Ignore delete errors
      }

      await ctx.replyWithPhoto(
        { source: qrCodeBuffer },
        {
          caption: message,
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Я оплатил', 'subscription:paid')],
            [Markup.button.callback(buttonText.cancel, 'seller:menu')]
          ])
        }
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error('[PaySubscription] Invoice generation error:', error);

      const errorData = error.response?.data;
      let errorMessage = subMessages.invoiceError;

      if (errorData?.error) {
        errorMessage += `\n\n${errorData.error}`;
      }

      await ctx.editMessageText(
        errorMessage,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback(buttonText.back, 'subscription:back')],
            [Markup.button.callback(buttonText.cancel, 'seller:menu')]
          ])
        }
      );

      return;
    }
  },

  // Step 4: Handle "I paid" button and verify payment
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

    // Handle "I paid" button
    if (data === 'subscription:paid') {
      await ctx.answerCbQuery();

      try {
        // Show checking message
        await ctx.editMessageText(
          subMessages.checkingPayment,
          { parse_mode: 'HTML' }
        );

        const { subscriptionId } = ctx.wizard.state;
        const token = ctx.session.token;

        // Get payment status from Backend
        const paymentStatus = await subscriptionApi.getSubscriptionPaymentStatus(
          subscriptionId,
          token
        );

        if (paymentStatus.status === 'paid') {
          // Payment confirmed!
          const { tier, createShopAfter } = ctx.wizard.state;
          const endDate = new Date(paymentStatus.paidAt);
          endDate.setDate(endDate.getDate() + 30); // Add 30 days
          const formattedDate = endDate.toLocaleDateString('ru-RU');

          let successMessage = subMessages.verificationSuccess(tier, formattedDate, subscriptionId);
          if (tier === 'pro') {
            successMessage += `\n\n${subMessages.proBenefits}`;
          }

          // If creating first shop - redirect to createShop scene
          if (createShopAfter && subscriptionId) {
            logger.info(`[PaySubscription] Redirecting to createShop scene with subscriptionId: ${subscriptionId}`);

            await ctx.editMessageText(
              `✅ ${successMessage}\n\n📝 Теперь создайте свой магазин:`,
              { parse_mode: 'HTML' }
            );

            await ctx.scene.leave();
            await ctx.scene.enter('createShop', {
              tier: tier,
              subscriptionId: subscriptionId,
              paidSubscription: true
            });
            return;
          }

          // Default: show success and return to seller menu
          await ctx.editMessageText(
            successMessage,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(buttonText.mainMenu, 'seller:menu')]
              ])
            }
          );

          await ctx.scene.leave();

          // Return to seller menu
          const { showSellerMainMenu } = await import('../handlers/seller/index.js');
          await showSellerMainMenu(ctx);
          return;

        } else if (paymentStatus.status === 'expired') {
          // Invoice expired
          await ctx.editMessageText(
            subMessages.paymentExpired,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(buttonText.retry, 'subscription:retry')],
                [Markup.button.callback(buttonText.cancel, 'seller:menu')]
              ])
            }
          );
          return;

        } else {
          // Payment pending - still waiting
          const { tier, amount, currency, address, expiresAt } = ctx.wizard.state;
          const currencyDisplayName = subMessages.chainMappings[CHAIN_MAPPINGS[currency]] || currency;

          const reminderMessage = subMessages.invoiceGenerated(
            tier,
            amount,
            currencyDisplayName,
            address,
            expiresAt
          ) + `\n\n${subMessages.paymentPending}`;

          await ctx.editMessageText(
            reminderMessage,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Обновить', 'subscription:paid')],
                [Markup.button.callback(buttonText.cancel, 'seller:menu')]
              ])
            }
          );
          return;
        }

      } catch (error) {
        logger.error('[PaySubscription] Payment verification error:', error);

        const errorData = error.response?.data;
        let errorMessage = subMessages.paymentStatusError;

        if (errorData?.error) {
          errorMessage += `\n\n${errorData.error}`;
        }

        await ctx.editMessageText(
          errorMessage,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback(buttonText.retry, 'subscription:paid')],
              [Markup.button.callback(buttonText.cancel, 'seller:menu')]
            ])
          }
        );

        return;
      }
    }

    // Handle retry (go back to crypto selection)
    if (data === 'subscription:retry') {
      await ctx.answerCbQuery();
      return ctx.wizard.selectStep(1); // Go back to tier selection
    }
  }
);

// Leave handler
paySubscriptionScene.leave(async (ctx) => {
  ctx.wizard.state = {};
  logger.info('[PaySubscription] Scene left');
});

export default paySubscriptionScene;
