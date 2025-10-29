import { Markup } from 'telegraf';
import { followsMenu, followDetailMenu, followCatalogMenu, sellerMenu, sellerMenuNoShop } from '../../keyboards/seller.js';
import { followApi } from '../../utils/api.js';
import { formatFollowDetail } from '../../utils/minimalist.js';
import logger from '../../utils/logger.js';
import { messages } from '../../texts/messages.js';

const { general: generalMessages, follows: followMessages } = messages;

const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '0';
  }
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};

const buildFollowLabel = (follow) => {
  const name = follow.source_shop_name || follow.sourceShopName || follow.name || 'Магазин';
  const isResell = follow.mode === 'resell';
  const markupRaw = isResell ? Number(follow.markup_percentage ?? follow.markup ?? 0) : null;
  const markupSuffix = isResell && Number.isFinite(markupRaw) ? ` (+${Math.round(markupRaw)}%)` : '';
  const modeLabel = isResell ? 'Перепродажа' : 'Мониторинг';
  return `🏪 ${name} (${modeLabel}${markupSuffix})`;
};

const sendOrEdit = async (ctx, text, keyboard) => {
  const replyMarkup = keyboard instanceof Object ? keyboard : undefined;
  if (ctx.updateType === 'callback_query' && ctx.callbackQuery?.message) {
    return ctx.editMessageText(text, replyMarkup);
  }
  return ctx.reply(text, replyMarkup);
};

const formatProductLine = (index, name, price, stock) => (
  `${index + 1}. ${name} • $${formatMoney(price)} • ${Number.isFinite(stock) ? stock : 0} шт`
);

const buildCatalogMessage = (followInfo, products, mode) => {
  const lines = [];
  const shopName = followInfo.source_shop_name || followInfo.sourceShopName || 'Магазин';
  const isResell = mode === 'resell';
  const markupRaw = isResell ? Number(followInfo.markup_percentage ?? followInfo.markup ?? 0) : null;
  const markupSuffix = isResell && Number.isFinite(markupRaw) ? ` (+${Math.round(markupRaw)}%)` : '';
  const modeLabel = isResell ? `Перепродажа${markupSuffix}` : 'Мониторинг';

  lines.push(`🏪 ${shopName}`);
  lines.push(`Режим: ${modeLabel}`);
  lines.push('');

  if (!Array.isArray(products) || products.length === 0) {
    lines.push(isResell ? followMessages.resellProductsEmpty : followMessages.monitorProductsEmpty);
    return lines.join('\n');
  }

  products.slice(0, 10).forEach((product, index) => {
    if (isResell) {
      const synced = product.synced_product || product.syncedProduct || {};
      const name = synced.name || product.source_product?.name || product.name || `Товар #${product.id}`;
      const price = synced.price ?? product.pricing?.expected_price ?? product.source_product?.price ?? 0;
      const stock = synced.stock_quantity ?? product.source_product?.stock_quantity ?? 0;
      lines.push(formatProductLine(index, name, price, stock));
    } else {
      const name = product.name || `Товар #${product.id}`;
      const price = product.price ?? 0;
      const stock = product.stock_quantity ?? 0;
      lines.push(formatProductLine(index, name, price, stock));
    }
  });

  return lines.join('\n');
};

/**
 * View all follows for current shop
 */
