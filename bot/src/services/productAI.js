import deepseek from './deepseek.js';
import { productTools } from '../tools/productTools.js';
import { generateProductAIPrompt, sanitizeUserInput } from '../utils/systemPrompts.js';
import { productApi } from '../utils/api.js';
import { fuzzySearchProducts } from '../utils/fuzzyMatch.js';
import { autoTransliterateProductName, getTransliterationInfo } from '../utils/transliterate.js';
import logger from '../utils/logger.js';
import { reply as cleanReply } from '../utils/cleanReply.js';

/**
 * AI Product Management Service
 * Orchestrates AI calls and executes product operations
 */
// Conversation history constants
const MAX_HISTORY_MESSAGES = 40; // Keep last 40 messages (~10 tool exchanges or 20 text exchanges)
const CONVERSATION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

export function noteProductContext(ctx, product, meta = {}) {
  if (!ctx?.session || !product) {
    return;
  }

  const snapshot = {
    id: product.id ?? null,
    name: product.name ?? null,
    price: product.price ?? null,
    updatedAt: Date.now()
  };

  const prev = ctx.session.aiContext || {};
  const recent = [snapshot, ...(prev.recentProducts || [])]
    .filter(item => item.name)
    .filter((item, index, array) => array.findIndex(other => other.name === item.name) === index)
    .slice(0, 5);

  ctx.session.aiContext = {
    ...prev,
    lastProductId: snapshot.id ?? prev.lastProductId ?? null,
    lastProductName: snapshot.name ?? prev.lastProductName ?? null,
    lastAction: meta.action || prev.lastAction || null,
    lastCommand: meta.command || prev.lastCommand || null,
    recentProducts: recent,
    updatedAt: Date.now()
  };

  if (meta.relatedProducts) {
    ctx.session.aiContext.relatedProducts = meta.relatedProducts;
  }
}

function updateContextFromResult(ctx, result, command) {
  if (!ctx?.session || !result?.data) {
    return;
  }

  const { data, operation } = result;
  const action = data.action || operation || null;

  if (data.product) {
    noteProductContext(ctx, data.product, { action, command });
    return;
  }

  if (Array.isArray(data.products) && data.products.length === 1) {
    noteProductContext(ctx, data.products[0], { action, command });
    return;
  }

  if (Array.isArray(data.products) && data.products.length > 1) {
    const snapshot = data.products[0];
    noteProductContext(ctx, snapshot, {
      action,
      command,
      relatedProducts: data.products.map(item => ({
        id: item.id ?? null,
        name: item.name ?? null,
        price: item.price ?? null
      }))
    });
  }
}

function formatUsd(price) {
  const num = Number(price);
  if (!Number.isFinite(num)) {
    return '$0';
  }
  const formatted = num % 1 === 0
    ? num.toFixed(0)
    : num.toFixed(2).replace(/\.?0+$/, '');
  return `$${formatted}`;
}

function formatProductLine(product, index = null) {
  const priceText = formatUsd(product.price ?? 0);
  const stock = product.stock_quantity ?? product.stock ?? 0;
  const stockText = stock > 0 ? ` — ${stock} шт` : ' — нет в наличии';
  const discount = product.discount_percentage ?? product.discountPercentage ?? null;
  const discountText = discount && Number(discount) > 0
    ? ` (скидка ${Number(discount)}%)`
    : '';
  const prefix = index !== null ? `${index + 1}. ` : '';
  return `${prefix}${product.name} — ${priceText}${discountText}${stockText}`;
}

function buildMessageFromResult(result) {
  if (!result) {
    return null;
  }

  if (result.message) {
    return result.message;
  }

  const data = result.data;
  if (!data) {
    return result.success ? 'Готово.' : null;
  }

  if (data.error?.message) {
    return `Не получилось: ${data.error.message}`;
  }

  switch (data.action) {
    case 'product_created': {
      const product = data.product;
      if (!product) {
        return 'Готово.';
      }
      const stock = product.stock_quantity ?? product.stock ?? 0;
      const stockText = stock > 0 ? `, ${stock} шт` : ', нет в наличии';
      return `Готово, ${product.name}: ${formatUsd(product.price)}${stockText}.`;
    }
    case 'bulk_products_added': {
      const successCount = data.successCount ?? 0;
      const failCount = data.failCount ?? 0;
      const sections = [];
      if (successCount > 0 && Array.isArray(data.successful)) {
        const preview = data.successful.slice(0, 5).map((p, idx) => formatProductLine(p, idx));
        sections.push(`Добавил ${successCount} ${successCount === 1 ? 'товар' : 'товара'}:\n${preview.join('\n')}`);
        if (data.successful.length > 5) {
          sections.push(`... и ещё ${data.successful.length - 5}`);
        }
      }
      if (failCount > 0 && Array.isArray(data.failed) && data.failed.length) {
        const failedNames = data.failed.map(item => item.name).filter(Boolean);
        if (failedNames.length) {
          sections.push(`Не удалось добавить: ${failedNames.join(', ')}`);
        }
      }
      return sections.join('\n') || 'Готово.';
    }
    case 'product_deleted': {
      const product = data.product;
      return product ? `Удалил ${product.name}.` : 'Удалил товар.';
    }
    case 'products_listed': {
      const items = data.products || [];
      if (items.length === 0) {
        return 'Каталог пуст — добавь первый товар?';
      }
      const preview = items.slice(0, 10).map((p, idx) => formatProductLine(p, idx));
      const extra = items.length > 10 ? `\n... и ещё ${items.length - 10} товаров` : '';
      return `Сейчас в каталоге ${items.length} товаров:\n${preview.join('\n')}${extra}`;
    }
    case 'products_found': {
      const items = data.products || [];
      if (items.length === 0) {
        return `Не нашёл товаров по запросу «${data.searchQuery}».`;
      }
      const preview = items.slice(0, 10).map((p, idx) => formatProductLine(p, idx));
      const extra = items.length > 10 ? `\n... и ещё ${items.length - 10}` : '';
      return `Нашёл ${items.length} товаров по запросу «${data.searchQuery}»:\n${preview.join('\n')}${extra}`;
    }
    case 'product_updated': {
      const changes = data.changes || {};
      const changeParts = [];
      if (changes.name) {
        changeParts.push(`имя: ${changes.name.old} → ${changes.name.new}`);
      }
      if (changes.price) {
        changeParts.push(`цена: ${formatUsd(changes.price.old)} → ${formatUsd(changes.price.new)}`);
      }
      if (changes.stock_quantity) {
        changeParts.push(`остаток: ${changes.stock_quantity.old ?? 0} → ${changes.stock_quantity.new}`);
      }
      if (changes.discount_percentage) {
        changeParts.push(`скидка: ${changes.discount_percentage.old ?? 0}% → ${changes.discount_percentage.new ?? 0}%`);
      }
      if (changes.discount_expires_at) {
        changeParts.push('обновил таймер скидки');
      }
      const productName = data.product?.name || 'товар';
      return changeParts.length > 0
        ? `${productName} обновлён: ${changeParts.join(', ')}.`
        : `Обновил ${productName}.`;
    }
    case 'bulk_delete_all': {
      const count = data.deletedCount ?? 0;
      return count > 0
        ? `Удалил все товары (${count} шт).`
        : 'Каталог уже был пустым.';
    }
    case 'bulk_delete_by_names': {
      const count = data.deletedCount ?? 0;
      const segments = [];
      if (count > 0 && data.deletedProducts?.length) {
        segments.push(`Удалил ${count}: ${data.deletedProducts.join(', ')}`);
      }
      if (data.notFound?.length) {
        segments.push(`Не нашёл: ${data.notFound.join(', ')}`);
      }
      return segments.join('\n') || 'Не удалось удалить товары.';
    }
    case 'sale_recorded': {
      const product = data.product;
      const sale = data.sale;
      if (!product || !sale) {
        return 'Продажу зафиксировал.';
      }
      return `Зафиксировал продажу: ${product.name}, ${sale.quantity} шт. Остаток ${sale.newStock}.`;
    }
    case 'product_info_retrieved': {
      const product = data.product;
      if (!product) {
        return 'Не нашёл информацию о товаре.';
      }
      const stock = product.stock_quantity ?? 0;
      const stockText = stock > 0 ? `${stock} шт` : 'нет в наличии';
      return `${product.name}: ${formatUsd(product.price)} (${stockText}).`;
    }
    case 'bulk_update_prices': {
      const updated = data.updatedCount ?? 0;
      const suffix = data.discountType === 'timer' && data.durationText
        ? ` на ${data.durationText}`
        : '';
      const excluded = data.excludedProductIds?.length
        ? ` (исключено ${data.excludedProductIds.length})`
        : '';
      return `${data.operationText} ${data.operationSymbol}${data.percentage}%${suffix} для ${updated} товаров${excluded}.`;
    }
    default:
      return result.success ? 'Готово.' : null;
  }
}

