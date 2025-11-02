import deepseek from './deepseek.js';
import { productTools } from '../tools/productTools.js';
import { generateProductAIPrompt, sanitizeUserInput } from '../utils/systemPrompts.js';
import { productApi } from '../utils/api.js';
import { fuzzySearchProducts } from '../utils/fuzzyMatch.js';
import { autoTransliterateProductName, getTransliterationInfo } from '../utils/transliterate.js';
import logger from '../utils/logger.js';
import { reply as cleanReply } from '../utils/cleanReply.js';
import { messages } from '../texts/messages.js';
const { seller: { aiProducts: aiMessages } } = messages;

/**
 * AI Product Management Service
 * Orchestrates AI calls and executes product operations
 */

/**
 * Format price - remove trailing zeros from PostgreSQL NUMERIC
 * @param {string|number} price - Price value
 * @returns {string} Formatted price (e.g., "1200" or "1200.50")
 */
function formatPrice(price) {
  const num = parseFloat(price);
  if (isNaN(num)) return '0';

  // If integer, return without decimals
  if (num % 1 === 0) {
    return num.toString();
  }

  // Otherwise, format to 2 decimals and remove trailing zeros
  return num.toFixed(2).replace(/\.?0+$/, '');
}

// Conversation history constants
const MAX_HISTORY_MESSAGES = 40; // Keep last 40 messages (~10 tool exchanges or 20 text exchanges)
const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

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

/**
 * Process AI command for product management
 * 
 * @param {string} userCommand - User's natural language command
 * @param {Object} context - Context object with shopId, shopName, token, products
 * @returns {Object} Result object with success, message, data, needsClarification
 */
