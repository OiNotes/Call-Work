import { Telegraf, Scenes, session } from 'telegraf';
import dotenv from 'dotenv';
import config from './config/index.js';
import logger from './utils/logger.js';
import { reply as cleanReply } from './utils/cleanReply.js';
import { logWebAppConfig, getWebAppUrl } from './utils/webappUrl.js';

// Middleware
import authMiddleware from './middleware/auth.js';
import errorMiddleware from './middleware/error.js';
import debounceMiddleware from './middleware/debounce.js';
import sessionRecoveryMiddleware from './middleware/sessionRecovery.js';

// Scenes
import createShopScene from './scenes/createShop.js';
import addProductScene from './scenes/addProduct.js';
import searchShopScene from './scenes/searchShop.js';
import manageWalletsScene from './scenes/manageWallets.js';
import createFollowScene from './scenes/createFollow.js';
import migrateChannelScene from './scenes/migrateChannel.js';
import paySubscriptionScene from './scenes/paySubscription.js';
import upgradeShopScene from './scenes/upgradeShop.js';
import manageWorkersScene from './scenes/manageWorkers.js';

// Handlers
import { handleStart } from './handlers/start.js';
import { setupSellerHandlers, setupFollowHandlers } from './handlers/seller/index.js';
import { setupBuyerHandlers } from './handlers/buyer/index.js';
import { setupCommonHandlers } from './handlers/common.js';
import { setupAIProductHandlers } from './handlers/seller/aiProducts.js';
import { setupWorkspaceHandlers } from './handlers/workspace/index.js';

dotenv.config();

// Validate required environment variables
if (!config.botToken) {
  logger.error('BOT_TOKEN is not defined in environment variables');
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(config.botToken);

// Setup session and scenes
const stage = new Scenes.Stage([
  createShopScene,
  addProductScene,
  searchShopScene,
  manageWalletsScene,
  createFollowScene,
  migrateChannelScene,
  paySubscriptionScene,
  upgradeShopScene,
  manageWorkersScene
]);

bot.use(session());
bot.use(stage.middleware());

// Session state logging middleware (for debugging)
bot.use((ctx, next) => {
  if (ctx.from) {
    logger.debug('Session state:', {
      userId: ctx.from.id,
      username: ctx.from.username,
      shopId: ctx.session?.shopId,
      role: ctx.session?.role,
      hasToken: !!ctx.session?.token,
      updateType: ctx.updateType
    });
  }
  return next();
});

// Apply middleware
bot.use(debounceMiddleware);        // Prevent rapid clicks
bot.use(sessionRecoveryMiddleware); // Recover session after restart

// Apply auth and error middleware
bot.use(authMiddleware);
bot.use(errorMiddleware);

// Register handlers
bot.start(handleStart);
setupSellerHandlers(bot);
setupFollowHandlers(bot);
setupBuyerHandlers(bot);
setupWorkspaceHandlers(bot);
setupCommonHandlers(bot);

// AI Product Management (must be registered last to handle text messages)
setupAIProductHandlers(bot);

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down bot...');
  try {
    await bot.stop();
    logger.info('Bot stopped successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

// Error handling
bot.catch((err, ctx) => {
  logger.error(`Bot error for ${ctx.updateType}:`, err);

  // CRITICAL FIX (BUG #5): Clear corrupted scene to allow /start to work
  if (ctx.scene) {
    ctx.scene.leave().catch(() => {});
  }

  // Clear session state if corrupted
  if (ctx.session && typeof ctx.session === 'object') {
    // Keep essential auth data, clear wizard state
    const { token, user, shopId, shopName, role } = ctx.session;
    ctx.session = { token, user, shopId, shopName, role };
  }

  cleanReply(ctx, 'Произошла ошибка. Нажмите /start для перезапуска').catch(() => {});
});

// Export bot instance for backend integration
export { bot };

// Launch function (can be called from backend or standalone)
export async function startBot() {
  try {
    // Log WebApp configuration before launch
    logWebAppConfig();

    // Automatically set Menu Button with WebApp URL BEFORE launch
    try {
      const webappUrl = getWebAppUrl();
      await bot.telegram.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: '🛍 Мой магазин',
          web_app: { url: webappUrl }
        }
      });
      logger.info(`Menu Button configured: ${webappUrl}`);
    } catch (menuError) {
      logger.warn('Failed to set Menu Button automatically:', menuError.message);
      logger.warn('You can set it manually in BotFather: /setmenubutton');
    }

    // Launch bot (this starts polling and won't return in polling mode)
    bot.launch();

    logger.info(`Bot started successfully in ${config.nodeEnv} mode`);
    logger.info(`Backend URL: ${config.backendUrl}`);
  } catch (error) {
    logger.error('Failed to launch bot:', error);
    throw error;
  }
}

// Auto-start when run directly (not imported)
// Check if this file is being run directly (not imported as a module)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule || process.argv[1]?.includes('bot.js')) {
  startBot().catch((error) => {
    logger.error('Bot startup failed:', error);
    process.exit(1);
  });
}