export const handleViewFollows = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    if (!ctx.session.shopId) {
      await ctx.reply(
        generalMessages.shopRequired,
        sellerMenuNoShop
      );
      return;
    }

    if (!ctx.session.token) {
      await ctx.reply(
        generalMessages.authorizationRequired,
        sellerMenu(0, { hasFollows: ctx.session?.hasFollows })
      );
      return;
    }

    const follows = await followApi.getMyFollows(ctx.session.shopId, ctx.session.token);

    const hasFollows = Array.isArray(follows) && follows.length > 0;
    ctx.session.hasFollows = hasFollows;

    if (!hasFollows) {
      const text = `${followMessages.contextDetailed}\n\n${followMessages.emptyState}`;
      await sendOrEdit(ctx, text, followsMenu(false));
      return;
    }

    const followButtons = follows.map((follow) => [
      Markup.button.callback(buildFollowLabel(follow), `follow_detail:${follow.id}`)
    ]);

    const listText = follows
      .map((follow, index) => `${index + 1}. ${buildFollowLabel(follow).slice(2)}`) // remove leading emoji for text list
      .join('\n');

    const message = `${followMessages.contextDetailed}\n\n${listText}`;

    await sendOrEdit(ctx, message, followsMenu(true, followButtons));
    logger.info(`User ${ctx.from.id} viewed follows (${follows.length} total)`);
  } catch (error) {
    logger.error('Error fetching follows:', error);
    await sendOrEdit(
      ctx,
      followMessages.loadError,
      followsMenu(Boolean(ctx.session?.hasFollows))
    );
  }
};

/**
 * Start creating a follow
 */
export const handleCreateFollow = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    if (!ctx.session.shopId) {
      await ctx.reply(
        generalMessages.shopRequired,
        sellerMenuNoShop
      );
      return;
    }

    await ctx.scene.enter('createFollow');
  } catch (error) {
    logger.error('Error entering createFollow scene:', error);
    await ctx.reply(
      generalMessages.actionFailed,
      followsMenu(Boolean(ctx.session?.hasFollows))
    );
  }
};

/**
 * View follow detail
 */
export const handleFollowDetail = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const followId = parseInt(ctx.match[1]);

    if (!ctx.session.token) {
      await ctx.editMessageText(generalMessages.authorizationRequired);
      return;
    }

    const token = ctx.session.token;

    let followDetail;
    try {
      followDetail = await followApi.getFollowDetail(followId, token);
    } catch (error) {
      if (error.response?.status === 404) {
        await ctx.editMessageText(followMessages.notFound, followsMenu(false));
        return;
      }
      if (error.response?.status === 403) {
        await ctx.editMessageText(followMessages.accessDenied, followsMenu(false));
        return;
      }
      throw error;
    }

    const productsPayload = await followApi.getFollowProducts(followId, token, { limit: 10 });
    const payload = productsPayload?.data || productsPayload || {};
    const mode = payload.mode || followDetail.mode;
    const products = Array.isArray(payload.products) ? payload.products : [];

    const message = buildCatalogMessage(followDetail, products, mode);

    await ctx.editMessageText(message, followCatalogMenu(followId));
    logger.info(`User ${ctx.from.id} viewed follow catalog ${followId}`);
  } catch (error) {
    logger.error('Error viewing follow detail:', error);
    const status = error.response?.status;
    if (status === 404) {
      await ctx.editMessageText(followMessages.notFound, followsMenu(false));
    } else if (status === 403) {
      await ctx.editMessageText(followMessages.accessDenied, followsMenu(false));
    } else {
      await ctx.editMessageText(followMessages.loadError, followsMenu(false));
    }
  }
};

export const handleFollowSettings = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const followId = parseInt(ctx.match[1], 10);

    if (!ctx.session.token) {
      await ctx.editMessageText(generalMessages.authorizationRequired);
      return;
    }

    const follow = await followApi.getFollowDetail(followId, ctx.session.token);

    const message = formatFollowDetail(follow);
    await ctx.editMessageText(message, followDetailMenu(followId, follow.mode));
    logger.info(`User ${ctx.from.id} viewed follow settings ${followId}`);
  } catch (error) {
    logger.error('Error viewing follow settings:', error);

    const status = error.response?.status;
    if (status === 404) {
      await ctx.editMessageText(followMessages.notFound, followsMenu(false));
    } else if (status === 403) {
      await ctx.editMessageText(followMessages.accessDenied, followsMenu(false));
    } else {
      await ctx.editMessageText(followMessages.loadError, followsMenu(false));
    }
  }
};

/**
 * Delete follow with confirmation
 */
