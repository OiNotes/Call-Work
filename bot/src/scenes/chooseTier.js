/**
 * Choose Tier Scene
 *
 * Allows user to select subscription tier before creating a shop
 *
 * Steps:
 * 1. Show tier options (BASIC / PRO) with pricing
 * 2. Handle tier selection
 * 3. Optional: Enter promo code
 * 4. Transition to createShop scene with selected tier
 */

import { Scenes, Markup } from 'telegraf';
import logger from '../utils/logger.js';
import { reply as cleanReply, replyHTML as cleanReplyHTML } from '../utils/cleanReply.js';
import { messages, buttons as buttonText } from '../texts/messages.js';

const { subscription: subMessages } = messages;

const chooseTierScene = new Scenes.WizardScene(
  'chooseTier',

  // Step 1: Show tier selection
  async (ctx) => {
    try {
      logger.info('choose_tier_step:entry', { userId: ctx.from.id });

      const message = `${subMessages.chooseTierIntro}\n\n${subMessages.tierDescriptionBasic}\n\n${subMessages.tierDescriptionPro}`;

      await cleanReplyHTML(
        ctx,
        message,
        Markup.inlineKeyboard([
          [Markup.button.callback('BASIC $25', 'tier_select:basic')],
          [Markup.button.callback('PRO $35', 'tier_select:pro')],
          [Markup.button.callback(buttonText.promoCode, 'tier_promo')],
          [Markup.button.callback(buttonText.back, 'cancel_scene')]
        ])
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in chooseTier entry step:', error);
      throw error;
    }
  },

  // Step 2: Handle tier/promo selection
  async (ctx) => {
    // Handle callback queries
    if (ctx.callbackQuery) {
      const action = ctx.callbackQuery.data;

      try {
        await ctx.answerCbQuery();

        // Cancel action
        if (action === 'cancel_scene') {
          logger.info('choose_tier_cancelled', { userId: ctx.from.id });
          await ctx.scene.leave();
          return;
        }

        // Tier selection
        if (action === 'tier_select:basic' || action === 'tier_select:pro') {
          const tier = action.replace('tier_select:', '');
          ctx.wizard.state.selectedTier = tier;

          logger.info('tier_selected', {
            userId: ctx.from.id,
            tier
          });

          // Feedback пользователю
          await ctx.answerCbQuery(`Выбран тариф: ${tier.toUpperCase()}`);

          // Transition to createShop scene with selected tier
          await ctx.scene.leave();

          // Enter createShop scene
          await ctx.scene.enter('createShop', { tier });
          return;
        }

        // Promo code flow
        if (action === 'tier_promo') {
          logger.info('choose_tier_step:promo', { userId: ctx.from.id });

          await ctx.editMessageText(
            subMessages.promoPrompt,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(buttonText.back, 'tier_back')]
              ])
            }
          );

          return ctx.wizard.next();
        }

        // Back to tier selection (from promo)
        if (action === 'tier_back') {
          return ctx.wizard.back();
        }
      } catch (error) {
        logger.error('Error in chooseTier callback handler:', error);
        await cleanReply(ctx, subMessages.unknownCommand);
        return ctx.scene.leave();
      }
    }
  },

  // Step 3: Handle promo code input
  async (ctx) => {
    // Handle back button
    if (ctx.callbackQuery?.data === 'tier_back') {
      await ctx.answerCbQuery();
      // Go back to tier selection
      return ctx.wizard.selectStep(0);
    }

    // Wait for text message with promo code
    if (!ctx.message?.text) {
      await cleanReply(ctx, subMessages.promoTextPrompt);
      return;
    }

    const promoCode = ctx.message.text.trim();

    // Track user message for cleanup
    if (!ctx.wizard.state.userMessageIds) {
      ctx.wizard.state.userMessageIds = [];
    }
    ctx.wizard.state.userMessageIds.push(ctx.message.message_id);

    // Basic validation
    if (promoCode.length < 3) {
      await cleanReply(ctx, subMessages.promoInvalid);
      return;
    }

    logger.info('promo_entered', {
      userId: ctx.from.id,
      promoCode
    });

    // Store promo code in wizard state
    ctx.wizard.state.promoCode = promoCode;

    // Transition to createShop scene with promo code
    await ctx.scene.leave();

    // Enter createShop scene with promo code and PRO tier
    await ctx.scene.enter('createShop', { promoCode, tier: 'pro' });
  }
);

// Leave handler
chooseTierScene.leave(async (ctx) => {
  // Delete user messages (promo code input)
  const userMsgIds = ctx.wizard.state?.userMessageIds || [];
  for (const msgId of userMsgIds) {
    try {
      await ctx.deleteMessage(msgId);
    } catch (error) {
      logger.debug(`Could not delete user message ${msgId}:`, error.message);
    }
  }

  // Clear wizard state
  ctx.wizard.state = {};
  logger.info(`User ${ctx.from?.id} left chooseTier scene`);
});

// Handle cancel action within scene
chooseTierScene.action('cancel_scene', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    logger.info('choose_tier_cancelled', { userId: ctx.from.id });

    await ctx.scene.leave();

    // Don't send additional message - just leave and let handler take over
  } catch (error) {
    logger.error('Error in cancel_scene handler:', error);
  }
});

export default chooseTierScene;