/**
 * Parse duration string to milliseconds
 * Supports: "6 часов", "3 дня", "12h", "24 hours", "1 week", etc.
 * @param {string} text - Duration string
 * @returns {number|null} Duration in milliseconds or null if invalid
 */
function parseDurationToMs(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const normalized = text.toLowerCase().trim();

  // Patterns: "6 часов", "3 дня", "12h", "24 hours", etc.
  const patterns = [
    // Russian hours
    { regex: /(\d+)\s*(?:часов|часа|час)/i, multiplier: 60 * 60 * 1000 },
    // Russian days
    { regex: /(\d+)\s*(?:дней|дня|день)/i, multiplier: 24 * 60 * 60 * 1000 },
    // Russian weeks
    { regex: /(\d+)\s*(?:недель|недели|неделя)/i, multiplier: 7 * 24 * 60 * 60 * 1000 },
    // English hours
    { regex: /(\d+)\s*(?:hours?|hrs?|h)/i, multiplier: 60 * 60 * 1000 },
    // English days
    { regex: /(\d+)\s*(?:days?|d)/i, multiplier: 24 * 60 * 60 * 1000 },
    // English weeks
    { regex: /(\d+)\s*(?:weeks?|w)/i, multiplier: 7 * 24 * 60 * 60 * 1000 }
  ];

  for (const pattern of patterns) {
    const match = pattern.regex.exec(normalized);
    if (match) {
      const value = parseInt(match[1], 10);
      if (Number.isFinite(value) && value > 0) {
        return value * pattern.multiplier;
      }
    }
  }

  return null;
}

/**
 * Format duration from milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Human-readable duration (e.g., "6 часов", "3 дня")
 */
function formatDuration(ms) {
  if (!ms || !Number.isFinite(ms)) {
    return 'постоянная';
  }

  const hours = ms / (60 * 60 * 1000);
  const days = ms / (24 * 60 * 60 * 1000);

  if (days >= 1 && days % 1 === 0) {
    // Days
    if (days === 1) return '1 день';
    if (days >= 2 && days <= 4) return `${days} дня`;
    return `${days} дней`;
  }

  if (hours >= 1 && hours % 1 === 0) {
    // Hours
    if (hours === 1) return '1 час';
    if (hours >= 2 && hours <= 4) return `${hours} часа`;
    return `${hours} часов`;
  }

  // Fallback
  return `${Math.round(hours)} часов`;
}

// Natural language shortcuts for stock updates
const STOCK_KEYWORDS = ['сток', 'наличие', 'остаток', 'stock', 'quantity', 'qty', 'qnty'];
const STOCK_ACTION_KEYWORDS = ['обнови', 'обновить', 'выстави', 'выставить', 'поставь', 'поставить', 'установи', 'установить', 'измени', 'изменить', 'set', 'update', 'change'];
const STOCK_INVALID_TARGET_KEYWORDS = ['все', 'каждый', 'каждая', 'каждому', 'каждой', 'каждые', 'каждый товар', 'каждому товару', 'всем', 'all', 'every'];
const STOCK_UPDATE_PATTERNS = [
  /(?:обнови(?:ть)?|выстави(?:ть)?|поставь|поставить|установи|установить|измени|изменить|set|update|change)\s+(?:сток|наличие|остаток|stock|quantity|qty|qnty)\s+(?<product>.+?)\s*(?:до|на|=)\s*(?<quantity>\d+)/i,
  /(?:обнови(?:ть)?|выстави(?:ть)?|поставь|поставить|установи|установить|измени|изменить|set|update|change)\s+(?<product>.+?)\s*(?:сток|наличие|остаток|stock|quantity|qty|qnty)\s*(?:до|на|=)\s*(?<quantity>\d+)/i,
  /(?:сток|наличие|остаток|stock|quantity|qty|qnty)\s+(?<product>.+?)\s*(?:до|на|=)\s*(?<quantity>\d+)/i,
  /(?<product>.+?)\s*(?:сток|наличие|остаток|stock|quantity|qty|qnty)\s*(?:до|на|=)\s*(?<quantity>\d+)/i,
  /(?<quantity>\d+)\s*(?:шт|штук|pcs|pieces|ед|единиц)?\s*(?:для|по|на)\s+(?<product>.+)/i,
  /(?:наличие|сток|остаток|stock|quantity|qty|qnty)\s+(?<quantity>\d+)\s*(?:шт|штук|pcs|pieces|ед|единиц)?\s*(?:для|у|по)?\s*(?<product>.+)/i
];

/**
 * Get conversation history from session
 * @param {Object} ctx - Telegraf context
 * @returns {Array} Conversation history messages
 */
function getConversationHistory(ctx) {
  if (!ctx || !ctx.session || !ctx.session.aiConversation) {
    return [];
  }

  const conversation = ctx.session.aiConversation;

  // Check if conversation expired (30 min timeout)
  if (conversation.lastActivity && Date.now() - conversation.lastActivity > CONVERSATION_TIMEOUT) {
    logger.info('conversation_expired', { userId: ctx.from?.id });
    delete ctx.session.aiConversation;
    delete ctx.session.aiContext;
    return [];
  }

  return conversation.messages || [];
}

