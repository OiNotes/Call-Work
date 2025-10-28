import { mainMenu } from '../keyboards/main.js';
import { shopApi, authApi } from '../utils/api.js';
import { handleSellerRole } from './seller/index.js';
import { handleBuyerRole } from './buyer/index.js';
import logger from '../utils/logger.js';
import * as smartMessage from '../utils/smartMessage.js';
import { messages } from '../texts/messages.js';

/**
 * Helper to create fake callback context for role handlers
 * CRITICAL: Don't use Object.assign with getters - spread operator preserves them
 */
function createFakeCallbackContext(ctx) {
  return {
    ...ctx,
    answerCbQuery: async () => {},
    editMessageText: async (text, extra) => {
      return await ctx.reply(text, extra);
    },
    // Copy essential Telegraf.js methods
    reply: ctx.reply.bind(ctx),
    replyWithHTML: ctx.replyWithHTML?.bind(ctx),
    replyWithMarkdown: ctx.replyWithMarkdown?.bind(ctx),
    deleteMessage: ctx.deleteMessage?.bind(ctx),
    telegram: ctx.telegram,
    // Explicitly copy getters (important for Telegraf.js)
    from: ctx.from,
    message: ctx.message,
    chat: ctx.chat,
    session: ctx.session
  };
}

/**
 * /start command handler
 */
export const handleStart = async (ctx) => {
  try {
    logger.info(`/start command from user ${ctx.from.id}`);

    // Clear conversation history on /start
    delete ctx.session.aiConversation;
    delete ctx.session.pendingAI;

    // === PRIORITY 1: Check if user has shop (seller priority) ===
    if (ctx.session.token) {
      try {
        const shops = await shopApi.getMyShop(ctx.session.token);

        if (shops && Array.isArray(shops) && shops.length > 0) {
          logger.info(`User ${ctx.from.id} has shop, auto-selecting seller role`);
          ctx.session.role = 'seller';

          // Save seller role to database
          try {
            await authApi.updateRole('seller', ctx.session.token);
            if (ctx.session.user) {
              ctx.session.user.selectedRole = 'seller';
            }
            logger.info(`User ${ctx.from.id} role saved to DB: seller`);
          } catch (error) {
            logger.error('Failed to save seller role to DB:', error);
            // Continue anyway - role is set in session
          }

          // Redirect to seller dashboard
          const fakeCtx = createFakeCallbackContext(ctx);
          await handleSellerRole(fakeCtx);
          return;
        }
      } catch (error) {
        logger.debug('No shop found (expected for buyers):', error.message);
        // Continue to check saved role
      }
    }

    // === PRIORITY 2: Check saved role (buyer fallback) ===
    const savedRole = ctx.session.user?.selectedRole;

    if (savedRole === 'buyer') {
      logger.info(`User ${ctx.from.id} has saved buyer role`);
      ctx.session.role = 'buyer';

      const fakeCtx = createFakeCallbackContext(ctx);
      await handleBuyerRole(fakeCtx);
      return;
    } else if (savedRole === 'seller') {
      // Seller without shop - should not happen, but handle gracefully
      logger.warn(`User ${ctx.from.id} has seller role but no shop`);
      ctx.session.role = 'seller';

      const fakeCtx = createFakeCallbackContext(ctx);
      await handleSellerRole(fakeCtx);
      return;
    }

    // === PRIORITY 3: New user - show role selection ===
    logger.info('New user, showing role selection menu');
    ctx.session.role = null;

    // Check if user has workspace access
    let showWorkspace = false;
    if (ctx.session.token) {
      try {
        const workerShops = await shopApi.getWorkerShops(ctx.session.token);
        showWorkspace = workerShops && workerShops.length > 0;
        logger.info(`User ${ctx.from.id} has workspace access: ${showWorkspace}`);
      } catch (error) {
        // Expected for new users or users without worker access
        logger.debug('Workspace check gracefully failed (expected for non-workers)', {
          userId: ctx.from.id,
          status: error.response?.status
        });
        // Continue without workspace button
      }
    }

    // Send welcome message using smartMessage (edit if exists, else send new)
    await smartMessage.send(ctx, {
      text: messages.start.welcome,
      keyboard: mainMenu(showWorkspace)
    });
  } catch (error) {
    logger.error('Error in /start handler:', error);
    throw error;
  }
};
