import { Scenes, Markup } from 'telegraf';
import { orderApi } from '../utils/api.js';
import { parseOrderNumbers } from '../utils/orderParser.js';
import logger from '../utils/logger.js';
import { messages, buttons as buttonText } from '../texts/messages.js';

const { seller: sellerMessages, general: generalMessages } = messages;

/**
 * Mark Orders Shipped Scene - Bulk management of order shipments
 *
 * Flow:
 * 1. Show prompt for order numbers
 * 2. Parse and validate input
 * 3. Show confirmation with order details
 * 4. Update orders and send notifications to buyers
 */

// ==========================================
// STEP 1: SHOW PROMPT
// ==========================================

const showPrompt = async (ctx) => {
  try {
    logger.info('mark_orders_shipped:step:prompt', { userId: ctx.from.id });

    // Validate session
    if (!ctx.session.shopId || !ctx.session.token) {
      await ctx.editMessageText(generalMessages.authorizationRequired);
      return await ctx.scene.leave();
    }

    // Get active orders to show count
    const orders = await orderApi.getShopOrders(
      ctx.session.shopId,
      ctx.session.token,
      { status: 'confirmed' }
    );
    const activeOrders = orders.filter((order) => ['confirmed', 'processing'].includes(order.status));

    if (activeOrders.length === 0) {
      await ctx.editMessageText(
        'Нет активных заказов для отметки.',
        Markup.inlineKeyboard([[Markup.button.callback(buttonText.back, 'cancel_scene')]])
      );
      return;
    }

    // Store active orders in wizard state for validation
    ctx.wizard.state.activeOrders = activeOrders;

    const message = `${sellerMessages.bulkShip.prompt}

Активных заказов: ${activeOrders.length}

Примеры:
• 1 3 5 — заказы 1, 3, 5
• 1-5 — заказы с 1 по 5
• 1 3-5 7 — заказы 1, 3, 4, 5, 7`;

    await ctx.editMessageText(
      message,
      Markup.inlineKeyboard([[Markup.button.callback(buttonText.cancel, 'cancel_scene')]])
    );

    return ctx.wizard.next();

  } catch (error) {
    logger.error('Error in markOrdersShipped showPrompt:', error);
    await ctx.editMessageText(generalMessages.actionFailed);
    return await ctx.scene.leave();
  }
};

// ==========================================
// STEP 2: HANDLE INPUT AND SHOW CONFIRMATION
// ==========================================

const handleInput = async (ctx) => {
  try {
    // Handle cancel button
    if (ctx.callbackQuery?.data === 'cancel_scene') {
      await ctx.answerCbQuery();
      await ctx.editMessageText(sellerMessages.bulkShip.cancelled);
      return await ctx.scene.leave();
    }

    // Only accept text input
    if (!ctx.message?.text) {
      return; // Ignore non-text messages
    }

    const userInput = ctx.message.text.trim();
    const activeOrders = ctx.wizard.state.activeOrders || [];

    if (activeOrders.length === 0) {
      await ctx.reply('Нет активных заказов. Попробуйте обновить список.');
      return await ctx.scene.leave();
    }

    // Parse order numbers
    const parseResult = parseOrderNumbers(userInput, activeOrders.length);

    if (!parseResult.valid) {
      await ctx.reply(
        `${sellerMessages.bulkShip.invalidInput}\n\nОшибка: ${parseResult.error}`,
        Markup.inlineKeyboard([[Markup.button.callback(buttonText.cancel, 'cancel_scene')]])
      );
      return; // Stay in scene, let user try again
    }

    // Map parsed numbers to actual order IDs
    const selectedOrders = parseResult.numbers.map(num => activeOrders[num - 1]);

    // Check if all orders exist
    const invalidIndexes = parseResult.numbers.filter(num => num > activeOrders.length);
    if (invalidIndexes.length > 0) {
      await ctx.reply(
        sellerMessages.bulkShip.invalidNumbers(invalidIndexes),
        Markup.inlineKeyboard([[Markup.button.callback(buttonText.cancel, 'cancel_scene')]])
      );
      return;
    }

    // Store selected orders for confirmation
    ctx.wizard.state.selectedOrders = selectedOrders;

    // Format confirmation message
    const ordersList = sellerMessages.bulkShip.confirmList(selectedOrders);
    const confirmMessage = `${sellerMessages.bulkShip.confirmTitle(selectedOrders.length)}

${ordersList}

Отметить эти заказы как отправленные?`;

    // Show confirmation
    await ctx.reply(
      confirmMessage,
      Markup.inlineKeyboard([
        [Markup.button.callback(buttonText.confirm, 'confirm_ship')],
        [Markup.button.callback(buttonText.cancel, 'cancel_ship')]
      ])
    );

    return ctx.wizard.next();

  } catch (error) {
    logger.error('Error in markOrdersShipped handleInput:', error);
    await ctx.reply(generalMessages.actionFailed);
    return await ctx.scene.leave();
  }
};