/**
 * Save messages to conversation history with automatic sliding window management
 * 
 * Supports all OpenAI message formats:
 * - User messages: { role: 'user', content: string }
 * - Assistant text: { role: 'assistant', content: string }
 * - Assistant with function calls: { role: 'assistant', content: null, tool_calls: [...] }
 * - Tool results: { role: 'tool', tool_call_id: string, name: string, content: string }
 * 
 * Features:
 * - Sliding window: automatically keeps only last MAX_HISTORY_MESSAGES
 * - Metadata tracking: updates lastActivity and messageCount
 * - Flexible input: accepts single message object or array of messages
 * 
 * @param {Object} ctx - Telegraf context with session
 * @param {Object|Array<Object>} newMessages - Message(s) to add to history
 * @param {string} newMessages[].role - Message role: 'user' | 'assistant' | 'tool'
 * @param {string} [newMessages[].content] - Message content (optional for assistant with tool_calls)
 * @param {Array} [newMessages[].tool_calls] - Tool calls array (if assistant calling functions)
 * @param {string} [newMessages[].tool_call_id] - Tool call ID (if role is 'tool')
 * @param {string} [newMessages[].name] - Function name (if role is 'tool')
 * 
 * @example
 * // Save simple text exchange
 * saveToConversationHistory(ctx, [
 *   { role: 'user', content: 'Hello' },
 *   { role: 'assistant', content: 'Hi there!' }
 * ]);
 * 
 * @example
 * // Save function call exchange
 * saveToConversationHistory(ctx, [
 *   { role: 'user', content: 'Add iPhone' },
 *   { role: 'assistant', content: null, tool_calls: [...] },
 *   { role: 'tool', tool_call_id: 'call_123', name: 'addProduct', content: '{"success":true}' },
 *   { role: 'assistant', content: 'iPhone added!' }
 * ]);
 */
function saveToConversationHistory(ctx, newMessages) {
  if (!ctx || !ctx.session) {
    return;
  }

  // Initialize conversation if not exists
  if (!ctx.session.aiConversation) {
    ctx.session.aiConversation = {
      messages: [],
      lastActivity: Date.now(),
      messageCount: 0
    };
  }

  const conversation = ctx.session.aiConversation;

  // Add new messages (support array or single message)
  const messagesToAdd = Array.isArray(newMessages) ? newMessages : [newMessages];
  conversation.messages.push(...messagesToAdd);

  // Implement sliding window - keep only last N messages
  if (conversation.messages.length > MAX_HISTORY_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_HISTORY_MESSAGES);
  }

  // Update metadata
  conversation.lastActivity = Date.now();
  conversation.messageCount = (conversation.messageCount || 0) + messagesToAdd.length;

  logger.debug('conversation_history_saved', {
    userId: ctx.from?.id,
    messageCount: conversation.messageCount,
    historyLength: conversation.messages.length,
    newMessagesCount: messagesToAdd.length
  });
}

