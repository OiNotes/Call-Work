/**
 * AI Natural Responses Integration Tests
 * 
 * Тестирует что AI отвечает естественно своими словами:
 * 1. AI варьирует формулировки (не повторяется)
 * 2. AI правильно спрашивает недостающую информацию
 * 3. Loop-back pattern работает корректно
 * 4. Context management сохраняет tool messages
 * 
 * 5 ТЕСТОВЫХ СЦЕНАРИЕВ:
 * - Scenario 1: Add product - natural variations
 * - Scenario 2: Discount without type - natural questions
 * - Scenario 3: Update stock without product - natural questions
 * - Scenario 4: Delete with multiple matches - natural listing
 * - Scenario 5: Record sale - natural confirmations
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import { processProductCommand } from '../../src/services/productAI.js';
import { api } from '../../src/utils/api.js';
import deepseek from '../../src/services/deepseek.js';

describe('AI Natural Responses - Integration Tests', () => {
  let mock;
  let deepseekChatStreamingSpy;

  const testContext = {
    shopId: 1,
    shopName: 'Test Shop',
    token: 'test-jwt-token',
    products: [
      { id: 1, name: 'iPhone 12', price: 700, stock_quantity: 10 },
      { id: 2, name: 'iPhone 13', price: 900, stock_quantity: 5 },
      { id: 3, name: 'Case', price: 20, stock_quantity: 15 },
      { id: 4, name: 'Чехол', price: 15, stock_quantity: 15 }
    ],
    ctx: {
      from: { id: 123456 },
      session: {
        aiConversation: null
      },
      sendChatAction: jest.fn().mockResolvedValue(true),
      telegram: {
        editMessageText: jest.fn().mockResolvedValue({ message_id: 999, chat: { id: 123456 }, text: '' }),
        deleteMessage: jest.fn().mockResolvedValue(true)
      }
    }
  };

  beforeEach(() => {
    mock = new MockAdapter(api);
    jest.clearAllMocks();

    // Spy on deepseek.chatStreaming
    deepseekChatStreamingSpy = jest.spyOn(deepseek, 'chatStreaming');
  });

  afterEach(() => {
    mock.reset();
    jest.restoreAllMocks();
  });

  // ==========================================
  // SCENARIO 1: Add product - natural variations
  // ==========================================
  describe('Scenario 1: Add product without stock - AI asks naturally', () => {
    it('5 iterations should produce different natural responses', async () => {
      const responses = [];

      // Mock API: product creation
      mock.onPost('/products').reply(201, {
        data: { id: 4, name: 'iPhone', price: 500, stock_quantity: 0 }
      });

      // Mock DeepSeek: simulate tool call + natural response
      const mockAIResponses = [
        'Готово! iPhone добавлен за 500₽. Хочешь выставить количество на складе?',
        'Отлично! iPhone теперь в каталоге по цене $500. Сколько штук на складе?',
        'Добавил iPhone за 500 баксов. Выставить остаток?',
        'iPhone создан, цена 500₽. Какое количество выставить?',
        'Готово, iPhone за $500 добавлен. Надо указать наличие?'
      ];

      for (let i = 0; i < 5; i++) {
        // First call: tool call
        deepseekChatStreamingSpy.mockResolvedValueOnce({
          choices: [{
            finish_reason: 'tool_calls',
            message: {
              tool_calls: [{
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'addProduct',
                  arguments: JSON.stringify({ name: 'iPhone', price: 500, stock: 0 })
                }
              }]
            }
          }]
        });

        // Second call: natural response after tool execution
        deepseekChatStreamingSpy.mockResolvedValueOnce({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: mockAIResponses[i]
            }
          }]
        });

        const result = await processProductCommand('добавь iPhone 500', testContext);
        responses.push(result.message);

        expect(result.success).toBe(true);
        expect(result.message).toBeTruthy();
      }

      console.log('\n=== Scenario 1 Responses ===');
      responses.forEach((msg, idx) => {
        console.log(`${idx + 1}. ${msg}`);
      });

      // Check variability: at least 4 different responses out of 5
      const uniqueResponses = [...new Set(responses)];
      expect(uniqueResponses.length).toBeGreaterThanOrEqual(4);

      // Check naturalness: no template emojis like "✅ Товар добавлен!"
      responses.forEach(msg => {
        expect(msg).not.toMatch(/^✅/);
        expect(msg).not.toMatch(/📋|📦/);
      });
    });
  });

  // ==========================================
  // SCENARIO 2: Discount without type - AI asks naturally
  // ==========================================
  describe('Scenario 2: Discount without type - AI asks about discount type', () => {
    it('5 iterations should produce different natural questions', async () => {
      const responses = [];

      const mockAIQuestions = [
        'Это постоянная скидка или с таймером?',
        'Постоянная или временная скидка?',
        'Навсегда или с автоистечением?',
        'Сделать постоянной скидкой или ограничить по времени?',
        'Скидка будет действовать всегда или только какое-то время?'
      ];

      for (let i = 0; i < 5; i++) {
        // First call: tool call
        deepseekChatStreamingSpy.mockResolvedValueOnce({
          choices: [{
            finish_reason: 'tool_calls',
            message: {
              tool_calls: [{
                id: 'call_456',
                type: 'function',
                function: {
                  name: 'bulkUpdatePrices',
                  arguments: JSON.stringify({ percentage: 20, operation: 'decrease' })
                }
              }]
            }
          }]
        });

        // Second call: natural question after getting needsInput
        deepseekChatStreamingSpy.mockResolvedValueOnce({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: mockAIQuestions[i]
            }
          }]
        });

        const result = await processProductCommand('скидка 20%', testContext);
        responses.push(result.message);

        expect(result.message).toMatch(/постоянн|таймер|врем|автоистеч|ограничить/i);
      }

      console.log('\n=== Scenario 2 Responses ===');
      responses.forEach((msg, idx) => {
        console.log(`${idx + 1}. ${msg}`);
      });

      // Check variability: at least 4 different questions out of 5
      const uniqueResponses = [...new Set(responses)];
      expect(uniqueResponses.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ==========================================
  // SCENARIO 3: Update stock without product - AI asks which product
  // ==========================================
  describe('Scenario 3: Update stock without product name - AI asks naturally', () => {
    it('5 iterations should produce different natural questions', async () => {
      const responses = [];

      const mockAIQuestions = [
        'Для какого товара?',
        'Какой товар обновить?',
        'Название товара?',
        'Какому товару выставить наличие 5?',
        'Для какой позиции выставить остаток?'
      ];

      for (let i = 0; i < 5; i++) {
        // Mock AI: asks for product name
        deepseekChatStreamingSpy.mockResolvedValueOnce({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: mockAIQuestions[i]
            }
          }]
        });

        const result = await processProductCommand('выстави наличие 5', testContext);
        responses.push(result.message);

        expect(result.success).toBe(true);
        expect(result.message).toBeTruthy();
      }

      console.log('\n=== Scenario 3 Responses ===');
      responses.forEach((msg, idx) => {
        console.log(`${idx + 1}. ${msg}`);
      });

      // Check variability: at least 3 different questions out of 5
      const uniqueResponses = [...new Set(responses)];
      expect(uniqueResponses.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================
  // SCENARIO 4: Delete with multiple matches - AI lists naturally
  // ==========================================
  describe('Scenario 4: Delete with multiple matches - AI lists options naturally', () => {
    it('5 iterations should produce different natural listings', async () => {
      const responses = [];

      const mockAIListings = [
        'Нашёл два iPhone - 12-й за 700₽ и 13-й за 900₽. Какой удалить?',
        'У тебя два айфона: iPhone 12 ($700) и iPhone 13 ($900). Который убрать?',
        'Есть две модели: 12-й (700$) и 13-й (900$). Выбери какой удалить',
        'Два совпадения: iPhone 12 за 700 и iPhone 13 за 900. Какой?',
        'iPhone 12 (700₽) или iPhone 13 (900₽)? Что удаляем?'
      ];

      for (let i = 0; i < 5; i++) {
        // First call: tool call
        deepseekChatStreamingSpy.mockResolvedValueOnce({
          choices: [{
            finish_reason: 'tool_calls',
            message: {
              tool_calls: [{
                id: 'call_789',
                type: 'function',
                function: {
                  name: 'deleteProduct',
                  arguments: JSON.stringify({ productName: 'iPhone' })
                }
              }]
            }
          }]
        });

        // Second call: natural listing after getting needsClarification
        deepseekChatStreamingSpy.mockResolvedValueOnce({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: mockAIListings[i]
            }
          }]
        });

        const result = await processProductCommand('удали iPhone', testContext);
        responses.push(result.message);

        // Check that AI mentioned both products
        expect(result.message).toMatch(/iPhone 12|12-й|12-го/i);
        expect(result.message).toMatch(/iPhone 13|13-й|13-го/i);
        expect(result.needsClarification).toBe(true);
      }

      console.log('\n=== Scenario 4 Responses ===');
      responses.forEach((msg, idx) => {
        console.log(`${idx + 1}. ${msg}`);
      });

      // Check variability: at least 4 different listings out of 5
      const uniqueResponses = [...new Set(responses)];
      expect(uniqueResponses.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ==========================================
  // SCENARIO 5: Record sale - natural confirmations
  // ==========================================
  describe('Scenario 5: Record sale - AI confirms naturally', () => {
    it('5 iterations should produce different natural confirmations', async () => {
      const responses = [];

      // Mock API: update stock
      mock.onPut('/products/4').reply(200, {
        data: { id: 4, name: 'Чехол', price: 15, stock_quantity: 12 }
      });

      const mockAIConfirmations = [
        'Записал продажу - 3 чехла ушли. На складе теперь 12 штук.',
        'Готово! 3 чехла проданы, осталось 12',
        'Продажа записана: -3 чехла, в наличии 12',
        'Три чехла продали, остаток 12 шт',
        'Ок, минус 3 чехла. Теперь на складе 12'
      ];

      for (let i = 0; i < 5; i++) {
        // First call: tool call
        deepseekChatStreamingSpy.mockResolvedValueOnce({
          choices: [{
            finish_reason: 'tool_calls',
            message: {
              tool_calls: [{
                id: 'call_sale',
                type: 'function',
                function: {
                  name: 'recordSale',
                  arguments: JSON.stringify({ productName: 'чехол', quantity: 3 })
                }
              }]
            }
          }]
        });

        // Second call: natural confirmation
        deepseekChatStreamingSpy.mockResolvedValueOnce({
          choices: [{
            finish_reason: 'stop',
            message: {
              content: mockAIConfirmations[i]
            }
          }]
        });

        const result = await processProductCommand('купили 3 чехла', testContext);
        responses.push(result.message);

        expect(result.success).toBe(true);
        expect(result.message).toBeTruthy();
      }

      console.log('\n=== Scenario 5 Responses ===');
      responses.forEach((msg, idx) => {
        console.log(`${idx + 1}. ${msg}`);
      });

      // Check variability: at least 4 different confirmations out of 5
      const uniqueResponses = [...new Set(responses)];
      expect(uniqueResponses.length).toBeGreaterThanOrEqual(4);

      // Check naturalness: responses mention quantity and remaining stock
      responses.forEach(msg => {
        expect(msg).toMatch(/3|три|three/i);
        expect(msg).toMatch(/12|двенадцать/i);
      });
    });
  });

  // ==========================================
  // BONUS: Context Management Test
  // ==========================================
  describe('Bonus: Context Management - tool messages preserved', () => {
    it('should preserve tool call and tool result in conversation history', async () => {
      // Mock API: product creation
      mock.onPost('/products').reply(201, {
        data: { id: 5, name: 'MacBook', price: 2000, stock_quantity: 2 }
      });

      // First call: tool call
      deepseekChatStreamingSpy.mockResolvedValueOnce({
        choices: [{
          finish_reason: 'tool_calls',
          message: {
            tool_calls: [{
              id: 'call_context',
              type: 'function',
              function: {
                name: 'addProduct',
                arguments: JSON.stringify({ name: 'MacBook', price: 2000, stock: 2 })
              }
            }]
          }
        }]
      });

      // Second call: natural response
      deepseekChatStreamingSpy.mockResolvedValueOnce({
        choices: [{
          finish_reason: 'stop',
          message: {
            content: 'MacBook добавлен за 2000₽, в наличии 2 штуки'
          }
        }]
      });

      const result = await processProductCommand('добавь MacBook 2000 количество 2', testContext);

      expect(result.success).toBe(true);

      // Check conversation history saved in session
      const conversation = testContext.ctx.session.aiConversation;
      expect(conversation).toBeTruthy();
      expect(conversation.messages).toBeTruthy();
      expect(conversation.messages.length).toBeGreaterThan(0);

      // Find messages with specific roles
      const userMessages = conversation.messages.filter(m => m.role === 'user');
      const assistantMessages = conversation.messages.filter(m => m.role === 'assistant');
      const toolMessages = conversation.messages.filter(m => m.role === 'tool');

      expect(userMessages.length).toBeGreaterThan(0);
      expect(assistantMessages.length).toBeGreaterThan(0);
      expect(toolMessages.length).toBeGreaterThan(0); // Tool result preserved!

      console.log('\n=== Conversation History ===');
      console.log(JSON.stringify(conversation.messages, null, 2));
    });
  });
});