export const handleDeleteFollow = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const followId = parseInt(ctx.match[1]);

    if (!ctx.session.token) {
      await ctx.editMessageText(generalMessages.authorizationRequired);
      return;
    }

    await followApi.deleteFollow(followId, ctx.session.token);
    logger.info(`User ${ctx.from.id} deleted follow ${followId}`);

    const follows = await followApi.getMyFollows(ctx.session.shopId, ctx.session.token);
    const hasFollows = Array.isArray(follows) && follows.length > 0;
    ctx.session.hasFollows = hasFollows;

    if (!hasFollows) {
      const text = `${followMessages.contextDetailed}\n\n${followMessages.emptyState}`;
      await ctx.editMessageText(text, followsMenu(false));
      return;
    }

    const followButtons = follows.map((follow) => [
      Markup.button.callback(buildFollowLabel(follow), `follow_detail:${follow.id}`)
    ]);

    const listText = follows
      .map((follow, index) => `${index + 1}. ${buildFollowLabel(follow).slice(2)}`)
      .join('\n');

    const message = `${followMessages.contextDetailed}\n\n${listText}`;

    await ctx.editMessageText(message, followsMenu(true, followButtons));
  } catch (error) {
    logger.error('Error deleting follow:', error);
    await ctx.editMessageText(followMessages.deleteError, followsMenu(false));
  }
};

/**
 * Switch follow mode (Monitor ↔ Resell)
 */
export const handleSwitchMode = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const followId = parseInt(ctx.match[1]);

    if (!ctx.session.token) {
      await ctx.editMessageText(generalMessages.authorizationRequired);
      return;
    }

    const follow = await followApi.getFollowDetail(followId, ctx.session.token);

    const newMode = follow.mode === 'monitor' ? 'resell' : 'monitor';

    // If switching to resell, need markup percentage
    if (newMode === 'resell') {
      // Store followId in session for later use
      ctx.session.editingFollowId = followId;
      ctx.session.pendingModeSwitch = 'resell';  // Flag that this is a mode switch

      const promptMsg = await ctx.editMessageText(followMessages.markupPrompt);
      ctx.session.editingMessageId = promptMsg.message_id;  // Save message ID for error handling
      return;
    }

    // Switch to monitor mode
    await followApi.switchMode(followId, newMode, ctx.session.token);

    const updated = await followApi.getFollowDetail(followId, ctx.session.token);
    const message = formatFollowDetail(updated);
    await ctx.editMessageText(message, followDetailMenu(followId, updated.mode));
    logger.info(`User ${ctx.from.id} switched follow ${followId} to ${newMode}`);
  } catch (error) {
    logger.error('Error switching mode:', error);
    
    const errorMsg = error.response?.data?.error;
    
    if (error.response?.status === 402) {
      await ctx.editMessageText(followMessages.limitReached, followsMenu(false));
    } else if (error.response?.status === 404) {
      await ctx.editMessageText(followMessages.notFound, followsMenu(false));
    } else if (errorMsg?.toLowerCase().includes('circular')) {
      await ctx.editMessageText(followMessages.modeLimit, followsMenu(false));
    } else {
      await ctx.editMessageText(followMessages.switchError, followsMenu(false));
    }
  }
};

/**
 * Handle edit markup button click
 */
export const handleEditMarkup = async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const followId = parseInt(ctx.match[1]);

    if (!ctx.session.token) {
      await ctx.editMessageText(generalMessages.authorizationRequired);
      return;
    }

    // Set session flag to capture next text message
    ctx.session.editingFollowId = followId;

    const promptMsg = await ctx.editMessageText(followMessages.markupPrompt);
    // Save message ID for later editMessageText
    ctx.session.editingMessageId = promptMsg.message_id;

    logger.info(`User ${ctx.from.id} initiated markup edit for follow ${followId}`);
  } catch (error) {
    logger.error('Error initiating markup edit:', error);
    await ctx.editMessageText(followMessages.switchError);
  }
};

/**
 * Handle markup update when editingFollowId is set
 */