function cleanProductCandidate(raw) {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  return raw
    .replace(/["'«»]/g, '')
    .replace(/\b(для|по|на|шт|штук|pcs|pieces|ед|единиц|товара|товар|количество|quantity|qty|qnty|stock|наличие|остаток)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectStockUpdateIntent(command) {
  if (!command) {
    return null;
  }

  const normalized = command.toLowerCase();
  const hasStockKeyword = STOCK_KEYWORDS.some(keyword => normalized.includes(keyword));
  const hasActionKeyword = STOCK_ACTION_KEYWORDS.some(keyword => normalized.includes(keyword));

  if (!hasStockKeyword && !hasActionKeyword) {
    return null;
  }

  for (const pattern of STOCK_UPDATE_PATTERNS) {
    const match = pattern.exec(command);
    if (!match) {
      continue;
    }

    const rawQuantity = match.groups?.quantity;
    const rawProduct = match.groups?.product || '';

    const quantity = parseInt(rawQuantity, 10);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000) {
      continue;
    }

    const productCandidate = cleanProductCandidate(rawProduct);
    if (!productCandidate) {
      continue;
    }

    const candidateLower = productCandidate.toLowerCase();

    if (STOCK_INVALID_TARGET_KEYWORDS.some(keyword => candidateLower.includes(keyword))) {
      continue;
    }

    if (candidateLower.includes(' и ') || candidateLower.includes(' and ') || productCandidate.includes(',')) {
      continue; // Multiple products mentioned - defer to AI
    }

    if (!/[a-zа-яё]/i.test(productCandidate)) {
      continue;
    }

    const candidateTokens = candidateLower.split(/\s+/).filter(Boolean);
    const hasMeaningfulToken = candidateTokens.some(token =>
      !STOCK_KEYWORDS.includes(token) && !STOCK_ACTION_KEYWORDS.includes(token)
    );

    if (!hasMeaningfulToken) {
      continue;
    }

    return {
      productName: productCandidate,
      quantity
    };
  }

  return null;
}

function detectSingleProductDiscountIntent(command, products, ctx) {
  if (!command) {
    return null;
  }

  const normalized = command.toLowerCase();
  if (!/(скид|discount|%)/.test(normalized)) {
    return null;
  }

  const percentMatch = command.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (!percentMatch) {
    return null;
  }

  const percentage = parseFloat(percentMatch[1].replace(',', '.'));
  if (!Number.isFinite(percentage)) {
    return null;
  }

  if (percentage <= 0) {
    return {
      error: {
        message: 'Скидка должна быть больше 0%. Укажи корректное значение.'
      }
    };
  }

  if (percentage > 100) {
    return {
      error: {
        message: 'Скидка не может быть больше 100%. Сколько поставить?',
        value: percentage
      }
    };
  }

  const mentionsAll = /(всем|на все|весь|по всем|по каталогу|all|every|each|каталог)/.test(normalized);
  if (mentionsAll) {
    return null;
  }

  const chooseFromContext = () => {
    const lastName = ctx?.session?.aiContext?.lastProductName;
    if (!lastName) {
      return null;
    }
    const matches = fuzzySearchProducts(lastName, products, 0.4);
    if (matches.length === 1) {
      return matches[0].product;
    }
    return null;
  };

  const chooseByExplicitMention = () => {
    const cleanedCommand = normalized.replace(/[^a-zа-я0-9\s]/gi, ' ');
    for (const product of products) {
      if (!product.name) {
        continue;
      }
      const productName = product.name.toLowerCase();
      if (cleanedCommand.includes(productName)) {
        return product;
      }
    }
    return null;
  };

  let product = chooseFromContext() || chooseByExplicitMention();
  if (!product && products.length === 1) {
    product = products[0];
  }

  if (!product) {
    return null;
  }

  const durationMatch = command.match(/\d+\s*(?:час(?:ов|а)?|минут(?:ы|у)?|дн(?:ей|я|ь)?|недел(?:я|и|ь)?|hours?|hrs?|h|days?|d|weeks?|w)/i);
  const duration = durationMatch ? durationMatch[0] : null;

  return {
    product,
    percentage,
    duration
  };
}

/**
 * Process AI command for product management
 * 
 * @param {string} userCommand - User's natural language command
 * @param {Object} context - Context object with shopId, shopName, token, products
 * @returns {Object} Result object with success, message, data, needsClarification
 */
export async function processProductCommand(userCommand, context) {
  const { shopId, shopName, token, products = [], ctx, clarifiedProductId, clarifiedProductName } = context;
  const startTime = Date.now();

  // Validate context
  if (!shopId || !shopName || !token) {
    return {
      success: false,
      message: '❌ Ошибка: отсутствует информация о магазине'
    };
  }

  // Check if DeepSeek is available
  if (!deepseek.isAvailable()) {
    return {
      success: false,
      message: '❌ AI недоступен. Используйте обычное меню.',
      fallbackToMenu: true
    };
  }

  // Sanitize user input
  const sanitizedCommand = sanitizeUserInput(userCommand);
  if (!sanitizedCommand) {
    return {
      success: false,
      message: '❌ Пустая команда'
    };
  }

  try {
    // Attempt fast-path stock update detection before calling AI
    const quickDiscount = detectSingleProductDiscountIntent(sanitizedCommand, products, ctx);
    if (quickDiscount) {
      if (quickDiscount.error) {
        return {
          success: false,
          message: quickDiscount.error.message
        };
      }

      const updates = {
        discount_percentage: quickDiscount.percentage
      };

      if (quickDiscount.duration) {
        updates.discount_expires_at = quickDiscount.duration;
      }

      const result = await handleUpdateProduct(
        {
          productName: quickDiscount.product.name,
          updates
        },
        shopId,
        token,
        products
      );

      if (ctx && result.success) {
        updateContextFromResult(ctx, result, sanitizedCommand);
      }

      if (result.success) {
        const suffix = quickDiscount.duration ? ` на ${quickDiscount.duration}` : '';
        const message = `Сделал скидку ${quickDiscount.percentage}% на ${quickDiscount.product.name}${suffix}.`;
        return {
          ...result,
          message,
          operation: 'quick_discount_update'
        };
      }

      return result;
    }

    const quickStockUpdate = detectStockUpdateIntent(sanitizedCommand);
    if (quickStockUpdate) {
      logger.info('stock_update_intent_detected', {
        shopId,
        productName: quickStockUpdate.productName,
        quantity: quickStockUpdate.quantity
      });

      const result = await handleUpdateProduct(
        {
          productName: quickStockUpdate.productName,
          updates: { stock_quantity: quickStockUpdate.quantity }
        },
        shopId,
        token,
        products
      );

      // Legacy format - save only text messages for backward compatibility
      if (ctx && result.message) {
        saveToConversationHistory(ctx, [
          { role: 'user', content: sanitizedCommand },
          { role: 'assistant', content: result.message }
        ]);
      }

      if (ctx && result.success) {
        updateContextFromResult(ctx, result, sanitizedCommand);
      }

      if (result.success && result.data?.product) {
        const updated = result.data.product;
        const message = `Готово, ${updated.name}: остаток ${quickStockUpdate.quantity}.`;
        return {
          ...result,
          message,
          operation: 'quick_stock_update'
        };
      }

      return result;
    }

    // Generate system prompt
    const systemPrompt = generateProductAIPrompt(shopName, products, {
      sessionContext: ctx?.session?.aiContext
    });

    // Get conversation history for context
    const conversationHistory = getConversationHistory(ctx);

    logger.debug('ai_processing_with_history', {
      shopId,
      historyLength: conversationHistory.length,
      command: sanitizedCommand.slice(0, 50)
    });

    // Typing indicator - keep showing "typing..." during AI processing
    let typingInterval = null;
    if (ctx) {
      await ctx.sendChatAction('typing').catch(() => {});
      typingInterval = setInterval(() => {
        ctx.sendChatAction('typing').catch(() => {});
      }, 4000); // Every 4 seconds
    }

    // Streaming state for Telegram message updates
    let streamingMessage = null;
    let lastUpdateTime = 0;
    let wordCount = 0;
    const UPDATE_THROTTLE_MS = 500; // Update max once per 500ms
    const WORDS_PER_UPDATE = 15; // Or every 15 words

    // NO initial message - first chunk will create it

    // onChunk callback for streaming updates
    const onChunk = async (chunk, fullText) => {
      if (!ctx) return;

      // Count words
      wordCount++;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime;

      // Throttle updates: update every 15 words OR every 500ms
      if (wordCount >= WORDS_PER_UPDATE || timeSinceLastUpdate >= UPDATE_THROTTLE_MS) {
        try {
          if (!streamingMessage) {
            // First chunk - create new message
            streamingMessage = await cleanReply(ctx, fullText);
          } else {
            // Subsequent chunks - update existing message
            await ctx.telegram.editMessageText(
              streamingMessage.chat.id,
              streamingMessage.message_id,
              undefined,
              fullText
            );
          }
          lastUpdateTime = now;
          wordCount = 0;
        } catch (err) {
          // Ignore edit errors (message not modified, too many requests, etc.)
          if (err.response?.error_code !== 400) {
            logger.warn('Streaming edit error:', err.message);
          }
        }
      }
    };

    // Call DeepSeek API with streaming
    let response;
    try {
      response = await deepseek.chatStreaming(
        systemPrompt,
        sanitizedCommand,
        productTools,
        conversationHistory,
        onChunk
      );
    } finally {
      // Stop typing indicator
      if (typingInterval) {
        clearInterval(typingInterval);
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info('ai_product_command_processed', {
      shopId,
      userId: ctx?.from?.id,
      command: sanitizedCommand.substring(0, 100),
      streaming: true,
      processingTimeMs: processingTime,
      hadHistory: conversationHistory.length > 0
    });

    const choice = response.choices[0];

    // Check if AI wants to use a tool
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      const toolCall = choice.message.tool_calls[0]; // Take first tool call
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      const toolCallStartTime = Date.now();
      logger.info('ai_tool_call', {
        shopId,
        userId: ctx?.from?.id,
        function: functionName,
        arguments: JSON.stringify(args),
        clarified: !!clarifiedProductId
      });

      // Delete streaming message since function result will be in a new message
      // Add small delay to let any pending edits complete
      if (streamingMessage && ctx) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100)); // Wait for pending edits
          await ctx.telegram.deleteMessage(streamingMessage.chat.id, streamingMessage.message_id);
        } catch (err) {
          // Ignore errors - message might already be gone or not found
          if (err.response?.error_code !== 400) {
            logger.warn('Failed to delete streaming message:', err.message);
          }
        }
      }

      // Execute the appropriate function
      const result = await executeToolCall(functionName, args, { 
        shopId, 
        token, 
        products, 
        ctx,
        clarifiedProductId,  // Pass clarified product ID to tool functions
        clarifiedProductName  // Pass clarified product name for logging
      });
      
      const toolCallTime = Date.now() - toolCallStartTime;
      logger.info('ai_tool_call_completed', {
        shopId,
        userId: ctx?.from?.id,
        function: functionName,
        success: result.success,
        executionTimeMs: toolCallTime
      });

      if (ctx && result.success) {
        updateContextFromResult(ctx, result, sanitizedCommand);
      }

      if (result.message && !result.data) {
        if (ctx && result.message) {
          saveToConversationHistory(ctx, [
            { role: 'user', content: sanitizedCommand },
            { role: 'assistant', content: result.message }
          ]);
        }
        return result;
      }

      const totalTime = Date.now() - startTime;
      const finalMessage = buildMessageFromResult(result) || 'Готово.';

      // НЕ отправляем здесь - handler сам отправит сообщение (aiProducts.js:176)
      // Только сохраняем в историю для AI контекста
      if (ctx && finalMessage) {
        saveToConversationHistory(ctx, [
          { role: 'user', content: sanitizedCommand },
          { role: 'assistant', content: finalMessage }
        ]);
      }

      logger.info('ai_command_with_tool_completed', {
        shopId,
        userId: ctx?.from?.id,
        function: functionName,
        totalTimeMs: totalTime,
        success: result.success
      });

      return {
        ...result,
        message: finalMessage,
        operation: result.operation || result.data?.action || functionName
      };
    }

    // No tool call - AI responded with text
    const aiMessage = choice.message.content;

    // ALWAYS do final update to ensure complete message is sent
    if (streamingMessage && ctx && aiMessage) {
      try {
        // Final update with complete text
        await ctx.telegram.editMessageText(
          streamingMessage.chat.id,
          streamingMessage.message_id,
          undefined,
          aiMessage
        );
      } catch (err) {
        // Ignore "message not modified" errors
        if (err.response?.description !== 'Bad Request: message is not modified') {
          logger.warn('Failed to send final AI message:', err.message);
        }
      }
    } else if (!streamingMessage && ctx && aiMessage) {
      // If streaming was too fast and no message was created, send regular message
      try {
        await cleanReply(ctx, aiMessage);
      } catch (err) {
        logger.warn('Failed to send AI message:', err.message);
      }
    }

    const totalTime = Date.now() - startTime;
    
    // Save text conversation (no tool calls)
    if (ctx && aiMessage) {
      saveToConversationHistory(ctx, [
        { role: 'user', content: sanitizedCommand },
        { role: 'assistant', content: aiMessage }
      ]);
    }
    
    logger.info('ai_text_response_completed', {
      shopId,
      userId: ctx?.from?.id,
      totalTimeMs: totalTime,
      responseLength: aiMessage?.length || 0
    });

    return {
      success: true,
      message: aiMessage || '✅ Команда обработана',
      data: null,
      streamingMessageId: streamingMessage?.message_id // For message cleanup tracking
    };

  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error('AI product command error:', {
      totalTimeMs: totalTime,
      error: error.message,
      stack: error.stack,
      shopId,
      command: sanitizedCommand.substring(0, 100),
      status: error.status,
      code: error.code,
      timestamp: new Date().toISOString()
    });

    // Handle specific errors with user-friendly messages
    if (error.status === 503) {
      return {
        success: false,
        message: '⏳ Сервис временно перегружен\n\nПовторите через минуту.',
        retry: true
      };
    }

    if (error.status === 429) {
      return {
        success: false,
        message: '⚠️ Слишком много запросов\n\nПодождите минуту и попробуйте снова.',
        retry: true
      };
    }

    if (error.status === 401) {
      return {
        success: false,
        message: '🔐 Проблема с авторизацией\n\nПерезапустите бота командой /start',
        fallbackToMenu: true
      };
    }

    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        message: '⏱ Превышено время ожидания\n\nПопробуйте упростить запрос или повторите позже.',
        retry: true
      };
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        message: '🔌 Проблема с подключением\n\nПовторите через несколько секунд.',
        retry: true
      };
    }

    return {
      success: false,
      message: '❌ Не удалось обработать команду\n\nИспользуйте меню или попробуйте переформулировать.',
      fallbackToMenu: true
    };
  }
}

