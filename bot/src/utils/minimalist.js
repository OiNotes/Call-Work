import { messages } from '../texts/messages.js';

/**
 * Minimalist Design Utilities
 *
 * Utility functions for implementing minimalist text patterns across the bot.
 * Based on research and patterns from BOT_MINIMALIST_DESIGN_GUIDE.md
 */

/**
 * Format products list for seller view
 * Compresses 8 lines → 3 lines (63% reduction)
 *
 * @param {Array} products - Array of product objects
 * @param {string} shopName - Shop name for header
 * @returns {string} Formatted message
 */
export const formatProductsList = (products, shopName) => {
  if (!products || products.length === 0) {
    return `Товары магазина ${shopName}. Пока товаров нет.`;
  }

  let msg = `Товары магазина ${shopName} (${products.length}).\n`;

  const toShow = products.slice(0, 5);
  toShow.forEach((p, i) => {
    const price = parseFloat(p.price).toFixed(0);

    msg += `${i + 1}. ${p.name} — $${price}\n`;
  });

  if (products.length > 5) {
    const remaining = products.length - 5;
    const unit = remaining === 1 ? 'товар' : remaining < 5 ? 'товара' : 'товаров';
    msg += `\n+${remaining} ${unit}`;
  }

  return msg;
};

/**
 * Format sales/orders list for seller view
 * Compresses 9 lines → 4 lines (56% reduction)
 *
 * @param {Array} orders - Array of order objects
 * @param {string} shopName - Shop name for header
 * @returns {string} Formatted message
 */
export const formatSalesList = (orders, shopName) => {
  if (!orders || orders.length === 0) {
    return `Заказы магазина ${shopName}. Пока нет продаж.`;
  }

  let msg = `Заказы магазина ${shopName} (${orders.length}).\n`;

  const toShow = orders.slice(0, 5);
  toShow.forEach((o, i) => {
    const username = o.buyer_username
      ? o.buyer_username.length > 15
        ? o.buyer_username.slice(0, 15)
        : o.buyer_username
      : o.buyer_first_name || 'Покупатель';
    const statusMap = {
      pending: 'Ожидает',
      completed: '✅',
      cancelled: 'Отменён',
      processing: 'Обработка',
      failed: 'Отменён',
    };
    const status = statusMap[o.status] || 'Обработка';
    const price = parseFloat(o.total_price || o.totalPrice || 0).toFixed(0);

    msg += `${i + 1}. ${status} @${username} — $${price}\n`;
  });

  if (orders.length > 5) {
    const remaining = orders.length - 5;
    const unit = remaining === 1 ? 'заказ' : remaining < 5 ? 'заказа' : 'заказов';
    msg += `\n+${remaining} ${unit}`;
  }

  return msg;
};

/**
 * Format buyer orders list
 * Compresses 9 lines → 4 lines
 *
 * @param {Array} orders - Array of order objects
 * @returns {string} Formatted message
 */
export const formatBuyerOrders = (orders) => {
  if (!orders || orders.length === 0) {
    return `Заказы\n\nНет заказов. Они появятся после первой покупки.`;
  }

  let msg = `Заказы (${orders.length})\n`;

  const toShow = orders.slice(0, 5);
  toShow.forEach((o, i) => {
    const shopName = o.shop_name || 'Магазин';
    const statusMap = {
      pending: 'Ожидает',
      completed: '✅',
      cancelled: 'Отменён',
      processing: 'Обработка',
      failed: 'Отменён',
    };
    const status = statusMap[o.status] || 'Обработка';
    const price = parseFloat(o.total_price || o.totalPrice || 0).toFixed(0);

    msg += `${i + 1}. ${status} ${shopName} — $${price}\n`;
  });

  if (orders.length > 5) {
    const remaining = orders.length - 5;
    const unit = remaining === 1 ? 'заказ' : remaining < 5 ? 'заказа' : 'заказов';
    msg += `\n+${remaining} ${unit}`;
  }

  return msg;
};

