import { Markup } from 'telegraf';
import { orderApi } from '../../utils/api.js';
import { messages, buttons as buttonText } from '../../texts/messages.js';
import logger from '../../utils/logger.js';

const { general: generalMessages } = messages;

const backToMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback(buttonText.backToMenu, 'seller:menu')]
]);

const formatPrice = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '0';
  }
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};

const ensureShopSession = (ctx) => {
  const shopId = ctx.session.currentShopId ?? ctx.session.shopId ?? null;
  if (shopId && ctx.session.currentShopId !== shopId) {
    ctx.session.currentShopId = shopId;
  }
  return shopId;
};

/**
 * Show active orders (status = confirmed)
 */
export const handleActiveOrders = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const shopId = ensureShopSession(ctx);
    const token = ctx.session.token;

    if (!shopId) {
      await ctx.reply(generalMessages.shopRequired, backToMenuKeyboard);
      return;
    }

    if (!token) {
      await ctx.reply(generalMessages.authorizationRequired, backToMenuKeyboard);
      return;
    }

    const activeOrders = await orderApi.getShopOrders(shopId, token, { status: 'confirmed' });

    if (!Array.isArray(activeOrders) || activeOrders.length === 0) {
      const message = `📦 Активные заказы

Нет активных заказов.

Заказы появятся здесь после оплаты покупателем.`;
      await ctx.reply(message, backToMenuKeyboard);
      logger.info(`User ${ctx.from.id} - no active orders for shop ${shopId}`);
      return;
    }

    const ordersList = activeOrders.map((order, index) => {
      const buyer = order.buyer_username ? `@${order.buyer_username}` : (order.buyer_first_name || 'Покупатель');
      const productName = order.product_name || order.productName || 'Товар';
      const quantity = order.quantity ?? 1;
      const totalPrice = formatPrice(order.total_price ?? order.totalPrice ?? 0);
      return `${index + 1}. ${buyer} • ${productName} (${quantity} шт) • $${totalPrice}`;
    }).join('\n');

    const total = activeOrders.reduce((sum, order) => {
      const price = Number(order.total_price ?? order.totalPrice ?? 0);
      return sum + (Number.isFinite(price) ? price : 0);
    }, 0);

    const message = `📦 Активные заказы (${activeOrders.length})

Заказы, ожидающие отправки:

${ordersList}

Итого: $${formatPrice(total)}`;

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback('Отметить выдачу', 'seller:mark_shipped')],
      [Markup.button.callback('Обновить', 'seller:active_orders')],
      [Markup.button.callback(buttonText.backToMenu, 'seller:menu')]
    ]);

    await ctx.reply(message, buttons);

    logger.info(`User ${ctx.from.id} viewed ${activeOrders.length} active orders for shop ${shopId}`);

  } catch (error) {
    console.error('Error in handleActiveOrders:', error);
    logger.error('Error in handleActiveOrders:', error);

    try {
      await ctx.answerCbQuery('Не удалось загрузить заказы', { show_alert: true });
    } catch (cbError) {
      logger.debug('Failed to answer callback query after active orders error', cbError);
    }

    try {
      await ctx.reply('Не удалось загрузить активные заказы. Попробуйте позже.', backToMenuKeyboard);
    } catch (replyError) {
      logger.debug('Failed to send fallback message after active orders error', replyError);
    }
  }
};

/**
 * Show delivered order history
 */
