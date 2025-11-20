import logger from '../utils/logger.js';
import { mainMenuButton } from '../keyboards/common.js';
import { reply as cleanReply } from '../utils/cleanReply.js';
import { messages } from '../texts/messages.js';
const { general: generalMessages } = messages;

/**
 * Global error handling middleware
 */
const errorMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    logger.error('Error in handler:', {
      error: error.message,
      stack: error.stack,
      update: ctx.update,
    });

    // User-friendly error message
    const errorMessage = generalMessages.actionFailed;

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(errorMessage, mainMenuButton);
      } else {
        await cleanReply(ctx, errorMessage, mainMenuButton);
      }
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
};

export default errorMiddleware;