export async function processProductCommand(userCommand, context) {
  const { shopId, shopName, token, products = [], ctx } = context;

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

      return result;
    }

    // Generate system prompt
    const systemPrompt = generateProductAIPrompt(shopName, products);

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

    logger.info('ai_product_command_processed', {
      shopId,
      command: sanitizedCommand,
      streaming: true
    });

    const choice = response.choices[0];

    // Check if AI wants to use a tool
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      const toolCall = choice.message.tool_calls[0]; // Take first tool call
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      logger.info('ai_tool_call', {
        shopId,
        function: functionName,
        arguments: args
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
      const result = await executeToolCall(functionName, args, { shopId, token, products, ctx });

      // If function returned legacy message format (backward compatibility)
      if (result.message && !result.data) {
        // Legacy format - save only text messages for backward compatibility
        if (ctx && result.message) {
          saveToConversationHistory(ctx, [
            { role: 'user', content: sanitizedCommand },
            { role: 'assistant', content: result.message }
          ]);
        }
        return result;
      }

      // LOOP-BACK PATTERN: Pass function result back to AI for natural response
      // Add tool call and result to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: toolCall.id,
          type: 'function',
          function: {
            name: functionName,
            arguments: toolCall.function.arguments
          }
        }]
      });

      conversationHistory.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: functionName,
        content: JSON.stringify(result.data) // Pass structured data, not message!
      });

      logger.debug('loop_back_to_ai', {
        shopId,
        function: functionName,
        hasData: !!result.data
      });

      // Restart typing indicator for second AI call
      if (ctx) {
        await ctx.sendChatAction('typing').catch(() => {});
        typingInterval = setInterval(() => {
          ctx.sendChatAction('typing').catch(() => {});
        }, 4000);
      }

      // Reset streaming state for final AI response
      streamingMessage = null;
      lastUpdateTime = 0;
      wordCount = 0;

      // AI formulates natural response based on function result
      let finalResponse;
      try {
        finalResponse = await deepseek.chatStreaming(
          systemPrompt,
          '',
          [], // No tools on second call - just generate response
          conversationHistory,
          onChunk
        );
      } finally {
        // Stop typing indicator
        if (typingInterval) {
          clearInterval(typingInterval);
        }
      }

      const finalMessage = finalResponse.choices[0].message.content;

      // Final update for streaming message
      if (streamingMessage && ctx && finalMessage) {
        try {
          await ctx.telegram.editMessageText(
            streamingMessage.chat.id,
            streamingMessage.message_id,
            undefined,
            finalMessage
          );
        } catch (err) {
          if (err.response?.description !== 'Bad Request: message is not modified') {
            logger.warn('Failed to send final AI message:', err.message);
          }
        }
      } else if (!streamingMessage && ctx && finalMessage) {
        try {
          await cleanReply(ctx, finalMessage);
        } catch (err) {
          logger.warn('Failed to send AI message:', err.message);
        }
      }

      // Save FULL conversation flow with tool calls and tool results
      if (ctx && finalMessage) {
        saveToConversationHistory(ctx, [
          { role: 'user', content: sanitizedCommand },
          {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: toolCall.id,
              type: 'function',
              function: {
                name: functionName,
                arguments: toolCall.function.arguments
              }
            }]
          },
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            name: functionName,
            content: JSON.stringify(result.data)
          },
          {
            role: 'assistant',
            content: finalMessage
          }
        ]);
      }

      return {
        success: result.success,
        message: finalMessage || '✅ Команда обработана',
        data: result.data,
        needsConfirmation: result.needsConfirmation,
        needsClarification: result.needsClarification,
        keyboard: result.keyboard,
        operation: result.operation
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

    // Save text conversation (no tool calls)
    if (ctx && aiMessage) {
      saveToConversationHistory(ctx, [
        { role: 'user', content: sanitizedCommand },
        { role: 'assistant', content: aiMessage }
      ]);
    }

    return {
      success: true,
      message: aiMessage || '✅ Команда обработана',
      data: null,
      streamingMessageId: streamingMessage?.message_id // For message cleanup tracking
    };

  } catch (error) {
    logger.error('AI product command error:', {
      error: error.message,
      shopId,
      command: sanitizedCommand
    });

    // Handle specific errors
    if (error.status === 503) {
      return {
        success: false,
        message: '⏳ AI перегружен. Попробуйте через минуту.',
        retry: true
      };
    }

    if (error.status === 401) {
      return {
        success: false,
        message: '❌ Ошибка авторизации AI. Проверьте конфигурацию.',
        fallbackToMenu: true
      };
    }

    return {
      success: false,
      message: '❌ Ошибка AI. Используйте обычное меню.',
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
  const { shopId, token, products, ctx } = context;

  try {
    switch (functionName) {
      case 'addProduct':
        return await handleAddProduct(args, shopId, token);

      case 'bulkAddProducts':
        return await handleBulkAddProducts(args, shopId, token);

      case 'deleteProduct':
        return await handleDeleteProduct(args, shopId, token, products);

      case 'listProducts':
        return await handleListProducts(products);

      case 'searchProduct':
        return await handleSearchProduct(args, products);

      case 'updateProduct':
        return await handleUpdateProduct(args, shopId, token, products);

      case 'bulkDeleteAll':
        return await handleBulkDeleteAll(shopId, token, ctx);

      case 'bulkDeleteByNames':
        return await handleBulkDeleteByNames(args, shopId, token, products);

      case 'recordSale':
        return await handleRecordSale(args, shopId, token, products);

      case 'getProductInfo':
        return await handleGetProductInfo(args, products);

      case 'bulkUpdatePrices':
        return await handleBulkUpdatePrices(args, shopId, token, products, ctx);

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

  if (stock === undefined || stock === null) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Stock quantity is required',
          field: 'stock',
          hint: 'Please specify how many items are in stock'
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
      stockQuantity: stock
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

    if (stock === undefined || stock === null) {
      results.failed.push({
        name,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Stock quantity is required',
          field: 'stock'
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
        stockQuantity: stock
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
async function handleDeleteProduct(args, shopId, token, products) {
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

  // Single match - delete it
  const product = matches[0];

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
async function handleUpdateProduct(args, shopId, token, products) {
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
  const { name: newName, price: newPrice, stock_quantity: newStock } = updates;
  if (!newName && newPrice === undefined && newStock === undefined) {
    return {
      success: false,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update',
          hint: 'Specify at least one field: name, price, or stock_quantity'
        }
      }
    };
  }

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

  const product = matches[0];

  // Build update payload
  const updateData = {};
  const changes = {};
  
  if (newName) {
    updateData.name = newName;
    changes.name = { old: product.name, new: newName };
  }
  if (newPrice !== undefined && newPrice > 0) {
    updateData.price = newPrice;
    changes.price = { old: product.price, new: newPrice };
  }
  if (newStock !== undefined && newStock >= 0) {
    updateData.stockQuantity = newStock;
    changes.stock_quantity = { old: product.stock_quantity, new: newStock };
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
          stock_quantity: updated.stock_quantity
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
async function handleBulkDeleteAll(shopId, token) {
  try {
    const result = await productApi.bulkDeleteAll(shopId, token);

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
async function handleRecordSale(args, shopId, token, products) {
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

  const product = matches[0];
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
    const updated = await productApi.updateProduct(product.id, {
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
async function handleGetProductInfo(args, products) {
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

  // Search for product
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

  const product = matches[0];

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
async function handleBulkUpdatePrices(args, shopId, token, products, ctx) {
  const { percentage, operation, duration } = args;

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

  // Parse duration if provided
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

  // Calculate multiplier
  const multiplier = operation === 'decrease' 
    ? (1 - percentage / 100)
    : (1 + percentage / 100);

  const operationSymbol = operation === 'decrease' ? '-' : '+';

  // Build preview
  const previewProducts = products.slice(0, 3).map(p => {
    const newPrice = Math.round(p.price * multiplier * 100) / 100;
    return {
      name: p.name,
      oldPrice: p.price,
      newPrice
    };
  });

  // If duration not specified by AI, ask user for type
  if (!duration) {
    // Store pending operation in session
    if (ctx && ctx.session) {
      ctx.session.pendingDiscountType = {
        percentage,
        operation,
        multiplier,
        operationSymbol,
        shopId,
        token,
        productCount: products.length,
        timestamp: Date.now()
      };
    }

    // Return structured data for AI to formulate natural question
    return {
      success: false,
      needsInput: 'discount_type',
      data: {
        action: 'discount_needs_clarification',
        context: {
          percentage,
          operation,
          operationSymbol,
          productCount: products.length,
          previewProducts,
          totalProducts: products.length,
          availableTypes: ['permanent', 'timer'],
          hint: 'Ask user if this should be a permanent discount or with a timer'
        }
      }
    };
  }

  // Duration was provided by AI - proceed with confirmation
  const durationText = formatDuration(durationMs);
  const discountType = durationMs ? 'timer' : 'permanent';

  // Store pending operation in session for confirmation
  if (ctx && ctx.session) {
    ctx.session.pendingBulkUpdate = {
      percentage,
      operation,
      multiplier,
      operationSymbol,
      shopId,
      token,
      productCount: products.length,
      discountType,
      duration: durationMs,
      timestamp: Date.now()
    };
  }

  // Return confirmation data - AI will formulate natural message
  return {
    success: true,
    needsConfirmation: true,
    data: {
      action: 'bulk_discount_confirmation_needed',
      discount: {
        percentage,
        operation,
        operationSymbol,
        type: discountType,
        duration: durationMs,
        durationText
      },
      impact: {
        totalProducts: products.length,
        previewProducts
      }
    },
    keyboard: {
      inline_keyboard: [[
        { text: '✅ Применить', callback_data: 'bulk_prices_confirm' },
        { text: '◀️ Назад', callback_data: 'bulk_prices_cancel' }
      ]]
    }
  };
}

/**
 * Execute bulk price update after confirmation
 */
export async function executeBulkPriceUpdate(shopId, token, ctx) {
  const pending = ctx.session?.pendingBulkUpdate;
  
  if (!pending) {
    return {
      success: false,
      message: '❌ Операция устарела. Попробуйте снова.'
    };
  }

  const { percentage, operation, operationSymbol, discountType, duration } = pending;
  const operationText = operation === 'decrease' ? 'Скидка' : 'Наценка';

  try {
    // Убрано - вызывающий код сам управляет сообщением

    // Call new bulk discount API
    const result = await productApi.applyBulkDiscount(shopId, token, {
      percentage,
      type: discountType || 'permanent',
      duration: duration || null
    });

    // Clear pending operation
    delete ctx.session.pendingBulkUpdate;

    if (!result || !result.productsUpdated || result.productsUpdated === 0) {
      // Убрано - вызывающий код сам обновит сообщение
      return {
        success: false,
        message: '❌ Не удалось обновить ни одного товара'
      };
    }

    // Build success message
    const durationInfo = duration ? ` (действует ${formatDuration(duration)})` : '';
    let message = `✅ ${operationText} ${operationSymbol}${percentage}% применена${durationInfo}\n`;
    message += `Обновлено товаров: ${result.productsUpdated}\n\n`;
    
    // Show first 5 updates as examples if available
    if (result.products && result.products.length > 0) {
      const exampleUpdates = result.products.slice(0, 5);
      exampleUpdates.forEach(p => {
        const displayName = p.name.length > 40 ? p.name.slice(0, 37) + '...' : p.name;
        message += `• ${displayName}: ${formatPrice(p.price)}\n`;
      });

      if (result.products.length > 5) {
        message += `... и ещё ${result.products.length - 5} товаров`;
      }
    }

    // Убрано - вызывающий код сам обновит сообщение

    return {
      success: true,
      message,
      data: result,
      operation: 'bulk_update_prices'
    };
  } catch (error) {
    logger.error('Bulk update prices execution failed:', error);
    
    // Clear pending operation
    delete ctx.session?.pendingBulkUpdate;
    
    return {
      success: false,
      message: '❌ Не удалось обновить цены'
    };
  }
}

export default {
  processProductCommand,
  executeBulkPriceUpdate
};
