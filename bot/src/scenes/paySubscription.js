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
import { subscriptionApi, walletApi, shopApi } from '../utils/api.js';
import logger from '../utils/logger.js';
import * as smartMessage from '../utils/smartMessage.js';
import { reply as cleanReply, replyHTML as cleanReplyHTML } from '../utils/cleanReply.js';
import { messages, buttons as buttonText } from '../texts/messages.js';
import { showSellerMainMenu } from '../utils/sellerNavigation.js';
import { generateQRWithTimeout } from '../utils/qrHelper.js';

const { general: generalMessages, subscription: subMessages } = messages;

// Chain mappings (Bot → Backend API format)
const CHAIN_MAPPINGS = {
  BTC: 'BTC',
  LTC: 'LTC',
  ETH: 'ETH',
  USDT: 'USDT_TRC20',
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
            sceneState: ctx.scene.state,
          });

          await cleanReply(ctx, '❌ Ошибка: не удалось создать подписку. Попробуйте снова.');
          return ctx.scene.leave();
        }

        logger.info(
          `[PaySubscription] Entered with tier: ${enteredWithTier}, subscriptionId: ${subscriptionId}`
        );

        // Save to wizard state
        ctx.wizard.state.tier = enteredWithTier;
        ctx.wizard.state.subscriptionId = subscriptionId;
        ctx.wizard.state.createShopAfter = createShopAfter;
        const amount = enteredWithTier === 'pro' ? '$1' : '$1';
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
            [Markup.button.callback(buttonText.cancel, 'seller:menu')],
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
        subMessages.tierDescriptionPro,
      ].join('\n\n');

      await cleanReplyHTML(
        ctx,
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback(buttonText.tierBasic, 'subscription:tier:basic')],
          [Markup.button.callback(buttonText.tierPro, 'subscription:tier:pro')],
          [Markup.button.callback(buttonText.cancel, 'seller:menu')],
        ])
      );

      // Save shop info and subscription ID for next steps
      ctx.wizard.state.shopId = shopId;
      ctx.wizard.state.shopName = shopName;
      ctx.wizard.state.subscriptionId = statusResponse.currentSubscription?.id;

      if (!ctx.session.shopName) {
        ctx.session.shopName = shopName;
      }

      return ctx.wizard.next();
    } catch (error) {
      logger.error('[PaySubscription] Step 1 error:', error);

      const errorMsg = error.response?.data?.error || error.message;
      await cleanReply(
        ctx,
        `❌ Ошибка: ${errorMsg}`,
        Markup.inlineKeyboard([[Markup.button.callback(buttonText.backToMenu, 'seller:menu')]])
      );

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

    const amount = tier === 'pro' ? '$1' : '$1';
    ctx.wizard.state.tier = tier;
    ctx.wizard.state.amount = amount;

    const message = subMessages.confirmPrompt(tier, amount);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(buttonText.cryptoBTC, 'subscription:crypto:BTC')],
        [Markup.button.callback(buttonText.cryptoLTC, 'subscription:crypto:LTC')],
        [Markup.button.callback(buttonText.cryptoETH, 'subscription:crypto:ETH')],
        [Markup.button.callback(buttonText.cryptoUSDT, 'subscription:crypto:USDT')],
        [Markup.button.callback(buttonText.back, 'subscription:back')],
      ]),
    });

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
      await ctx.editMessageText(subMessages.generatingInvoice, { parse_mode: 'HTML' });

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

      // Save invoice details (support both snake_case and camelCase from API)
      ctx.wizard.state.currency = currency;
      ctx.wizard.state.invoiceId = invoice.invoiceId;
      ctx.wizard.state.address = invoice.address;
      ctx.wizard.state.expectedAmount = invoice.expectedAmount; // USD amount
      ctx.wizard.state.cryptoAmount = invoice.cryptoAmount || invoice.crypto_amount; // Exact crypto amount
      ctx.wizard.state.expiresAt = invoice.expiresAt;

      // Display currency name for user
      const currencyDisplayName = subMessages.chainMappings[chain] || currency;

      // P0-BOT-8 FIX: Generate QR code via backend (non-blocking)
      // Backend generates QR, bot just fetches it with timeout protection
      const qrResponse = await generateQRWithTimeout(
        () =>
          walletApi.generateQR(
            {
              address: invoice.address,
              amount: invoice.crypto_amount || invoice.cryptoAmount || invoice.expectedAmount,
              currency: currency,
            },
            token
          ),
        10000 // 10 second timeout
      );

      if (!qrResponse || !qrResponse.success || !qrResponse.data?.qrCode) {
        throw new Error('Failed to generate QR code from backend');
      }

      // Convert base64 to buffer
      const base64Data = qrResponse.data.qrCode.replace(/^data:image\/png;base64,/, '');
      const qrCodeBuffer = Buffer.from(base64Data, 'base64');

      // Prepare message with crypto amount from wizard state
      const cryptoAmount = ctx.wizard.state.cryptoAmount || null;
      const message = subMessages.invoiceGenerated(
        tier,
        amount,
        currencyDisplayName,
        invoice.address,
        invoice.expiresAt,
        cryptoAmount  // Exact crypto amount to send
      );

      // Delete loading message and send QR code with caption
      try {
        await ctx.deleteMessage();
      } catch {
        // Ignore delete errors
      }

      await ctx.replyWithPhoto(
        { source: qrCodeBuffer },
        {
          caption: message,
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔗 Ввести TX Hash', 'subscription:paid')],
            [Markup.button.callback('🔄 Проверить статус', 'subscription:status')],
            [Markup.button.callback(buttonText.cancel, 'seller:menu')],
          ]),
        }
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error('[PaySubscription] Invoice generation error:', error);

      const errorData = error.response?.data;
      let errorMessage = subMessages.invoiceError;

      // Check if error is QR generation timeout
      if (error.message === 'QR_GENERATION_TIMEOUT') {
        errorMessage =
          'QR код генерируется слишком долго. Попробуйте выбрать другую криптовалюту или попробуйте позже.';
      } else if (errorData?.error) {
        errorMessage += `\n\n${errorData.error}`;
      }

      await ctx.editMessageText(errorMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(buttonText.back, 'subscription:back')],
          [Markup.button.callback(buttonText.cancel, 'seller:menu')],
        ]),
      });

      return;
    }
  },

  // Step 4: Handle "I paid" button and manual tx-hash confirmation
  async (ctx) => {
    // If waiting for tx hash and user sends text
    if (ctx.wizard.state.awaitingTxHash && ctx.message?.text) {
      const inputText = ctx.message.text.trim();
      
      // Logic to extract hash from link or text
      // Matches 64-char hex string, optionally starting with 0x
      const hashRegex = /\b(0x)?[a-fA-F0-9]{64}\b/;
      const match = inputText.match(hashRegex);
      
      // Use extracted hash or fallback to full text
      const txHash = match ? match[0] : inputText;

      const { subscriptionId } = ctx.wizard.state;
      const token = ctx.session.token;

      let statusMsg;
      try {
        statusMsg = await cleanReply(ctx, '⏳ Проверяем транзакцию...');

        // Helper delay function
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        // Initial verification
        let result = await subscriptionApi.confirmSubscriptionPayment(
          subscriptionId,
          txHash,
          token
        );

        let status =
          result.status ||
          (result.confirmed ? 'confirmed' : result.confirmed === false ? 'pending' : null);
        let confirmations = result.confirmations || 0;

        // If pending, try polling a few times (short polling)
        if (status === 'pending') {
          for (let i = 1; i <= 3; i++) {
            try {
              await ctx.telegram.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                null,
                `⏳ Платёж найден. Ждём подтверждения сети (${i}/3)...`
              );
            } catch (e) { /* ignore edit error */ }
            
            await delay(3000); // Wait 3 seconds

            // Check status again
            const check = await subscriptionApi.getSubscriptionPaymentStatus(subscriptionId, token);
            if (check.status === 'paid' || check.status === 'confirmed') {
              status = 'confirmed';
              result = check;
              break;
            }
          }
        }

        const { tier, createShopAfter } = ctx.wizard.state;

        if (status === 'confirmed' || status === 'paid') {
           // Success logic (unchanged)
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);
          const formattedDate = endDate.toLocaleDateString('ru-RU');

          let hasShop = Boolean(ctx.session.shopId);
          if (!hasShop && token) {
            try {
              const myShops = await shopApi.getMyShop(token);
              if (Array.isArray(myShops) && myShops.length > 0) {
                const [primaryShop] = myShops;
                ctx.session.shopId = primaryShop.id;
                ctx.session.shopName = primaryShop.name || ctx.session.shopName;
                ctx.session.shopTier = primaryShop.tier || ctx.session.shopTier;
                hasShop = true;
              }
            } catch (shopError) {
              logger.warn('[PaySubscription] Failed to fetch user shops after payment', {
                userId: ctx.from.id,
                error: shopError.message,
              });
            }
          }

          const shouldCreateShop = createShopAfter && subscriptionId && !hasShop;
          let successMessage = subMessages.verificationSuccess(tier, formattedDate, subscriptionId);
          if (tier === 'pro') {
            successMessage += `\n\n${subMessages.proBenefits}`;
          }

          try {
             await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
          } catch (e) {}

          if (shouldCreateShop) {
            await ctx.reply(`✅ ${successMessage}\n\n📝 Теперь создайте свой магазин:`, {
              parse_mode: 'HTML',
            });
            await ctx.scene.leave();
            await ctx.scene.enter('createShop', {
              tier,
              subscriptionId,
              paidSubscription: true,
            });
            ctx.wizard.state.awaitingTxHash = false;
            return;
          }

          await ctx.reply(successMessage, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback(buttonText.mainMenu, 'seller:menu')]]),
          });

          ctx.wizard.state.awaitingTxHash = false;
          await ctx.scene.leave();
          const { showSellerMainMenu } = await import('../handlers/seller/index.js');
          await showSellerMainMenu(ctx);
          return;
        }

        // Still pending after polling
        try {
             await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        } catch (e) {}

        await ctx.reply(
          `✅ Оплата найдена, но сеть ещё не подтвердила транзакцию.\nЭто нормально, просто подождите пару минут.`,
          {
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Проверить статус', 'subscription:status')],
              [Markup.button.callback(buttonText.cancel, 'seller:menu')],
            ]),
          }
        );
        // We stay in the scene, waiting for user to click check later
        ctx.wizard.state.awaitingTxHash = false; 
        return;

      } catch (error) {
        logger.error('[PaySubscription] Manual tx confirm failed', error);
        
        try {
             if(statusMsg) await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        } catch (e) {}

        const msg =
          error.response?.data?.error ||
          'Не удалось проверить транзакцию. Проверьте хэш и попробуйте снова.';
          
        await ctx.reply(`❌ ${msg}`, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔄 Попробовать снова', 'subscription:paid')],
            [Markup.button.callback(buttonText.cancel, 'seller:menu')],
          ]),
        });
        ctx.wizard.state.awaitingTxHash = false;
        return;
      }
    }

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

    // Handle "check status" without tx hash (legacy)
    if (data === 'subscription:status') {
      await ctx.answerCbQuery();
      try {
        const { subscriptionId } = ctx.wizard.state;
        const token = ctx.session.token;
        const paymentStatus = await subscriptionApi.getSubscriptionPaymentStatus(
          subscriptionId,
          token
        );

        if (paymentStatus.status === 'paid') {
          await cleanReply(ctx, '✅ Оплата уже подтверждена. Если магазин не активировался, напишите поддержку.');
          return;
        }

        await cleanReply(
          ctx,
          `Пока нет подтверждения. Статус: ${paymentStatus.status || 'pending'}. Если оплатили, отправьте TX hash.`
        );
        ctx.wizard.state.awaitingTxHash = true;
        return;
      } catch (err) {
        logger.error('[PaySubscription] Status check failed', err);
        await cleanReply(ctx, 'Не удалось проверить статус. Отправьте TX hash или попробуйте позже.');
        return;
      }
    }

    // Handle "I paid" button -> ask for tx hash
    if (data === 'subscription:paid') {
      await ctx.answerCbQuery();
      await cleanReply(
        ctx,
        'Отправьте <b>ссылку на транзакцию</b> или <b>хэш</b> (TXID).\nБот сам найдёт нужные данные в ссылке.'
      );
      ctx.wizard.state.awaitingTxHash = true;
      return;
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
  // ✅ P1-2 FIX: Clear wizard state to prevent memory leak
  if (ctx.wizard) {
    delete ctx.wizard.state;
  }
  ctx.scene.state = {};
  logger.info('[PaySubscription] Scene left');
});

export default paySubscriptionScene;