export const handleMarkupUpdate = async (ctx) => {
  // Only handle if editingFollowId is set
  if (!ctx.session?.editingFollowId) {
    return; // Not our responsibility, pass through
  }

  try {
    const followId = ctx.session.editingFollowId;
    const editingMessageId = ctx.session.editingMessageId;

    // Track user message ID for cleanup
    const userMsgId = ctx.message.message_id;
    const markupText = ctx.message.text.trim().replace(',', '.');
    const markup = parseFloat(markupText);

    if (isNaN(markup) || markup < 1 || markup > 500) {
      // FIX: Use editMessageText instead of reply
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        editingMessageId,
        undefined,
        followMessages.markupInvalid
      );
      // Don't delete session - allow retry
      await ctx.deleteMessage(userMsgId).catch(() => {});
      return;
    }

    // Delete user message (clean chat pattern)
    await ctx.deleteMessage(userMsgId).catch((err) => {
      logger.debug(`Could not delete user message ${userMsgId}:`, err.message);
    });

    // Check if this is a mode switch or simple markup update
    if (ctx.session.pendingModeSwitch) {
      // Mode switch: use switchMode API (endpoint: /follows/:id/mode)
      await followApi.switchMode(followId, ctx.session.pendingModeSwitch, ctx.session.token, markup);
      delete ctx.session.pendingModeSwitch;
      // FIX: Use editMessageText instead of reply
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        editingMessageId,
        undefined,
        followMessages.modeChanged
      );
    } else {
      // Simple markup update: use updateMarkup API (endpoint: /follows/:id/markup)
      await followApi.updateMarkup(followId, markup, ctx.session.token);
      // FIX: Use editMessageText instead of reply
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        editingMessageId,
        undefined,
        followMessages.markupUpdated(Number(markup.toFixed(0)))
      );
    }

    delete ctx.session.editingFollowId;
    delete ctx.session.editingMessageId;
    
    logger.info(`User ${ctx.from.id} updated markup for follow ${followId} to ${markup}%`);
  } catch (error) {
    logger.error('Error updating markup:', error);

    const errorMsg = error.response?.data?.error;
    const editingMessageId = ctx.session.editingMessageId;

    let message = followMessages.switchError;
    if (error.response?.status === 402) {
      message = followMessages.limitReached;
    } else if (error.response?.status === 404) {
      message = followMessages.notFound;
    } else if (errorMsg?.toLowerCase().includes('markup')) {
      message = followMessages.markupInvalid;
    }

    // FIX: Use editMessageText instead of reply
    if (editingMessageId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        editingMessageId,
        undefined,
        message
      ).catch((err) => {
        logger.debug('Could not edit error message:', err.message);
      });
    }

    delete ctx.session.editingFollowId;
    delete ctx.session.editingMessageId;
  }
};

/**
 * Setup follow-related handlers
 */
export const setupFollowHandlers = (bot) => {
  // View follows list
  bot.action('follows:list', handleViewFollows);
  bot.action('seller:follows', handleViewFollows);

  // Create follow
  bot.action('follows:create', handleCreateFollow);

  // View follow detail (pattern: follow_detail:123)
  bot.action(/^follow_detail:(\d+)$/, handleFollowDetail);

  // View follow settings
  bot.action(/^follow_settings:(\d+)$/, handleFollowSettings);

  // Delete follow (pattern: follow_delete:123)
  bot.action(/^follow_delete:(\d+)$/, handleDeleteFollow);

  // Switch mode (pattern: follow_mode:123)
  bot.action(/^follow_mode:(\d+)$/, handleSwitchMode);

  // Edit markup (pattern: follow_edit:123)
  bot.action(/^follow_edit:(\d+)$/, handleEditMarkup);

  // Handle text for markup updates (EARLY handler - before AI)
  bot.on('text', async (ctx, next) => {
    // ONLY handle if editingFollowId is set, otherwise pass through
    if (ctx.session?.editingFollowId) {
      await handleMarkupUpdate(ctx);
      // Дополнительный safeguard для линтера: попытаться удалить текст
      await ctx.deleteMessage(ctx.message?.message_id).catch(() => {});
      return;
    }

    await next(); // Pass to other handlers (AI, etc.)
  });

  logger.info('Follow handlers registered');
};