/**
 * Format subscriptions list
 *
 * @param {Array} subscriptions - Array of subscription objects
 * @returns {string} Formatted message
 */
export const formatSubscriptions = (subscriptions) => {
  if (!subscriptions || subscriptions.length === 0) {
    return `Подписки\n\nНет подписок. Найдите магазины в каталоге.`;
  }

  let msg = `Подписки (${subscriptions.length})\n`;

  subscriptions.slice(0, 10).forEach((sub, i) => {
    const shopName = sub.shop_name || sub.shopName || 'Магазин';
    msg += `${i + 1}. ${shopName}\n`;
  });

  if (subscriptions.length > 10) {
    const remaining = subscriptions.length - 10;
    const unit = remaining === 1 ? 'магазин' : remaining < 5 ? 'магазина' : 'магазинов';
    msg += `\n+${remaining} ${unit}`;
  }

  return msg;
};

/**
 * Format shop info for buyer view
 * Compresses 13 lines → 7 lines (46% reduction)
 *
 * @param {Object} shop - Shop object
 * @param {Array} products - Array of products
 * @returns {string} Formatted message
 */
export const formatShopInfo = (shop, products = []) => {
  const sellerUsername = shop.seller_username
    ? `@${shop.seller_username}`
    : shop.seller_first_name || 'Продавец';

  const { stock: stockProducts, preorder: preorderProducts } =
    splitProductsByAvailability(products);

  let msg = `${shop.name} • ${sellerUsername}\n`;

  if (shop.description && shop.description !== `Магазин ${shop.name}`) {
    msg += `\n${shop.description}\n`;
  }

  msg += `\n✅ Наличие — ${stockProducts.length}`;

  if (stockProducts.length === 0) {
    msg += `\n• пока пусто`;
  } else {
    stockProducts.slice(0, 3).forEach((product, index) => {
      const price = parseFloat(product.price).toFixed(0);
      msg += `\n${index + 1}. ${product.name} — $${price}`;
    });
    if (stockProducts.length > 3) {
      msg += `\n… еще ${stockProducts.length - 3}`;
    }
  }

  msg += `\n\nПредзаказ — ${preorderProducts.length}`;

  if (preorderProducts.length === 0) {
    msg += `\n• ожидаем поставку`;
  } else {
    preorderProducts.slice(0, 3).forEach((product, index) => {
      const price = parseFloat(product.price).toFixed(0);
      msg += `\n${index + 1}. ${product.name} — $${price}`;
    });
    if (preorderProducts.length > 3) {
      msg += `\n… еще ${preorderProducts.length - 3}`;
    }
  }

  return msg;
};

export const splitProductsByAvailability = (products = []) => {
  const stock = [];
  const preorder = [];

  products.forEach((product) => {
    const quantity = product?.stock_quantity ?? product?.stock ?? 0;
    const available = product?.is_available ?? product?.isActive ?? true;

    if (!available) {
      return;
    }

    if (quantity > 0) {
      stock.push(product);
    } else {
      preorder.push(product);
    }
  });

  return { stock, preorder };
};

export const formatProductSectionList = (section, shopName, products = []) => {
  const isPreorder = section === 'preorder';
  const title = isPreorder ? 'Предзаказ' : 'Наличие';
  const header = `${title} • ${shopName}`;

  if (!products.length) {
    return `${header}\n\n${isPreorder ? 'Пока нет товаров в предзаказе' : 'Все товары распроданы'}`;
  }

  const lines = products.slice(0, 8).map((product, index) => {
    const price = parseFloat(product.price).toFixed(0);
    const stockQty = product.stock_quantity ?? product.stock ?? 0;
    const stockLabel = isPreorder ? 'предзаказ' : stockQty > 0 ? 'В наличии' : 'Закончился';
    return `${index + 1}. ${product.name} — $${price} (${stockLabel})`;
  });

  const extra = products.length > 8 ? `\n… ещё ${products.length - 8}` : '';

  return `${header}\n\n${lines.join('\n')}${extra}`;
};

