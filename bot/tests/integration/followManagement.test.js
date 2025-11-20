/**
 * Follow Management Integration Test
 *
 * Тестирует управление существующими подписками:
 * - Обновление markup
 * - Переключение режима Monitor ↔ Resell
 * - Просмотр деталей подписки
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import { createTestBot } from '../helpers/testBot.js';
import { callbackUpdate, textUpdate } from '../helpers/updateFactories.js';
import { api } from '../../src/utils/api.js';
import { mockShopValidation } from '../helpers/commonMocks.js';

describe('Follow Management - Update/Switch/Delete (P0)', () => {
  let testBot;
  let mock;

  beforeEach(() => {
    testBot = createTestBot({
      skipAuth: true,
      mockSession: {
        token: 'test-jwt-token',
        shopId: 1,
        shopName: 'MyShop',
        user: { id: 1, telegramId: '123456', selectedRole: 'seller' },
      },
    });
    mock = new MockAdapter(api);

    // Mock shop validation (required by validateShopBeforeScene middleware)
    mockShopValidation(mock, 1);
  });

  afterEach(() => {
    testBot.reset();
    mock.reset();
  });

  it('просмотр деталей follow → показать mode и markup', async () => {
    mock.onGet('/follows/my').reply(200, {
      data: [
        {
          id: 10,
          source_shop_id: 888,
          source_shop_name: 'SourceShop',
          target_shop_id: 1,
          mode: 'resell',
          markup_percentage: 25,
        },
      ],
    });

    // Mock GET /follows/10 for detail view
    mock.onGet('/follows/10').reply(200, {
      data: {
        id: 10,
        source_shop_id: 888,
        source_shop_name: 'SourceShop',
        target_shop_id: 1,
        mode: 'resell',
        markup_percentage: 25,
      },
    });

    // Mock GET /follows/10/products for catalog view
    mock.onGet('/follows/10/products').reply(200, {
      data: {
        mode: 'resell',
        products: [],
      },
    });

    await testBot.handleUpdate(callbackUpdate('follow_detail:10'));
    await new Promise((resolve) => setImmediate(resolve));

    expect(testBot.captor.wasAnswerCbQueryCalled()).toBe(true);

    const text = testBot.getLastReplyText();
    expect(text).toContain('Перепродажа');
    expect(text).toContain('SourceShop');
    expect(text).toContain('25%');

    // Verify keyboard has management buttons
    const keyboard = testBot.getLastReplyKeyboard();
    expect(keyboard).toBeTruthy();
  });

  it('переключение Monitor → Resell → запросить markup', async () => {
    // Current follow in monitor mode
    mock.onGet('/follows/my').reply(200, {
      data: [
        {
          id: 20,
          source_shop_id: 777,
          source_shop_name: 'MonitorShop',
          target_shop_id: 1,
          mode: 'monitor',
          markup_percentage: 0,
        },
      ],
    });

    // Mock GET /follows/20 - called twice: in handleSwitchMode + after PUT
    let getFollowCallCount = 0;
    mock.onGet('/follows/20').reply(() => {
      getFollowCallCount++;
      if (getFollowCallCount === 1) {
        // First call: in handleSwitchMode (before entering scene)
        return [
          200,
          {
            data: {
              id: 20,
              source_shop_id: 777,
              source_shop_name: 'MonitorShop',
              target_shop_id: 1,
              mode: 'monitor',
              markup_percentage: 0,
            },
          },
        ];
      } else {
        // Second call: after PUT in scene (updated to resell mode)
        return [
          200,
          {
            data: {
              id: 20,
              mode: 'resell',
              markup_percentage: 30,
              source_shop_id: 777,
              source_shop_name: 'MonitorShop',
              follower_shop_id: 1,
              status: 'active',
            },
          },
        ];
      }
    });

    // Clicking follow_mode:20 enters editFollowMarkup scene with pendingModeSwitch
    await testBot.handleUpdate(callbackUpdate('follow_mode:20'));
    await new Promise((resolve) => setImmediate(resolve));

    const text1 = testBot.getLastReplyText();
    expect(text1).toContain('наценку');
    expect(text1).toContain('500');

    testBot.captor.reset();

    // Mock PUT API for mode switch
    mock.onPut('/follows/20/mode').reply(200, {
      data: { id: 20, mode: 'resell', markup_percentage: 30 },
    });

    // Enter markup (triggers PUT /follows/20/mode with markup)
    await testBot.handleUpdate(textUpdate('30'));
    await new Promise((resolve) => setImmediate(resolve));

    const text2 = testBot.getLastReplyText();
    expect(text2).toContain('Режим: 💰 Перепродажа');

    // Verify PUT was called
    expect(mock.history.put.length).toBe(1);
    expect(mock.history.put[0].url).toBe('/follows/20/mode');
    const requestData = JSON.parse(mock.history.put[0].data);
    expect(requestData.mode).toBe('resell');
    expect(requestData.markupPercentage).toBe(30);
  });

  it('переключение Resell → Monitor → мгновенное изменение без markup', async () => {
    // Current follow in resell mode
    mock.onGet('/follows/my').reply(200, {
      data: [
        {
          id: 30,
          source_shop_id: 666,
          source_shop_name: 'ResellShop',
          target_shop_id: 1,
          mode: 'resell',
          markup_percentage: 50,
        },
      ],
    });

    // Mock GET /follows/30 - needs to return different data on 2nd call
    let getFollowCallCount = 0;
    mock.onGet('/follows/30').reply(() => {
      getFollowCallCount++;
      if (getFollowCallCount === 1) {
        // First call - before switch (resell mode)
        return [
          200,
          {
            data: {
              id: 30,
              source_shop_id: 666,
              source_shop_name: 'ResellShop',
              target_shop_id: 1,
              mode: 'resell',
              markup_percentage: 50,
            },
          },
        ];
      } else {
        // Second call - after switch (monitor mode)
        return [
          200,
          {
            data: {
              id: 30,
              source_shop_id: 666,
              source_shop_name: 'ResellShop',
              target_shop_id: 1,
              mode: 'monitor',
              markup_percentage: 0,
            },
          },
        ];
      }
    });

    mock.onPut('/follows/30/mode').reply(200, {
      data: { id: 30, mode: 'monitor', markup_percentage: 0 },
    });

    await testBot.handleUpdate(callbackUpdate('follow_mode:30'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    // After switching, shows follow detail with new mode
    expect(text).toContain('ResellShop');
    expect(text).toContain('Мониторинг');

    // Verify PUT was called with monitor mode
    expect(mock.history.put.length).toBe(1);
    expect(mock.history.put[0].url).toBe('/follows/30/mode');
    const requestData = JSON.parse(mock.history.put[0].data);
    expect(requestData.mode).toBe('monitor');
  });

  it('обновление markup через editFollowMarkup scene → пересчёт цен', async () => {
    // Mock GET /follows/40 - called once after update to fetch updated data
    mock.onGet('/follows/40').reply(200, {
      data: {
        id: 40,
        mode: 'resell',
        markup_percentage: 15,
        source_shop_id: 777,
        source_shop_name: 'ResellShop2',
        follower_shop_id: 1,
        status: 'active',
      },
    });

    // Trigger edit markup (enters scene)
    await testBot.handleUpdate(callbackUpdate('follow_edit:40'));
    await new Promise((resolve) => setImmediate(resolve));

    testBot.captor.reset();

    // Mock API calls for markup update
    mock.onPut('/follows/40/markup').reply(200, {
      data: { id: 40, markup_percentage: 15 },
    });

    await testBot.handleUpdate(textUpdate('15'));
    await new Promise((resolve) => setImmediate(resolve));

    // Should show success message with detail
    const text = testBot.getLastReplyText();
    expect(text).toContain('Наценка: 15%');

    // Verify PUT was called
    expect(mock.history.put.length).toBe(1);
    expect(mock.history.put[0].url).toBe('/follows/40/markup');
    const requestData = JSON.parse(mock.history.put[0].data);
    expect(requestData.markupPercentage).toBe(15);
  });

  it('невалидный markup при обновлении (0%) → ошибка', async () => {
    // Mock GET /follows/50 for entering scene (only needs one call for validation error)
    mock.onGet('/follows/50').reply(200, {
      data: {
        id: 50,
        mode: 'resell',
        markup_percentage: 20,
        source_shop_id: 888,
        source_shop_name: 'TestShop',
        follower_shop_id: 1,
        status: 'active',
      },
    });

    // Enter scene
    await testBot.handleUpdate(callbackUpdate('follow_edit:50'));
    await new Promise((resolve) => setImmediate(resolve));
    
    // Verify we got the markup prompt
    const promptText = testBot.getLastReplyText();
    expect(promptText).toContain('наценку');
    
    testBot.captor.reset();

    // Send invalid markup
    await testBot.handleUpdate(textUpdate('0'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Наценка должна быть в диапазоне от 1 до 500%');

    // Verify PUT was NOT called
    expect(mock.history.put.length).toBe(0);
  });

  it('невалидный markup при обновлении (501%) → ошибка', async () => {
    // Mock GET /follows/60 for entering scene (only needs one call for validation error)
    mock.onGet('/follows/60').reply(200, {
      data: {
        id: 60,
        mode: 'resell',
        markup_percentage: 20,
        source_shop_id: 888,
        source_shop_name: 'TestShop',
        follower_shop_id: 1,
        status: 'active',
      },
    });

    // Enter scene
    await testBot.handleUpdate(callbackUpdate('follow_edit:60'));
    await new Promise((resolve) => setImmediate(resolve));
    
    // Verify we got the markup prompt
    const promptText = testBot.getLastReplyText();
    expect(promptText).toContain('наценку');
    
    testBot.captor.reset();

    // Send invalid markup
    await testBot.handleUpdate(textUpdate('501'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Наценка должна быть в диапазоне от 1 до 500%');

    expect(mock.history.put.length).toBe(0);
  });

  it('удаление подписки → показать подтверждение → вернуться к списку', async () => {
    mock.onDelete('/follows/70').reply(200, { success: true });
    mock.onGet('/follows/my').reply(200, { data: [] }); // Empty after delete

    await testBot.handleUpdate(callbackUpdate('follow_delete:70'));
    await new Promise((resolve) => setImmediate(resolve));

    // After delete, returns to empty follow list
    const text = testBot.getLastReplyText();
    expect(text).toContain('👀 Следить');
    expect(text).toContain('У вас пока нет активных подписок');

    // Verify DELETE was called
    expect(mock.history.delete.length).toBe(1);
    expect(mock.history.delete[0].url).toBe('/follows/70');
  });

  it('просмотр детали несуществующей подписки → ошибка', async () => {
    mock.onGet('/follows/my').reply(200, {
      data: [], // Empty list
    });

    await testBot.handleUpdate(callbackUpdate('follow_detail:999'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Подписка не найдена');
  });

  it('API error при переключении режима (500) → показать ошибку', async () => {
    mock.onGet('/follows/my').reply(200, {
      data: [
        {
          id: 80,
          source_shop_id: 555,
          source_shop_name: 'TestShop',
          target_shop_id: 1,
          mode: 'monitor',
          markup_percentage: 0,
        },
      ],
    });

    // Mock GET /follows/80 - called in handleSwitchMode before entering scene
    mock.onGet('/follows/80').reply(200, {
      data: {
        id: 80,
        source_shop_id: 555,
        source_shop_name: 'TestShop',
        target_shop_id: 1,
        mode: 'monitor',
        markup_percentage: 0,
      },
    });

    // Clicking follow_mode:80 enters scene and asks for markup
    await testBot.handleUpdate(callbackUpdate('follow_mode:80'));
    await new Promise((resolve) => setImmediate(resolve));
    
    // Verify we got the markup prompt
    const promptText = testBot.getLastReplyText();
    expect(promptText).toContain('наценку');

    testBot.captor.reset();

    // Mock API error when submitting markup
    mock.onPut('/follows/80/mode').reply(500, {
      error: 'Internal server error',
    });

    await testBot.handleUpdate(textUpdate('20'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    // Error message from editFollowMarkup scene: followMessages.switchError = "Не удалось изменить режим"
    expect(text).toContain('изменить режим');

    expect(mock.history.put.length).toBeGreaterThanOrEqual(1);
  });

  it('API error при удалении (500) → показать ошибку', async () => {
    mock.onDelete('/follows/90').reply(500, {
      error: 'Cannot delete follow',
    });

    await testBot.handleUpdate(callbackUpdate('follow_delete:90'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Не удалось удалить подписку');

    // Verify DELETE was called (multiple times due to error handler retries)
    expect(mock.history.delete.length).toBeGreaterThanOrEqual(1);
  });

  it('просмотр списка → клик на follow → детали → назад → список снова', async () => {
    const mockFollows = [
      {
        id: 100,
        source_shop_id: 444,
        source_shop_name: 'Shop444',
        target_shop_id: 1,
        mode: 'resell',
        markup_percentage: 10,
      },
    ];

    // Step 1: View list
    mock.onGet('/follows/my').reply(200, { data: mockFollows });

    await testBot.handleUpdate(callbackUpdate('follows:list'));
    await new Promise((resolve) => setImmediate(resolve));

    const text1 = testBot.getLastReplyText();
    expect(text1).toContain('👀 Следить');
    expect(text1).toContain('Shop444');

    testBot.captor.reset();

    // Step 2: View detail
    // Mock GET /follows/100 for detail view
    mock.onGet('/follows/100').reply(200, {
      data: {
        id: 100,
        source_shop_id: 444,
        source_shop_name: 'Shop444',
        target_shop_id: 1,
        mode: 'resell',
        markup_percentage: 10,
      },
    });

    // Mock GET /follows/100/products for catalog view
    mock.onGet('/follows/100/products').reply(200, {
      data: {
        mode: 'resell',
        products: [],
      },
    });

    await testBot.handleUpdate(callbackUpdate('follow_detail:100'));
    await new Promise((resolve) => setImmediate(resolve));

    const text2 = testBot.getLastReplyText();
    expect(text2).toContain('Shop444');

    testBot.captor.reset();

    // Step 3: Go back to list
    await testBot.handleUpdate(callbackUpdate('follows:list'));
    await new Promise((resolve) => setImmediate(resolve));

    const text3 = testBot.getLastReplyText();
    expect(text3).toContain('👀 Следить');
  });

  it('без токена → ошибка авторизации при просмотре деталей', async () => {
    const noTokenBot = createTestBot({
      skipAuth: true,
      mockSession: {
        token: null,
        shopId: 1,
        shopName: 'MyShop',
        user: { id: 1, telegramId: '123456', selectedRole: 'seller' },
      },
    });

    await noTokenBot.handleUpdate(callbackUpdate('follow_detail:110'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = noTokenBot.getLastReplyText();
    expect(text).toContain('Требуется авторизация');

    expect(mock.history.get.length).toBe(0);

    noTokenBot.reset();
  });

  it('markup range: 1% → успех', async () => {
    // Mock GET /follows/120 - called once after update to fetch updated data
    mock.onGet('/follows/120').reply(200, {
      data: {
        id: 120,
        mode: 'resell',
        markup_percentage: 1,
        source_shop_id: 999,
        source_shop_name: 'TestShop',
        follower_shop_id: 1,
        status: 'active',
      },
    });

    // Enter scene
    await testBot.handleUpdate(callbackUpdate('follow_edit:120'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    // Mock PUT API
    mock.onPut('/follows/120/markup').reply(200, {
      data: { id: 120, markup_percentage: 1 },
    });

    await testBot.handleUpdate(textUpdate('1'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Наценка: 1%');

    const requestData = JSON.parse(mock.history.put[0].data);
    expect(requestData.markupPercentage).toBe(1);
  });

  it('markup range: 500% → успех', async () => {
    // Mock GET /follows/130 - called once after update to fetch updated data
    mock.onGet('/follows/130').reply(200, {
      data: {
        id: 130,
        mode: 'resell',
        markup_percentage: 500,
        source_shop_id: 888,
        source_shop_name: 'MaxMarkupShop',
        follower_shop_id: 1,
        status: 'active',
      },
    });

    // Enter scene
    await testBot.handleUpdate(callbackUpdate('follow_edit:130'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    // Mock PUT API
    mock.onPut('/follows/130/markup').reply(200, {
      data: { id: 130, markup_percentage: 500 },
    });

    await testBot.handleUpdate(textUpdate('500'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Наценка: 500%');

    const requestData = JSON.parse(mock.history.put[0].data);
    expect(requestData.markupPercentage).toBe(500);
  });
});
