import { Scenes, Markup } from 'telegraf';
import { followApi } from '../utils/api.js';
import { formatFollowDetail } from '../utils/minimalist.js';
import { followDetailMenu, followsMenu } from '../keyboards/seller.js';
import logger from '../utils/logger.js';
import { messages } from '../texts/messages.js';

const { general: generalMessages, follows: followMessages } = messages;

/**
 * Edit Follow Markup Scene
 *
 * P1-BOT-003 FIX: Scene-based state management prevents race conditions
 * from multiple simultaneous edit_markup callback_query triggers
 *
 * Flow:
 * 1. Enter scene with followId
 * 2. Show prompt
 * 3. Wait for markup input
 * 4. Update via API
 * 5. Leave scene
 */

// Step 1: Show markup prompt
const showMarkupPrompt = async (ctx) => {
  try {
    const followId = ctx.scene.state.followId;
    const pendingModeSwitch = ctx.scene.state.pendingModeSwitch;

    logger.info('edit_markup_step:prompt', {
      userId: ctx.from.id,
      followId,
      pendingModeSwitch
    });

    const message = pendingModeSwitch ?
      followMessages.markupPrompt :
      followMessages.markupPrompt;

    await ctx.reply(message, Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'cancel_scene')]
    ]));

    return ctx.wizard.next();
  } catch (error) {
    logger.error('Error in showMarkupPrompt step:', error);
    throw error;
  }
};

// Step 2: Handle markup input
const handleMarkupInput = async (ctx) => {
  try {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply(followMessages.markupPrompt);
      return;
    }

    // Track user message for cleanup
    const userMsgId = ctx.message.message_id;
    const markupText = ctx.message.text.trim().replace(',', '.');
    const markup = parseFloat(markupText);

    if (isNaN(markup) || markup < 1 || markup > 500) {
      await ctx.reply(followMessages.markupInvalid);
      // Delete invalid input message
      await ctx.deleteMessage(userMsgId).catch(() => {});
      return;
    }

    // Delete user message (clean chat pattern)
    await ctx.deleteMessage(userMsgId).catch((err) => {
      logger.debug(`Could not delete user message ${userMsgId}:`, err.message);
    });

    const followId = ctx.scene.state.followId;
    const pendingModeSwitch = ctx.scene.state.pendingModeSwitch;
    const token = ctx.session.token;

    if (!token) {
      await ctx.reply(generalMessages.authorizationRequired);
      return ctx.scene.leave();
    }

    logger.info('edit_markup_step:save', {
      userId: ctx.from.id,
      followId,
      markup,
      pendingModeSwitch
    });

    await ctx.reply(followMessages.createSaving);

    try {
      if (pendingModeSwitch) {
        // Mode switch: use switchMode API
        await followApi.switchMode(followId, pendingModeSwitch, token, markup);
      } else {
        // Simple markup update: use updateMarkup API
        await followApi.updateMarkup(followId, markup, token);
      }

      // Fetch updated follow detail
      const follow = await followApi.getFollowDetail(followId, token);
      const message = formatFollowDetail(follow);

      await ctx.reply(message, followDetailMenu(followId, follow.mode));

      logger.info('markup_updated', {
        userId: ctx.from.id,
        followId,
        markup,
        mode: follow.mode
      });

      return ctx.scene.leave();

    } catch (error) {
      logger.error('Error updating markup:', error);

      const errorMsg = error.response?.data?.error;
      let message = followMessages.switchError;

      if (error.response?.status === 402) {
        message = followMessages.limitReached;
      } else if (error.response?.status === 404) {
        message = followMessages.notFound;
      } else if (errorMsg?.toLowerCase().includes('markup')) {
        message = followMessages.markupInvalid;
      }

      await ctx.reply(message, followsMenu(Boolean(ctx.session?.hasFollows)));
      return ctx.scene.leave();
    }

  } catch (error) {
    logger.error('Error in handleMarkupInput step:', error);
    await ctx.reply(followMessages.switchError, followsMenu(Boolean(ctx.session?.hasFollows)));
    return ctx.scene.leave();
  }
};

// Create wizard scene
const editFollowMarkupScene = new Scenes.WizardScene(
  'editFollowMarkup',
  showMarkupPrompt,
  handleMarkupInput
);

// Handle scene enter - set initial state
editFollowMarkupScene.enter((ctx) => {
  // Prevent race condition: Lock this follow for editing
  const followId = ctx.scene.state.followId;
  if (!followId) {
    logger.error('No followId provided to editFollowMarkup scene');
    ctx.scene.leave();
    return;
  }

  // Check if already editing this follow (race condition protection)
  if (ctx.session.editingFollowId === followId) {
    logger.warn('Already editing follow, ignoring duplicate request', {
      userId: ctx.from.id,
      followId
    });
    ctx.scene.leave();
    return;
  }

  // Set lock
  ctx.session.editingFollowId = followId;

  logger.info('edit_markup_scene_entered', {
    userId: ctx.from.id,
    followId,
    pendingModeSwitch: ctx.scene.state.pendingModeSwitch || null
  });
});

// Handle scene leave - cleanup
editFollowMarkupScene.leave(async (ctx) => {
  // Clear lock
  delete ctx.session.editingFollowId;
  delete ctx.session.pendingModeSwitch;

  ctx.scene.state = {};

  logger.info(`User ${ctx.from?.id} left editFollowMarkup scene`);
});

// Handle cancel action within scene
editFollowMarkupScene.action('cancel_scene', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    logger.info('edit_markup_cancelled', { userId: ctx.from.id });
    await ctx.scene.leave();
    await ctx.reply(followMessages.createCancelled, followsMenu(Boolean(ctx.session?.hasFollows)));
  } catch (error) {
    logger.error('Error in cancel_scene handler:', error);
    try {
      await ctx.reply(followMessages.cancelOperationError, followsMenu(Boolean(ctx.session?.hasFollows)));
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
});

export default editFollowMarkupScene;