/**
 * Get smart stock status text
 *
 * @param {number} quantity - Stock quantity
 * @returns {string} Status text
 */
export const getStockStatus = (quantity) => {
  if (quantity === 0) return 'нет';
  if (quantity <= 3) return `${quantity} шт`;
  if (quantity <= 10) return `${quantity} шт`;
  return '10+ шт';
};

/**
 * Get order status emoji
 *
 * @param {string} status - Order status
 * @returns {string} Emoji
 */
export const getOrderStatusEmoji = (status) => {
  const map = {
    pending: '⏳',
    completed: '✅',
    cancelled: '❌',
    processing: '📦',
    failed: '❌',
  };
  return map[status] || '📦';
};

/**
 * Format success message
 *
 * @param {string} title - Success title
 * @param {string} details - Optional details
 * @returns {string} Formatted message
 */
export const successMessage = (title, details = '') => {
  let msg = `✅ ${title}`;
  if (details) {
    msg += `\n${details}`;
  }
  return msg;
};

/**
 * Format error message
 *
 * @param {string} action - Action that failed
 * @param {string} reason - Optional reason
 * @returns {string} Formatted message
 */
export const errorMessage = (action, reason = 'Попробуйте позже') => {
  return `❌ Не удалось ${action}\n${reason}`;
};

/**
 * Format wallet display (inline)
 * Compresses 9 lines → 3 lines (67% reduction)
 *
 * @param {Object} shop - Shop object with wallet fields
 * @returns {string} Formatted message
 */
export const formatWallets = (shop) => {
  const wallets = [];

  if (shop.wallet_btc) wallets.push('BTC');
  if (shop.wallet_eth) wallets.push('ETH');
  if (shop.wallet_usdt) wallets.push('USDT');
  if (shop.wallet_ltc) wallets.push('LTC');

  let msg = `Кошельки\n`;

  if (wallets.length === 0) {
    msg += `\nНет подключённых кошельков`;
  } else {
    msg += `\n${wallets.join(' • ')}`;
  }

  msg += `\n\nВыберите:`;

  return msg;
};

/**
 * Format follows list (minimalist - 3 lines max)
 *
 * @param {Array} follows - Array of follow objects
 * @param {string} shopName - Shop name for header
 * @returns {string} Formatted message
 */
export function formatFollowsList(follows) {
  if (!Array.isArray(follows) || follows.length === 0) {
    return messages.follows.listEmpty;
  }
  const header = messages.follows.listHeader(follows.length);
  const lines = follows.map((follow, index) => {
    const markupRaw = follow.markup_percentage ?? follow.markup ?? null;
    const markupValue = Number.isFinite(Number(markupRaw)) ? Number(markupRaw) : null;
    return messages.follows.listItem({
      index: index + 1,
      name: follow.source_shop_name || follow.sourceShopName || follow.name || 'Магазин',
      mode: follow.mode,
      markup: markupValue,
    });
  });
  return `${header}\n\n${lines.join('\n')}\n\n${messages.follows.listManageHint}`;
}

/**
 * Format follow detail (minimalist)
 *
 * @param {Object} follow - Follow object
 * @returns {string} Formatted message
 */
export function formatFollowDetail(follow) {
  const markupRaw = follow.markup_percentage ?? follow.markup ?? 0;
  const markupValue = Number.isFinite(Number(markupRaw)) ? Number(markupRaw) : null;
  const sourceProducts =
    follow.source_products_count ?? follow.products_count ?? follow.productsCount ?? 0;
  const syncedProducts =
    follow.synced_products_count ?? follow.synced_count ?? follow.syncedProducts ?? sourceProducts;

  return messages.follows.detail({
    name: follow.source_shop_name || follow.name || 'Магазин',
    mode: follow.mode,
    markup: markupValue,
    sourceProducts,
    syncedProducts,
  });
}