/**
 * Execute tool call from AI
 * 
 * @param {string} functionName - Function to execute
 * @param {Object} args - Function arguments
 * @param {Object} context - Context with shopId, token, products
 * @returns {Object} Result object
 */
async function executeToolCall(functionName, args, context) {
  const { shopId, token, products, ctx, clarifiedProductId } = context;

  try {
    switch (functionName) {
      case 'addProduct':
        return await handleAddProduct(args, shopId, token);

      case 'bulkAddProducts':
        return await handleBulkAddProducts(args, shopId, token);

      case 'deleteProduct':
        return await handleDeleteProduct(args, shopId, token, products, clarifiedProductId);

      case 'listProducts':
        return await handleListProducts(products);

      case 'searchProduct':
        return await handleSearchProduct(args, products);

      case 'updateProduct':
        return await handleUpdateProduct(args, shopId, token, products, clarifiedProductId);

      case 'bulkDeleteAll':
        return await handleBulkDeleteAll(args, shopId, token, ctx);

      case 'bulkDeleteByNames':
        return await handleBulkDeleteByNames(args, shopId, token, products);

      case 'recordSale':
        return await handleRecordSale(args, shopId, token, products, clarifiedProductId);

      case 'getProductInfo':
        return await handleGetProductInfo(args, products, clarifiedProductId);

      case 'bulkUpdatePrices':
        return await handleBulkUpdatePrices(args, shopId, token, products);

      default:
        return {
          success: false,
          message: `❌ Неизвестная операция: ${functionName}`
        };
    }
  } catch (error) {
    logger.error(`Tool execution error (${functionName}):`, error);
    return {
      success: false,
      message: `❌ Ошибка выполнения: ${error.message}`
    };
  }
}

/**
 * Add product handler
 */
async function handleAddProduct(args, shopId, token) {
  const { name, price, stock } = args;

  // Validate
  if (!name || name.length < 3) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Product name must be at least 3 characters',
          field: 'name',
          value: name,
          constraint: 'minLength: 3'
        }
      }
    };
  }

  if (!price || price <= 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Price must be greater than 0',
          field: 'price',
          value: price,
          constraint: 'min: 0.01'
        }
      }
    };
  }

  const normalizedStock = stock === undefined || stock === null ? 1 : stock;

  if (!Number.isFinite(normalizedStock) || normalizedStock < 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Stock quantity must be zero or a positive integer',
          field: 'stock',
          value: stock,
          hint: 'Например: 1, 5, 10'
        }
      }
    };
  }

  // Auto-transliterate Russian names to English
  const transliteratedName = autoTransliterateProductName(name);
  const translitInfo = getTransliterationInfo(name, transliteratedName);

  // Log transliteration if occurred
  if (translitInfo.changed) {
    logger.info('product_name_transliterated', {
      original: name,
      transliterated: transliteratedName,
      shopId
    });
  }

  try {
    const product = await productApi.createProduct({
      name: transliteratedName,  // Use transliterated name
      price,
      currency: 'USD',
      shopId,
      stockQuantity: normalizedStock
    }, token);

    return {
      success: true,
      data: {
        action: 'product_created',
        product: {
          id: product.id,
          name: transliteratedName,
          originalName: translitInfo.changed ? name : null,
          price: product.price,
          stock_quantity: product.stock_quantity,
          transliterated: translitInfo.changed
        }
      }
    };
  } catch (error) {
    logger.error('Add product via AI failed:', error);
    return {
      success: false,
      data: {
        error: {
          code: 'API_ERROR',
          message: 'Failed to create product',
          details: error.message
        }
      }
    };
  }
}

/**
 * Bulk add products handler
 */
async function handleBulkAddProducts(args, shopId, token) {
  const { products } = args;

  // Validate
  if (!products || !Array.isArray(products)) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Products array is required',
          field: 'products'
        }
      }
    };
  }

  if (products.length < 2) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Bulk add requires at least 2 products',
          field: 'products',
          count: products.length
        }
      }
    };
  }

  const results = {
    successful: [],
    failed: []
  };

  // Process each product
  for (const product of products) {
    const { name, price, stock } = product;
    const normalizedStock = stock === undefined || stock === null ? 1 : stock;

    // Validate individual product
    if (!name || name.length < 3) {
      results.failed.push({
        name: name || 'unnamed',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name must be at least 3 characters',
          field: 'name'
        }
      });
      continue;
    }

    if (!price || price <= 0) {
      results.failed.push({
        name,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Price must be greater than 0',
          field: 'price'
        }
      });
      continue;
    }

    if (!Number.isFinite(normalizedStock) || normalizedStock < 0) {
      results.failed.push({
        name,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Stock quantity must be zero or a positive integer',
          field: 'stock',
          value: stock
        }
      });
      continue;
    }

    // Auto-transliterate
    const transliteratedName = autoTransliterateProductName(name);
    const translitInfo = getTransliterationInfo(name, transliteratedName);

    // Log transliteration if occurred
    if (translitInfo.changed) {
      logger.info('product_name_transliterated', {
        original: name,
        transliterated: transliteratedName,
        shopId
      });
    }

    try {
      const createdProduct = await productApi.createProduct({
        name: transliteratedName,
        price,
        currency: 'USD',
        shopId,
        stockQuantity: normalizedStock
      }, token);

      results.successful.push({
        name: transliteratedName,
        originalName: translitInfo.changed ? name : null,
        price: createdProduct.price,
        stock_quantity: createdProduct.stock_quantity,
        id: createdProduct.id,
        transliterated: translitInfo.changed
      });
    } catch (error) {
      logger.error('Bulk add product failed:', { name, error: error.message });
      results.failed.push({
        name,
        error: {
          code: 'API_ERROR',
          message: 'Failed to create product',
          details: error.message
        }
      });
    }
  }

  // Build result
  const successCount = results.successful.length;
  const failCount = results.failed.length;

  if (successCount === 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'BULK_ADD_FAILED',
          message: 'Failed to add any products',
          totalAttempted: products.length,
          failures: results.failed
        }
      }
    };
  }

  return {
    success: true,
    data: {
      action: 'bulk_products_added',
      totalAttempted: products.length,
      successCount,
      failCount,
      successful: results.successful,
      failed: failCount > 0 ? results.failed : null
    }
  };
}

