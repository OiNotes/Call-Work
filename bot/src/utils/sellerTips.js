/**
 * Seller Tips System - умные советы и предупреждения для продавцов
 */

// База советов (5 штук)
const TIPS = {
  follow: {
    id: 'tip_follow',
    text: '👀 Следите за другими магазинами\nМониторьте наличие их товаров.'
  },
  resell: {
    id: 'tip_resell', 
    text: '💰 Перепродавайте с наценкой\nКопируйте товары других магазинов с автонаценкой.'
  },
  ai: {
    id: 'tip_ai',
    text: '🤖 AI добавит товары за вас\nОпишите товар - AI создаст карточку автоматически.'
  },
  stats: {
    id: 'tip_stats',
    text: '📊 Смотрите что продается\nАнализируйте статистику для роста продаж.'
  },
  workers: {
    id: 'tip_workers',
    text: '👥 Добавьте помощников\nДайте доступ сотрудникам для управления.'
  }
};

// Предупреждения (приоритет 1)
const WARNINGS = {
  no_wallets: {
    id: 'warning_no_wallets',
    text: '⚠️ У вас не настроены кошельки\nПокупатели не смогут оплатить товары.'
  },
  no_products: {
    id: 'warning_no_products',
    text: '📦 В магазине пока нет товаров\nДобавьте товары чтобы начать продажи.'
  }
};

/**
 * Получить следующий совет (избегая последнего показанного)
 */
function getNextTip(lastTipId) {
  const tipsArray = Object.values(TIPS);
  
  // Если советов мало или lastTipId не задан, выбираем случайный
  if (tipsArray.length <= 1 || !lastTipId) {
    return tipsArray[Math.floor(Math.random() * tipsArray.length)];
  }
  
  // Фильтруем последний показанный совет
  const availableTips = tipsArray.filter(tip => tip.id !== lastTipId);
  
  // Выбираем случайный из оставшихся
  return availableTips[Math.floor(Math.random() * availableTips.length)];
}

/**
 * Получить совет/предупреждение для магазина на основе его состояния
 * @param {Object} ctx - Telegraf context
 * @param {Object} shopHealth - Состояние магазина { hasWallets, productsCount, tier }
 * @returns {string|null} - Текст для показа или null
 */
function getTipForShop(ctx, shopHealth) {
  // Приоритет 1: Критичные предупреждения
  
  // Проверка кошельков
  if (!shopHealth.hasWallets) {
    return WARNINGS.no_wallets.text;
  }
  
  // Проверка товаров
  if (shopHealth.productsCount === 0) {
    return WARNINGS.no_products.text;
  }
  
  // Приоритет 2: Полезные советы (ротация)
  const lastTipId = ctx.session.lastTipShown || null;
  const nextTip = getNextTip(lastTipId);
  
  // Сохраняем ID показанного совета в session
  ctx.session.lastTipShown = nextTip.id;
  ctx.session.lastTipTimestamp = Date.now();
  
  return nextTip.text;
}

export {
  getTipForShop,
  getNextTip,
  TIPS,
  WARNINGS
};
