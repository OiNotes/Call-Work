/**
 * Генератор детерминированных ответов для AI бота
 * 
 * Используется как fallback когда:
 * - AI недоступен (timeout, API error)
 * - Операция не удалась (success: false)
 * 
 * Гарантирует ЧЕСТНЫЙ ответ пользователю о результате операции
 */

/**
 * Форматирует USD цену
 */
function formatPrice(price) {
  return `$${Number(price).toFixed(2)}`;
}

/**
 * Форматирует скидку
 */
function formatDiscount(percentage, originalPrice, newPrice) {
  if (!originalPrice || !newPrice) {
    return `${percentage}%`;
  }
  return `${percentage}% (было ${formatPrice(originalPrice)} → ${formatPrice(newPrice)})`;
}

/**
 * Очистить error message от технических деталей
 */
function cleanErrorMessage(errorMsg) {
  if (!errorMsg) return '';

  // Удаляем технические префиксы
  let cleaned = errorMsg
    .replace(/^Error:\s*/i, '')
    .replace(/^ValidationError:\s*/i, '')
    .replace(/^Database error:\s*/i, '')
    .replace(/^\[.*?\]\s*/, '') // [ERROR] prefix
    .trim();

  // Ограничиваем длину
  if (cleaned.length > 150) {
    cleaned = cleaned.substring(0, 147) + '...';
  }

  return cleaned;
}

/**
 * Получить variation error message для разнообразия
 */
function getErrorVariation(baseMessage, variations) {
  if (!variations || variations.length === 0) return baseMessage;
  const randomIndex = Math.floor(Math.random() * variations.length);
  return variations[randomIndex];
}

/**
 * Генерирует естественный ответ на основе результата операции
 * 
 * @param {Object} result - Результат выполнения функции
 * @param {boolean} result.success - Успешность операции
 * @param {string} result.message - Сообщение об ошибке (если success: false)
 * @param {Object} result.data - Данные результата
 * @param {string} result.data.action - Тип действия
 * @returns {string} - Человекочитаемый ответ
 */