/**
 * Delete product handler
 */
async function handleDeleteProduct(args, shopId, token, products, clarifiedProductId = null) {
  const { productName } = args;

  if (!productName) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Product name is required',
          field: 'productName'
        }
      }
    };
  }

  // If clarifiedProductId is provided, use it directly
  let product = null;
  if (clarifiedProductId) {
    product = products.find(p => p.id === clarifiedProductId);
    if (product) {
      logger.info('delete_product_clarified', {
        shopId,
        productId: clarifiedProductId,
        productName: product.name
      });
    }
  }

  // If no clarified product, use fuzzy search
  if (!product) {
    // Use fuzzy search for better matching
    const fuzzyMatches = fuzzySearchProducts(productName, products, 0.6);
    const matches = fuzzyMatches.map(m => m.product);

    if (matches.length === 0) {
      return {
        success: false,
        data: {
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
            searchQuery: productName,
            suggestion: 'Try searching with a different name or check the product list'
          }
        }
      };
    }

    if (matches.length > 1) {
      // Multiple matches - need clarification
      return {
        success: false,
        needsClarification: true,
        data: {
          action: 'multiple_matches_found',
          searchQuery: productName,
          matches: matches.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price
          })),
          operation: 'delete'
        }
      };
    }

    // Single match - use it
    product = matches[0];
  }

  try {
    await productApi.deleteProduct(product.id, token);

    return {
      success: true,
      data: {
        action: 'product_deleted',
        product: {
          id: product.id,
          name: product.name,
          price: product.price
        }
      }
    };
  } catch (error) {
    logger.error('Delete product via AI failed:', error);
    return {
      success: false,
      data: {
        error: {
          code: 'API_ERROR',
          message: 'Failed to delete product',
          productName: product.name,
          details: error.message
        }
      }
    };
  }
}

/**
 * List products handler
 */
async function handleListProducts(products) {
  return {
    success: true,
    data: {
      action: 'products_listed',
      totalCount: products.length,
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock_quantity: p.stock_quantity || 0
      }))
    }
  };
}

/**
 * Search product handler
 */
async function handleSearchProduct(args, products) {
  const { query } = args;

  if (!query) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query is required',
          field: 'query'
        }
      }
    };
  }

  // Search (case-insensitive, partial match)
  const matches = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  if (matches.length === 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'NO_RESULTS',
          message: 'No products found',
          searchQuery: query,
          suggestion: 'Try a different search term'
        }
      }
    };
  }

  return {
    success: true,
    data: {
      action: 'products_found',
      searchQuery: query,
      totalFound: matches.length,
      products: matches.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock_quantity: p.stock_quantity || 0
      }))
    }
  };
}

/**
 * Update product handler
 */
