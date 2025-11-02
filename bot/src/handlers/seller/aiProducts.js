import { Markup } from 'telegraf';
import { processProductCommand, executeBulkPriceUpdate } from '../../services/productAI.js';
import { productApi } from '../../utils/api.js';
import { sellerMenu } from '../../keyboards/seller.js';
import { isNoiseCommand } from '../../utils/fuzzyMatch.js';
import logger from '../../utils/logger.js';
import { reply as cleanReply } from '../../utils/cleanReply.js';
import * as smartMessage from '../../utils/smartMessage.js';
import { messages } from '../../texts/messages.js';
const { seller: { aiProducts: aiMessages } } = messages;

/**
 * AI Product Management Handler
 * Handles text messages from sellers for AI-powered product management
 */

/**
 * Handle AI product command
 * Called when seller (with shop) sends a text message
 */
export async function handleAIProductCommand(ctx) {
  try {
    // FIX BUG #3: Check role FIRST - buyer has NO AI access
    // Delete buyer's text messages silently (NO response, NO menu)
    if (ctx.session.role === 'buyer') {
      // Silent deletion - buyer should NOT see any AI messages
      await ctx.deleteMessage(ctx.message.message_id).catch((err) => {
        logger.debug('Could not delete buyer message:', err.message);
      });
      return; // Exit handler completely, no processing
    }

    // Check if in a scene
    if (ctx.scene.current) {
      return; // In a scene, let scene handle it
    }

    // Only process if user is seller with a shop
    if (ctx.session.role !== 'seller' || !ctx.session.shopId) {
      return; // Ignore, not for AI
    }

    // Get user message
    const userMessage = ctx.message?.text;
    if (!userMessage || !userMessage.trim()) {
      return;
    }

    // Проверка pending операций - обработать подтверждение напрямую (не через AI)
    if (ctx.session.pendingBulkUpdate || ctx.session.pendingAI) {
      const normalizedText = userMessage.trim().toLowerCase();
      
      // Обработка bulk price update подтверждения
      if (ctx.session.pendingBulkUpdate) {
        // Подтверждение
        if (['да', 'yes', 'apply', 'применить', 'подтверждаю', 'ok', 'ок'].includes(normalizedText)) {
          logger.info('Text confirmation received for bulk price update', { userId: ctx.from.id });
          return await handleBulkPricesConfirmText(ctx);
        }
        
        // Отмена
        if (['нет', 'no', 'отмена', 'cancel', 'назад', 'отменить'].includes(normalizedText)) {
          logger.info('Text cancellation received for bulk price update', { userId: ctx.from.id });
          return await handleBulkPricesCancelText(ctx);
        }
        
        // Неопределенный ответ - напомнить о pending операции
        await smartMessage.send(ctx, {
          text: '⚠️ Сначала ответьте на предыдущий вопрос.\n\nНажмите кнопку ниже или напишите "да" для применения / "нет" для отмены.',
          parseMode: 'HTML'
        });
        return;
      }
      
      // Аналогично для других pending операций
      if (ctx.session.pendingAI) {
        await smartMessage.send(ctx, {
          text: '⚠️ Пожалуйста, завершите предыдущую операцию.',
          parseMode: 'HTML'
        });
        return;
      }
    }

    // Filter noise commands (greetings, thanks, etc.)
    if (isNoiseCommand(userMessage)) {
      // Ignore silently - don't waste tokens on "привет" or "спасибо"
      logger.debug('ai_noise_filtered', {
        userId: ctx.from.id,
        message: userMessage.slice(0, 50)
      });
      return;
    }

    // Race condition guard - prevent concurrent AI calls
    if (ctx.session.aiProcessing) {
      logger.debug('ai_concurrent_blocked', {
        userId: ctx.from.id,
        message: userMessage.slice(0, 50)
      });
      await smartMessage.send(ctx, { text: aiMessages.processing });
      return;
    }

    // Mark as processing
    ctx.session.aiProcessing = true;

    // Rate limiting - max 10 AI commands per minute
    if (!ctx.session.aiCommands) {
      ctx.session.aiCommands = [];
    }
    
    // Clean old timestamps (older than 1 minute)
    ctx.session.aiCommands = ctx.session.aiCommands.filter(
      timestamp => Date.now() - timestamp < 60000
    );

    // Check rate limit
    if (ctx.session.aiCommands.length >= 10) {
      await smartMessage.send(ctx, { text: aiMessages.rateLimitReached });
      return;
    }

    // Add current timestamp
    ctx.session.aiCommands.push(Date.now());

    // Show typing indicator
    await ctx.sendChatAction('typing');

    // Fetch current products
    const products = await productApi.getShopProducts(ctx.session.shopId);

    // Process AI command
    const result = await processProductCommand(userMessage, {
      shopId: ctx.session.shopId,
      shopName: ctx.session.shopName,
      token: ctx.session.token,
      products,
      ctx  // Pass ctx for progress updates and confirmation prompts
    });

    // Handle result
    if (result.needsConfirmation) {
      // Bulk operation needs confirmation
      await smartMessage.send(ctx, {
        text: result.message,
        keyboard: result.keyboard
      });
      return;
    }

    if (result.needsClarification) {
      // Multiple matches - show options as buttons
      await handleClarification(ctx, result);
      return;
    }

    if (result.fallbackToMenu) {
      // AI unavailable - show menu
      await smartMessage.send(ctx, {
        text: result.message,
        keyboard: sellerMenu(0, { hasFollows: ctx.session?.hasFollows })
      });
      return;
    }

    if (result.retry) {
      // Temporary error - can retry
      await smartMessage.send(ctx, { text: result.message });
      return;
    }

    // ONLY send message for tool call results (they weren't sent via streaming)
    // Text responses were already sent via streaming in processProductCommand
    // ALSO send error messages that weren't sent (missing operation field)
    if (result.operation || (!result.success && result.message)) {
      // Tool call result OR error - send it
      await cleanReply(ctx, result.message);
    }
    // If no operation field and success=true, it's a text response already sent via streaming

    // Delete user message immediately after processing
    await ctx.deleteMessage(ctx.message.message_id).catch((err) => {
      logger.debug('Could not delete user AI message:', err.message);
    });

    // Log analytics
    logger.info('ai_command_result', {
      userId: ctx.from.id,
      shopId: ctx.session.shopId,
      success: result.success,
      operation: result.operation || 'text_response',
      hadToolCalls: !!result.operation,
      hadPendingOperation: !!(ctx.session.pendingBulkUpdate || ctx.session.pendingAI),
      messagePreview: userMessage.slice(0, 100)
    });

  } catch (error) {
    logger.error('AI product command handler error:', {
      error: error.message,
      userId: ctx.from?.id,
      shopId: ctx.session?.shopId
    });

    // Graceful error handling
    try {
      await smartMessage.send(ctx, {
        text: '❌ Произошла ошибка. Используйте меню.',
        keyboard: sellerMenu(0, { hasFollows: ctx.session?.hasFollows })
      });
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  } finally {
    // Always clear processing flag
    if (ctx.session) {
      ctx.session.aiProcessing = false;
    }
  }
}

/**
 * Handle clarification request (multiple matches)
 */
async function handleClarification(ctx, result) {
  const { message, options, operation } = result;

  // Store pending operation in session
  ctx.session.pendingAI = {
    operation,
    options,
    timestamp: Date.now()
  };

  // Create inline keyboard with options
  const keyboard = {
    inline_keyboard: [
      ...options.map(opt => [{
        text: `${opt.name} ($${opt.price})`,
        callback_data: `ai_select:${opt.id}`
      }]),
      [{
        text: '◀️ Назад',
        callback_data: 'ai_cancel'
      }]
    ]
  };

  await cleanReply(ctx, message, {
    reply_markup: keyboard
  });
}

/**
 * Handle product selection from clarification
 */
export async function handleAISelection(ctx) {
  try {
    await ctx.answerCbQuery();

    const productId = parseInt(ctx.match[1]);

    // Check if pending operation exists
    if (!ctx.session.pendingAI) {
      await ctx.editMessageText(
        '⏳ Операция устарела. Попробуйте снова.',
        Markup.inlineKeyboard([
          [Markup.button.callback('↩️ В меню', 'seller:menu')]
        ])
      );
      return;
    }

    const { operation, options } = ctx.session.pendingAI;

    // Find selected product
    const selectedProduct = options.find(p => p.id === productId);
    if (!selectedProduct) {
      await ctx.editMessageText(
        '❌ Товар не найден',
        Markup.inlineKeyboard([
          [Markup.button.callback('↩️ В меню', 'seller:menu')]
        ])
      );
      delete ctx.session.pendingAI;
      return;
    }

    // Execute operation
    if (operation === 'delete') {
      try {
        await productApi.deleteProduct(productId, ctx.session.token);
        await ctx.editMessageText(
          `✅ Удалён: ${selectedProduct.name} ($${selectedProduct.price})`,
          Markup.inlineKeyboard([
            [Markup.button.callback('↩️ В меню', 'seller:menu')]
          ])
        );

        logger.info('ai_clarification_delete', {
          userId: ctx.from.id,
          shopId: ctx.session.shopId,
          productId,
          productName: selectedProduct.name
        });
      } catch (error) {
        logger.error('AI clarification delete failed:', error);
        await ctx.editMessageText(
          '❌ Не удалось удалить товар',
          Markup.inlineKeyboard([
            [Markup.button.callback('↩️ В меню', 'seller:menu')]
          ])
        );
      }
    }

    // Clear pending operation
    delete ctx.session.pendingAI;

  } catch (error) {
    logger.error('AI selection handler error:', error);
    try {
      await ctx.editMessageText(
        '❌ Ошибка обработки',
        Markup.inlineKeyboard([
          [Markup.button.callback('↩️ В меню', 'seller:menu')]
        ])
      );
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Handle cancel clarification
 */
export async function handleAICancel(ctx) {
  try {
    await ctx.answerCbQuery(); // Silent
    // Silent transition - delete clarification message
    await ctx.deleteMessage().catch((err) => {
      logger.debug('Could not delete AI clarification message:', err.message);
    });
    delete ctx.session.pendingAI;
  } catch (error) {
    logger.error('AI cancel handler error:', error);
  }
}

/**
 * Handle bulk price update confirmation
 */
export async function handleBulkPricesConfirm(ctx) {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageText('⏳ Применяю изменения...');

    const result = await executeBulkPriceUpdate(
      ctx.session.shopId,
      ctx.session.token,
      ctx
    );

    // Обновить сообщение результатом
    if (result && result.message) {
      await ctx.editMessageText(result.message).catch(err => {
        logger.error('Failed to update bulk prices message:', err);
      });
    }

    logger.info('bulk_prices_confirmed', {
      userId: ctx.from.id,
      shopId: ctx.session.shopId,
      success: result.success
    });
  } catch (error) {
    logger.error('Bulk prices confirm handler error:', error);
    try {
      await ctx.editMessageText(
        '❌ Ошибка при выполнении',
        Markup.inlineKeyboard([
          [Markup.button.callback('↩️ В меню', 'seller:menu')]
        ])
      );
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Handle bulk price update cancellation
 */
export async function handleBulkPricesCancel(ctx) {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageText('❌ Изменение цен отменено');
    delete ctx.session.pendingBulkUpdate;

    logger.info('bulk_prices_cancelled', {
      userId: ctx.from.id,
      shopId: ctx.session.shopId
    });
  } catch (error) {
    logger.error('Bulk prices cancel handler error:', error);
  }
}

/**
 * Handle bulk price update confirmation from TEXT message
 * (when user writes "да" instead of clicking button)
 */
export async function handleBulkPricesConfirmText(ctx) {
  try {
    // Send initial progress message (NO answerCbQuery - this is text!)
    const progressMsg = await cleanReply(ctx, '⏳ Применяю изменения...');

    const result = await executeBulkPriceUpdate(
      ctx.session.shopId,
      ctx.session.token,
      ctx
    );

    // Обновить сообщение результатом
    if (progressMsg && result && result.message) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        null,
        result.message
      ).catch(err => {
        logger.error('Failed to update bulk prices message:', err);
      });
    }

    delete ctx.session.pendingBulkUpdate;

    logger.info('bulk_prices_confirmed_text', {
      userId: ctx.from.id,
      shopId: ctx.session.shopId,
      success: result.success
    });
  } catch (error) {
    logger.error('Bulk prices confirm text handler error:', error);
    try {
      await cleanReply(ctx, '❌ Ошибка при выполнении');
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
}

/**
 * Handle bulk price update cancellation from TEXT message
 * (when user writes "нет" instead of clicking button)
 */
export async function handleBulkPricesCancelText(ctx) {
  try {
    // Send cancellation message (NO answerCbQuery - this is text!)
    await cleanReply(ctx, '❌ Изменение цен отменено');
    delete ctx.session.pendingBulkUpdate;

    logger.info('bulk_prices_cancelled_text', {
      userId: ctx.from.id,
      shopId: ctx.session.shopId
    });
  } catch (error) {
    logger.error('Bulk prices cancel text handler error:', error);
  }
}

/**
 * Setup AI product handlers
 */
export function setupAIProductHandlers(bot) {
  // Text message handler (for AI commands)
  // User message deleted immediately after processing
  bot.on('text', handleAIProductCommand);

  // Clarification selection handlers
  bot.action(/^ai_select:(\d+)$/, handleAISelection);
  bot.action('ai_cancel', handleAICancel);

  // Bulk price update confirmation handlers
  bot.action('bulk_prices_confirm', handleBulkPricesConfirm);
  bot.action('bulk_prices_cancel', handleBulkPricesCancel);

  logger.info('AI product handlers registered');
}

export default {
  handleAIProductCommand,
  setupAIProductHandlers
};