export function generateDeterministicResponse(result) {
  // ОШИБКА - честно сообщаем
  if (!result.success) {
    const rawError = result.message || result.data?.error?.message || 'Произошла неизвестная ошибка';
    const errorMessage = cleanErrorMessage(rawError);

    // Специальные случаи ошибок с variations
    if (errorMessage.includes('не найден') || errorMessage.includes('not found')) {
      return getErrorVariation('', [
        'Не нашёл такой товар. Проверь название или покажи список товаров.',
        'Такого товара нет в каталоге. Хочешь посмотреть весь список?',
        'Товар не найден. Может быть, другое название?'
      ]);
    }

    if (errorMessage.includes('уже существует') || errorMessage.includes('already exists')) {
      return getErrorVariation('', [
        'Товар с таким названием уже есть. Используй другое имя.',
        'Такой товар уже в каталоге. Придумай уникальное название.',
        'Это название уже занято. Попробуй другое.'
      ]);
    }

    if (errorMessage.includes('валидации') || errorMessage.includes('validation')) {
      return `Проверь данные: ${errorMessage}`;
    }

    if (errorMessage.includes('авторизации') || errorMessage.includes('authorization')) {
      return getErrorVariation('', [
        'Ошибка доступа. Попробуй перезапустить бота: /start',
        'Проблема с авторизацией. Перезапусти бота командой /start',
        'Сессия устарела. Нажми /start чтобы обновить.'
      ]);
    }

    if (errorMessage.includes('сервер') || errorMessage.includes('server')) {
      return `Сервер временно недоступен: ${errorMessage}. Попробуй через минуту.`;
    }

    // Общая ошибка
    return `Не получилось выполнить: ${errorMessage}`;
  }

  const data = result.data;
  
  // Нет данных - базовый успешный ответ
  if (!data || !data.action) {
    return '✅ Готово!';
  }

  // УСПЕШНЫЕ ОПЕРАЦИИ - генерируем информативный ответ
  
  switch (data.action) {
    // Создание одного товара
    case 'product_created': {
      const { product } = data;
      if (!product) return '✅ Товар добавлен.';
      
      const name = product.name || 'Товар';
      const price = product.price ? formatPrice(product.price) : '';
      const stock = product.stock_quantity !== undefined ? ` (остаток ${product.stock_quantity})` : '';
      
      return `✅ Добавил: ${name} за ${price}${stock}`;
    }

    // Массовое создание
    case 'products_bulk_created': {
      const count = data.products?.length || data.count || 0;
      if (count === 0) return '⚠️ Не удалось добавить товары.';
      if (count === 1) {
        const product = data.products[0];
        return `✅ Добавил: ${product.name} за ${formatPrice(product.price)}`;
      }
      return `✅ Добавлено товаров: ${count}`;
    }

    // Обновление одного товара
    case 'product_updated': {
      const { product } = data;
      if (!product) return '✅ Товар обновлён.';
      
      const name = product.name || 'Товар';
      const details = [];
      
      if (product.price !== undefined) {
        details.push(`цена ${formatPrice(product.price)}`);
      }
      if (product.stock_quantity !== undefined) {
        details.push(`остаток ${product.stock_quantity}`);
      }
      if (product.discount_percentage > 0) {
        details.push(`скидка ${product.discount_percentage}%`);
      }
      
      const detailsStr = details.length > 0 ? ` (${details.join(', ')})` : '';
      return `✅ Обновил: ${name}${detailsStr}`;
    }

    // Массовое обновление
    case 'products_bulk_updated': 
    case 'bulk_operation': {
      const count = data.products?.length || data.productsUpdated || data.count || 0;
      const productNames = data.products?.map(p => p.name).filter(Boolean);
      
      if (count === 0) return '⚠️ Не удалось обновить товары.';
      
      if (count === 1 && productNames && productNames[0]) {
        return `✅ Обновил: ${productNames[0]}`;
      }
      
      if (count <= 3 && productNames && productNames.length > 0) {
        return `✅ Обновлено: ${productNames.join(', ')}`;
      }
      
      return `✅ Обновлено товаров: ${count}`;
    }

    // Скидка применена
    case 'discount_applied': {
      const { product } = data;
      if (!product) return '✅ Скидка применена.';
      
      const name = product.name || 'Товар';
      const discountInfo = formatDiscount(
        product.discount_percentage,
        product.original_price,
        product.price
      );
      
      const duration = product.discount_expires_at 
        ? ` (действует до ${new Date(product.discount_expires_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short' })})`
        : '';
      
      return `✅ Скидка ${discountInfo} на ${name}${duration}`;
    }

    // Скидка удалена
    case 'discount_removed': {
      const { product } = data;
      if (!product) return '✅ Скидка убрана.';
      
      const name = product.name || 'Товар';
      const price = product.price ? ` Цена вернулась к ${formatPrice(product.price)}` : '';
      
      return `✅ Убрал скидку с ${name}.${price}`;
    }

    // Массовое изменение цен
    case 'prices_bulk_updated': {
      const { percentage, operation, productsUpdated, excludedProducts } = data;
      const count = productsUpdated || 0;
      
      if (count === 0) return '⚠️ Не удалось изменить цены.';
      
      const action = operation === 'increase' ? 'поднял' : 'снизил';
      const excludeNote = excludedProducts && excludedProducts.length > 0
        ? ` (кроме ${excludedProducts.join(', ')})`
        : '';
      
      return `✅ ${action.charAt(0).toUpperCase() + action.slice(1)} цены на ${Math.abs(percentage)}% для ${count} товаров${excludeNote}`;
    }

    // Удаление одного товара
    case 'product_deleted': {
      const name = data.product?.name || data.productName || 'Товар';
      return `🗑️ Удалил: ${name}`;
    }

    // Массовое удаление
    case 'products_bulk_deleted': {
      const count = data.deletedCount || data.count || 0;
      const deletedNames = data.deletedProducts?.map(p => p.name || p).filter(Boolean);
      
      if (count === 0) return '⚠️ Не удалось удалить товары.';
      
      if (count === 1 && deletedNames && deletedNames[0]) {
        return `🗑️ Удалил: ${deletedNames[0]}`;
      }
      
      if (count <= 3 && deletedNames && deletedNames.length > 0) {
        return `🗑️ Удалил: ${deletedNames.join(', ')}`;
      }
      
      return `🗑️ Удалено товаров: ${count}`;
    }

    // Удалить все
    case 'products_all_deleted': {
      const count = data.deletedCount || data.count || 0;
      if (count === 0) return '⚠️ Каталог уже был пуст.';
      return `🗑️ Удалил все товары (${count} шт). Каталог очищен.`;
    }

    // Фиксация продажи
    case 'sale_recorded': {
      const { product, quantity } = data;
      if (!product) return '✅ Продажа зафиксирована.';
      
      const name = product.name || 'Товар';
      const qty = quantity || 1;
      const remaining = product.stock_quantity !== undefined ? ` Остаток: ${product.stock_quantity}` : '';
      
      return `✅ Зафиксировал продажу: ${name} × ${qty}.${remaining}`;
    }

    // Список товаров
    case 'products_listed': {
      const count = data.products?.length || data.count || 0;
      if (count === 0) return '📦 Каталог пуст. Добавь первый товар!';
      return `📦 В каталоге ${count} товаров`;
    }

    // Поиск товара
    case 'product_found': {
      const { product } = data;
      if (!product) return '❌ Товар не найден.';
      
      const name = product.name;
      const price = formatPrice(product.price);
      const stock = product.stock_quantity || 0;
      const discount = product.discount_percentage > 0 ? ` (скидка ${product.discount_percentage}%)` : '';
      
      return `🔍 Нашёл: ${name} — ${price}, остаток ${stock}${discount}`;
    }

    // Информация о товаре
    case 'product_info': {
      const { product } = data;
      if (!product) return '❌ Информация недоступна.';
      
      const name = product.name;
      const price = formatPrice(product.price);
      const stock = product.stock_quantity || 0;
      
      let info = `📋 ${name}\nЦена: ${price}\nОстаток: ${stock}`;
      
      if (product.discount_percentage > 0) {
        info += `\nСкидка: ${product.discount_percentage}%`;
        if (product.original_price) {
          info += ` (было ${formatPrice(product.original_price)})`;
        }
      }
      
      return info;
    }

    // Требуется подтверждение
    case 'confirmation_required': {
      return data.message || '⚠️ Нужно подтверждение. Нажми кнопку ниже.';
    }

    // Требуется уточнение
    case 'clarification_required': {
      return data.message || '🤔 Уточни, пожалуйста, какой именно товар?';
    }

    // Неизвестный тип действия
    default:
      return '✅ Операция выполнена успешно.';
  }
}

/**
 * Варианты вступительных фраз (для разнообразия в будущем)
 */
const SUCCESS_PREFIXES = [
  '✅',
  '👍',
  '✔️',
  'Готово!',
  'Сделано!',
  'Ок!',
];

/**
 * Получить случайный префикс успеха
 */
export function getRandomSuccessPrefix() {
  return SUCCESS_PREFIXES[Math.floor(Math.random() * SUCCESS_PREFIXES.length)];
}