async function handleUpdateProduct(args, shopId, token, products, clarifiedProductId = null) {
  const { productName, updates } = args;

  if (!productName) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Product name is required',
          field: 'productName'
        }
      }
    };
  }

  if (!updates || typeof updates !== 'object') {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Updates object is required',
          field: 'updates',
          hint: 'Specify price, name, or stock_quantity to update'
        }
      }
    };
  }

  // Check if at least one update field is provided
  const {
    name: newName,
    price: newPrice,
    stock_quantity: newStock,
    discount_percentage: rawDiscountPercentage,
    discount_expires_at: rawDiscountExpiresAt
  } = updates;

  if (!newName && newPrice === undefined && newStock === undefined &&
      rawDiscountPercentage === undefined && rawDiscountExpiresAt === undefined) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update',
          hint: 'Specify at least one field: name, price, stock_quantity, discount_percentage or discount_expires_at'
        }
      }
    };
  }

  // If clarifiedProductId is provided, use it directly (skip fuzzy search)
  let product = null;
  if (clarifiedProductId) {
    product = products.find(p => p.id === clarifiedProductId);
    if (product) {
      logger.info('update_product_clarified', {
        shopId,
        productId: clarifiedProductId,
        productName: product.name
      });
    }
  }

  // If no clarified product, use fuzzy search
  if (!product) {
    // Use fuzzy search for better matching
    const fuzzyMatches = fuzzySearchProducts(productName, products, 0.6);
    const matches = fuzzyMatches.map(m => m.product);

    if (matches.length === 0) {
      return {
        success: false,
        data: {
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
            searchQuery: productName
          }
        }
      };
    }

    if (matches.length > 1) {
      return {
        success: false,
        needsClarification: true,
        data: {
          action: 'multiple_matches_found',
          searchQuery: productName,
          matches: matches.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price
          })),
          operation: 'update'
        }
      };
    }

    product = matches[0];
  }

  // Build update payload
  const updateData = {};
  const changes = {};

  if (newName) {
    updateData.name = newName;
    changes.name = { old: product.name, new: newName };
  }

  if (newStock !== undefined && Number.isFinite(newStock) && newStock >= 0) {
    updateData.stockQuantity = newStock;
    changes.stock_quantity = { old: product.stock_quantity, new: newStock };
  }

  const currentPrice = Number(product.price);
  const existingOriginalPrice = product.original_price ? Number(product.original_price) : null;
  const basePriceWithoutOverride = existingOriginalPrice && existingOriginalPrice > 0
    ? existingOriginalPrice
    : currentPrice;

  let priceAssigned = false;

  let discountPercentage;
  if (rawDiscountPercentage !== undefined) {
    discountPercentage = Number(rawDiscountPercentage);
    if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
      return {
        success: false,
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            field: 'discount_percentage',
            message: 'Discount percentage must be between 0 and 100',
            value: rawDiscountPercentage
          }
        }
      };
    }
  }

  let discountExpiresAtISO = null;
  if (rawDiscountExpiresAt !== undefined && rawDiscountExpiresAt !== null && rawDiscountExpiresAt !== '') {
    const expiresInput = String(rawDiscountExpiresAt).trim();
    const durationMs = parseDurationToMs(expiresInput);

    if (durationMs) {
      discountExpiresAtISO = new Date(Date.now() + durationMs).toISOString();
    } else {
      const parsedDate = new Date(expiresInput);
      if (Number.isNaN(parsedDate.getTime())) {
        return {
          success: false,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              field: 'discount_expires_at',
              message: 'Invalid discount expiration format',
              value: rawDiscountExpiresAt,
              hint: 'Use ISO datetime or duration like "6 часов"'
            }
          }
        };
      }
      discountExpiresAtISO = parsedDate.toISOString();
    }
  }

  if (discountPercentage === undefined && rawDiscountExpiresAt !== undefined) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          field: 'discount_expires_at',
          message: 'Provide discount_percentage together with discount_expires_at'
        }
      }
    };
  }

  if (discountPercentage !== undefined) {
    if (discountPercentage === 0) {
      const restoredPrice = newPrice !== undefined
        ? newPrice
        : (existingOriginalPrice !== null ? existingOriginalPrice : currentPrice);

      updateData.discountPercentage = 0;
      updateData.discountExpiresAt = null;
      updateData.originalPrice = null;

      if (restoredPrice !== undefined && Number.isFinite(restoredPrice)) {
        updateData.price = restoredPrice;
        priceAssigned = true;

        if (restoredPrice !== currentPrice) {
          changes.price = { old: currentPrice, new: restoredPrice };
        }
      }

      changes.discount_percentage = { old: product.discount_percentage, new: 0 };
      if (product.discount_expires_at || rawDiscountExpiresAt !== undefined) {
        changes.discount_expires_at = { old: product.discount_expires_at, new: null };
      }
    } else {
      const basePrice = newPrice !== undefined ? newPrice : basePriceWithoutOverride;

      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        return {
          success: false,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              field: 'price',
              message: 'Base price is required to apply discount',
              hint: 'Specify price or make sure product has original price'
            }
          }
        };
      }

      const discountedPrice = Math.round(basePrice * (1 - discountPercentage / 100) * 100) / 100;

      updateData.price = discountedPrice;
      updateData.originalPrice = basePrice;
      updateData.discountPercentage = discountPercentage;
      updateData.discountExpiresAt = discountExpiresAtISO;
      priceAssigned = true;

      changes.discount_percentage = { old: product.discount_percentage, new: discountPercentage };
      if (discountExpiresAtISO !== null || rawDiscountExpiresAt !== undefined) {
        changes.discount_expires_at = { old: product.discount_expires_at, new: discountExpiresAtISO };
      }
      if (discountedPrice !== currentPrice) {
        changes.price = { old: currentPrice, new: discountedPrice };
      }
    }
  }

  if (!priceAssigned && newPrice !== undefined && Number.isFinite(newPrice) && newPrice > 0) {
    updateData.price = newPrice;
    changes.price = { old: currentPrice, new: newPrice };

    if (product.discount_percentage > 0 && discountPercentage === undefined) {
      updateData.discountPercentage = 0;
      updateData.discountExpiresAt = null;
      updateData.originalPrice = null;

      if (!changes.discount_percentage) {
        changes.discount_percentage = { old: product.discount_percentage, new: 0 };
      }
      if (product.discount_expires_at && !changes.discount_expires_at) {
        changes.discount_expires_at = { old: product.discount_expires_at, new: null };
      }
    }
  }

  try {
    const updated = await productApi.updateProduct(product.id, updateData, token);

    return {
      success: true,
      data: {
        action: 'product_updated',
        product: {
          id: updated.id,
          name: updated.name,
          price: updated.price,
          stock_quantity: updated.stock_quantity,
          discount_percentage: updated.discount_percentage,
          discount_expires_at: updated.discount_expires_at,
          original_price: updated.original_price
        },
        changes
      }
    };
  } catch (error) {
    logger.error('Update product via AI failed:', error);
    return {
      success: false,
      data: {
        error: {
          code: 'API_ERROR',
          message: 'Failed to update product',
          productName: product.name,
          details: error.message
        }
      }
    };
  }
}

/**
 * Bulk delete all products handler
 */
async function handleBulkDeleteAll(args, shopId, token, ctx) {
  const { Markup } = await import('telegraf');
  
  // Логировать вызов
  logger.info('bulkDeleteAll_called', {
    shopId,
    userId: ctx?.from?.id,
    args: JSON.stringify(args),
    confirm: args?.confirm,
    timestamp: new Date().toISOString()
  });

  // Проверить параметр confirm
  if (!args || !args.confirm || args.confirm !== true) {
    logger.info('bulkDeleteAll_needs_confirmation', { shopId, userId: ctx?.from?.id });
    
    return {
      success: false,
      needsConfirmation: true,
      message: '⚠️ Точно удалить ВСЕ товары? Это действие нельзя отменить.',
      keyboard: Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да, удалить всё', 'confirm_bulk_delete_all')],
        [Markup.button.callback('❌ Отмена', 'ai_cancel')]
      ])
    };
  }

  // Логировать подтверждённое удаление
  logger.warn('bulkDeleteAll_confirmed', {
    shopId,
    userId: ctx?.from?.id,
    confirm: args.confirm
  });

  try {
    const result = await productApi.bulkDeleteAll(shopId, token);

    logger.info('bulkDeleteAll_success', {
      shopId,
      deletedCount: result.deletedCount
    });

    return {
      success: true,
      data: {
        action: 'bulk_delete_all',
        deletedCount: result.deletedCount
      }
    };
  } catch (error) {
    logger.error('Bulk delete all via AI failed:', error);
    return {
      success: false,
      data: {
        error: {
          code: 'API_ERROR',
          message: 'Failed to delete all products',
          details: error.message
        }
      }
    };
  }
}

/**
 * Bulk delete by names handler
 */
async function handleBulkDeleteByNames(args, shopId, token, products) {
  const { productNames } = args;

  if (!productNames || !Array.isArray(productNames) || productNames.length === 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Product names array is required',
          field: 'productNames'
        }
      }
    };
  }

  // Find matching product IDs
  const productIds = [];
  const found = [];
  const notFound = [];

  for (const name of productNames) {
    const match = products.find(p =>
      p.name.toLowerCase().includes(name.toLowerCase())
    );

    if (match) {
      productIds.push(match.id);
      found.push(match.name);
    } else {
      notFound.push(name);
    }
  }

  if (productIds.length === 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'PRODUCTS_NOT_FOUND',
          message: 'None of the specified products were found',
          searchedNames: productNames,
          notFound
        }
      }
    };
  }

  try {
    const result = await productApi.bulkDeleteByIds(shopId, productIds, token);

    return {
      success: true,
      data: {
        action: 'bulk_delete_by_names',
        deletedCount: result.deletedCount,
        deletedProducts: found,
        notFound: notFound.length > 0 ? notFound : null
      }
    };
  } catch (error) {
    logger.error('Bulk delete by names via AI failed:', error);
    return {
      success: false,
      data: {
        error: {
          code: 'API_ERROR',
          message: 'Failed to delete products',
          details: error.message
        }
      }
    };
  }
}

/**
 * Record sale handler (decrease stock)
 */