export const handleOrderHistory = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const shopId = ensureShopSession(ctx);
    const token = ctx.session.token;

    if (!shopId) {
      await ctx.reply(generalMessages.shopRequired, backToMenuKeyboard);
      return;
    }

    if (!token) {
      await ctx.reply(generalMessages.authorizationRequired, backToMenuKeyboard);
      return;
    }

    const deliveredOrders = await orderApi.getShopOrders(shopId, token, { status: 'delivered' });

    if (!Array.isArray(deliveredOrders) || deliveredOrders.length === 0) {
      const emptyMessage = `📋 История заказов

Нет завершённых заказов.

Как только заказ будет выдан, он появится в истории.`;
      await ctx.reply(emptyMessage, backToMenuKeyboard);
      logger.info(`User ${ctx.from.id} - no delivered orders for shop ${shopId}`);
      return;
    }

    const latestOrders = deliveredOrders.slice(0, 10);
    const ordersList = latestOrders.map((order, index) => {
      const buyer = order.buyer_username ? `@${order.buyer_username}` : (order.buyer_first_name || 'Покупатель');
      const productName = order.product_name || order.productName || 'Товар';
      const quantity = order.quantity ?? 1;
      const totalPrice = formatPrice(order.total_price ?? order.totalPrice ?? 0);
      const deliveredAt = order.updated_at || order.delivered_at || order.completed_at || order.paid_at;
      const dateLabel = deliveredAt ? new Date(deliveredAt).toLocaleDateString('ru-RU') : '';
      const dateSuffix = dateLabel ? ` • ${dateLabel}` : '';
      return `${index + 1}. ${buyer} • ${productName} (${quantity} шт) • $${totalPrice}${dateSuffix}`;
    }).join('\n');

    const totalRevenue = deliveredOrders.reduce((sum, order) => {
      const price = Number(order.total_price ?? order.totalPrice ?? 0);
      return sum + (Number.isFinite(price) ? price : 0);
    }, 0);

    const historyMessage = `📋 История заказов (${deliveredOrders.length})

Последние ${latestOrders.length} заказов:

${ordersList}

Всего выручка: $${formatPrice(totalRevenue)}`;

    const historyKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Обновить', 'seller:order_history')],
      [Markup.button.callback(messages.buttons.backToMenu, 'seller:menu')]
    ]);

    await ctx.reply(historyMessage, historyKeyboard);
    logger.info(`User ${ctx.from.id} viewed order history (${deliveredOrders.length} orders) for shop ${shopId}`);

  } catch (error) {
    console.error('Error in handleOrderHistory:', error);
    logger.error('Error in handleOrderHistory:', error);

    try {
      await ctx.answerCbQuery('Не удалось загрузить историю заказов', { show_alert: true });
    } catch (cbError) {
      logger.debug('Failed to answer callback query after order history error', cbError);
    }

    try {
      await ctx.reply('Не удалось загрузить историю заказов. Попробуйте позже.', backToMenuKeyboard);
    } catch (replyError) {
      logger.debug('Failed to send fallback message after order history error', replyError);
    }
  }
};

/**
 * Mark order as shipped
 */
export const handleMarkShipped = async (ctx) => {
  try {
    const orderId = ctx.match[1];
    const token = ctx.session.token;

    await orderApi.updateOrderStatus(orderId, 'shipped', token);

    await ctx.answerCbQuery('✅ Заказ отмечен как отправленный');

    // Update message with new status
    const newMessage = ctx.callbackQuery.message.text + '\n\n✅ Отправлено';
    await ctx.editMessageText(
      newMessage,
      Markup.inlineKeyboard([[
        Markup.button.callback('✓ Доставлено', `order:deliver:${orderId}`)
      ]])
    );

    logger.info(`Order ${orderId} marked as shipped by user ${ctx.from.id}`);

  } catch (error) {
    logger.error('Error marking order as shipped:', error);
    await ctx.answerCbQuery('Не удалось обновить статус');
  }
};

/**
 * Mark order as delivered (complete)
 */
export const handleMarkDelivered = async (ctx) => {
  try {
    const orderId = ctx.match[1];
    const token = ctx.session.token;

    await orderApi.updateOrderStatus(orderId, 'delivered', token);

    await ctx.answerCbQuery('✅ Заказ завершён');

    // Final message - no more buttons
    const newMessage = ctx.callbackQuery.message.text.replace('\n\n✅ Отправлено', '') + '\n\n✅ Доставлено';
    await ctx.editMessageText(newMessage);

    logger.info(`Order ${orderId} marked as delivered by user ${ctx.from.id}`);

  } catch (error) {
    logger.error('Error marking order as delivered:', error);
    await ctx.answerCbQuery('Не удалось обновить статус');
  }
};

/**
 * Cancel order
 */
export const handleCancelOrder = async (ctx) => {
  try {
    const orderId = ctx.match[1];
    const token = ctx.session.token;

    await orderApi.updateOrderStatus(orderId, 'cancelled', token);

    await ctx.answerCbQuery('❌ Заказ отменён');

    const newMessage = ctx.callbackQuery.message.text + '\n\n❌ Отменён';
    await ctx.editMessageText(newMessage);

    logger.info(`Order ${orderId} cancelled by user ${ctx.from.id}`);

  } catch (error) {
    logger.error('Error cancelling order:', error);
    await ctx.answerCbQuery('Не удалось отменить заказ');
  }
};