// ==========================================
// STEP 3: HANDLE CONFIRMATION
// ==========================================

const handleConfirmation = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const action = ctx.callbackQuery.data;

    // Cancel
    if (action === 'cancel_ship') {
      await ctx.editMessageText(sellerMessages.bulkShip.cancelled);
      return await ctx.scene.leave();
    }

    // Confirm
    if (action === 'confirm_ship') {
      const selectedOrders = ctx.wizard.state.selectedOrders || [];
      const token = ctx.session.token;

      if (selectedOrders.length === 0) {
        await ctx.editMessageText('Не выбрано заказов для отметки.');
        return await ctx.scene.leave();
      }

      // Get order IDs
      const orderIds = selectedOrders.map(o => o.id);

      // Update orders via API
      try {
        await orderApi.bulkUpdateOrderStatus(orderIds, 'shipped', token);

        logger.info('mark_orders_shipped:success', {
          userId: ctx.from.id,
          orderIds,
          count: orderIds.length
        });

        // Send notifications to buyers
        await sendBuyerNotifications(ctx, selectedOrders);

        // Show success message
        await ctx.editMessageText(sellerMessages.bulkShip.success(selectedOrders.length));

        // Return to active orders after 2 seconds
        setTimeout(async () => {
          try {
            // Import handler dynamically to avoid circular dependency
            const { handleActiveOrders } = await import('../handlers/seller/orders.js');
            await handleActiveOrders(ctx);
          } catch (error) {
            logger.error('Error returning to active orders:', error);
          }
        }, 2000);

        return await ctx.scene.leave();

      } catch (error) {
        logger.error('Error bulk updating orders:', error);
        const errorMsg = error.response?.data?.error || generalMessages.actionFailed;
        await ctx.editMessageText(errorMsg);
        return await ctx.scene.leave();
      }
    }

  } catch (error) {
    logger.error('Error in markOrdersShipped handleConfirmation:', error);
    await ctx.editMessageText(generalMessages.actionFailed);
    return await ctx.scene.leave();
  }
};

// ==========================================
// HELPER: SEND BUYER NOTIFICATIONS
// ==========================================

async function sendBuyerNotifications(ctx, orders) {
  const bot = ctx.telegram;

  for (const order of orders) {
    try {
      if (!order.buyer_telegram_id) {
        logger.warn('mark_orders_shipped:no_buyer_id', { orderId: order.id });
        continue;
      }

      const message = `📦 Заказ отправлен!

Ваш заказ #${order.id} отправлен продавцом.

Товар: ${order.product_name}
Количество: ${order.quantity} шт
Сумма: $${order.total_price}

Магазин: ${order.shop_name || ctx.session.shopName || 'Магазин'}`;

      await bot.sendMessage(order.buyer_telegram_id, message);

      logger.info('mark_orders_shipped:buyer_notified', {
        orderId: order.id,
        buyerId: order.buyer_telegram_id
      });

    } catch (error) {
      logger.error('Error sending buyer notification:', {
        orderId: order.id,
        buyerId: order.buyer_telegram_id,
        error: error.message
      });
      // Continue with other notifications even if one fails
    }
  }
}

// ==========================================
// CREATE WIZARD SCENE
// ==========================================

const markOrdersShippedScene = new Scenes.WizardScene(
  'markOrdersShipped',
  showPrompt,
  handleInput,
  handleConfirmation
);

// Handle scene leave
markOrdersShippedScene.leave(async (ctx) => {
  ctx.wizard.state = {};
  logger.info(`User ${ctx.from?.id} left markOrdersShipped scene`);
});

// Handle cancel action within scene
markOrdersShippedScene.action('cancel_scene', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    logger.info('mark_orders_shipped:cancelled', { userId: ctx.from.id });

    await ctx.editMessageText(sellerMessages.bulkShip.cancelled);
    await ctx.scene.leave();

  } catch (error) {
    logger.error('Error in cancel_scene handler:', error);
    try {
      await ctx.editMessageText(generalMessages.actionFailed);
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
});

export default markOrdersShippedScene;