async function handleRecordSale(args, shopId, token, products, clarifiedProductId = null) {
  const { productName, quantity = 1 } = args; // Default quantity to 1 if not specified

  if (!productName) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Product name is required',
          field: 'productName'
        }
      }
    };
  }

  if (quantity <= 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Quantity must be greater than 0',
          field: 'quantity',
          value: quantity
        }
      }
    };
  }

  // If clarifiedProductId is provided, use it directly
  let product = null;
  if (clarifiedProductId) {
    product = products.find(p => p.id === clarifiedProductId);
    if (product) {
      logger.info('record_sale_clarified', {
        shopId,
        productId: clarifiedProductId,
        productName: product.name,
        quantity
      });
    }
  }

  // If no clarified product, use fuzzy search
  if (!product) {
    // Use fuzzy search for better matching
    const fuzzyMatches = fuzzySearchProducts(productName, products, 0.6);
    const matches = fuzzyMatches.map(m => m.product);

    if (matches.length === 0) {
      return {
        success: false,
        data: {
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
            searchQuery: productName
          }
        }
      };
    }

    if (matches.length > 1) {
      return {
        success: false,
        needsClarification: true,
        data: {
          action: 'multiple_matches_found',
          searchQuery: productName,
          matches: matches.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price
          })),
          operation: 'record_sale'
        }
      };
    }

    product = matches[0];
  }

  const currentStock = product.stock_quantity || 0;
  
  // Check if enough stock
  if (currentStock < quantity) {
    return {
      success: false,
      data: {
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Not enough stock available',
          productName: product.name,
          requested: quantity,
          available: currentStock,
          shortage: quantity - currentStock
        }
      }
    };
  }

  const newStock = currentStock - quantity;

  try {
    await productApi.updateProduct(product.id, {
      stockQuantity: newStock
    }, token);

    return {
      success: true,
      data: {
        action: 'sale_recorded',
        product: {
          id: product.id,
          name: product.name,
          price: product.price
        },
        sale: {
          quantity,
          previousStock: currentStock,
          newStock
        }
      }
    };
  } catch (error) {
    logger.error('Record sale via AI failed:', error);
    return {
      success: false,
      data: {
        error: {
          code: 'API_ERROR',
          message: 'Failed to record sale',
          productName: product.name,
          details: error.message
        }
      }
    };
  }
}

/**
 * Get product info handler
 */
async function handleGetProductInfo(args, products, clarifiedProductId = null) {
  const { productName } = args;

  if (!productName) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Product name is required',
          field: 'productName'
        }
      }
    };
  }

  // If clarifiedProductId is provided, use it directly
  let product = null;
  if (clarifiedProductId) {
    product = products.find(p => p.id === clarifiedProductId);
    if (product) {
      logger.info('get_product_info_clarified', {
        productId: clarifiedProductId,
        productName: product.name
      });
      
      return {
        success: true,
        data: {
          action: 'product_info_retrieved',
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            stock_quantity: product.stock_quantity || 0
          }
        }
      };
    }
  }

  // If no clarified product, search for product
  const matches = products.filter(p =>
    p.name.toLowerCase().includes(productName.toLowerCase())
  );

  if (matches.length === 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found',
          searchQuery: productName
        }
      }
    };
  }

  if (matches.length > 1) {
    return {
      success: false,
      needsClarification: true,
      data: {
        action: 'multiple_matches_found',
        searchQuery: productName,
        matches: matches.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price
        })),
        operation: 'info'
      }
    };
  }

  product = matches[0];

  return {
    success: true,
    data: {
      action: 'product_info_retrieved',
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        stock_quantity: product.stock_quantity || 0
      }
    }
  };
}

/**
 * Bulk update prices handler (discount/increase all products)
 */
async function handleBulkUpdatePrices(args, shopId, token, products) {
  const { percentage, operation, duration, excludedProducts = [], discount_type: explicitDiscountType } = args;

  logger.info('handleBulkUpdatePrices called', {
    percentage,
    operation,
    duration,
    excludedProducts,
    totalProducts: products.length
  });

  if (!percentage || percentage < 0.1 || percentage > 100) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Percentage must be between 0.1 and 100',
          field: 'percentage',
          value: percentage,
          constraint: 'min: 0.1, max: 100'
        }
      }
    };
  }

  if (!operation || !['increase', 'decrease'].includes(operation)) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid operation',
          field: 'operation',
          value: operation,
          allowed: ['increase', 'decrease']
        }
      }
    };
  }

  if (!products || products.length === 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'NO_PRODUCTS',
          message: 'No products available to update prices'
        }
      }
    };
  }

  let excludedProductIds = [];
  if (excludedProducts && excludedProducts.length > 0) {
    for (const excludedName of excludedProducts) {
      const matches = fuzzySearchProducts(excludedName, products, 0.4);

      if (matches.length > 0) {
        excludedProductIds.push(...matches.map(m => m.product.id));

        logger.info('Excluded product matched', {
          query: excludedName,
          matches: matches.map(m => ({ id: m.product.id, name: m.product.name, score: m.score }))
        });
      } else {
        logger.warn('Excluded product not found for discount', { query: excludedName });
      }
    }

    excludedProductIds = [...new Set(excludedProductIds)];
  }

  let durationMs = null;
  if (duration) {
    durationMs = parseDurationToMs(duration);
    if (!durationMs) {
      return {
        success: false,
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid duration format',
            field: 'duration',
            value: duration,
            hint: 'Use format like "6 hours" or "3 days"'
          }
        }
      };
    }
  }

  let discountType = explicitDiscountType ? String(explicitDiscountType).toLowerCase() : null;
  if (discountType && !['permanent', 'timer'].includes(discountType)) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          field: 'discount_type',
          message: 'discount_type must be "permanent" or "timer"'
        }
      }
    };
  }

  if (operation === 'increase') {
    discountType = 'permanent';
    durationMs = null;
  } else {
    if (!discountType) {
      discountType = durationMs ? 'timer' : 'permanent';
    }

    if (discountType === 'timer' && !durationMs) {
      return {
        success: false,
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            field: 'duration',
            message: 'Provide duration for timer discount'
          }
        }
      };
    }

    if (discountType === 'permanent') {
      durationMs = null;
    }
  }

  const multiplier = operation === 'decrease'
    ? (1 - percentage / 100)
    : (1 + percentage / 100);

  const operationSymbol = operation === 'decrease' ? '-' : '+';
  const operationText = operation === 'decrease' ? 'Скидка' : 'Наценка';

  const productsToUpdate = products.filter(p => !excludedProductIds.includes(p.id));
  if (productsToUpdate.length === 0) {
    return {
      success: false,
      data: {
        error: {
          code: 'NO_PRODUCTS_TO_UPDATE',
          message: 'No products left to apply discount after exclusions'
        }
      }
    };
  }

  const previewProducts = productsToUpdate.slice(0, 3).map(p => {
    const newPrice = Math.round(Number(p.price) * multiplier * 100) / 100;
    return {
      id: p.id,
      name: p.name,
      oldPrice: Number(p.price),
      newPrice
    };
  });

  const durationText = durationMs ? formatDuration(durationMs) : null;

  try {
    const result = await productApi.applyBulkDiscount(shopId, token, {
      percentage,
      type: discountType,
      duration: durationMs,
      excludedProductIds
    });

    return {
      success: true,
      data: {
        action: 'bulk_update_prices',
        percentage,
        operation,
        operationText,
        operationSymbol,
        discountType,
        durationMs,
        durationText,
        excludedProductIds,
        previewProducts,
        updatedCount: result?.productsUpdated ?? productsToUpdate.length,
        products: result?.updatedProducts || result?.products || []
      }
    };
  } catch (error) {
    logger.error('Bulk update prices execution failed:', error);

    return {
      success: false,
      data: {
        error: {
          code: 'API_ERROR',
          message: 'Failed to update prices',
          details: error.message
        }
      }
    };
  }
}

export { saveToConversationHistory };

export default {
  processProductCommand,
  noteProductContext
};
