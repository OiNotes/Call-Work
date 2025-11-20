/**
 * Create Follow Scene Integration Test
 *
 * Тестирует wizard создания подписки с валидацией входных данных
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import { createTestBot } from '../helpers/testBot.js';
import { callbackUpdate, textUpdate } from '../helpers/updateFactories.js';
import { api } from '../../src/utils/api.js';
import {
  mockShopValidation,
  mockFollowLimit,
  mockValidateCircular,
} from '../helpers/commonMocks.js';

describe('Create Follow Scene - Wizard Validation (P0)', () => {
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

    // Mock follow limit check (called by createFollow scene on entry)
    mockFollowLimit(mock);

    // Mock circular validation (called by createFollow scene before creating follow)
    mockValidateCircular(mock);
  });

  afterEach(() => {
    testBot.reset();
    mock.reset();
  });

  it('невалидный shopId (не число) → ошибка', async () => {
    await testBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    // Enter non-numeric shop ID
    await testBot.handleUpdate(textUpdate('abc'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    // FIX BUG #4: Updated error message
    expect(text).toContain('Нужен числовой ID');

    // Verify API was NOT called (except shop validation and follow limit check)
    // mock.history.get includes:
    // - 1 call to GET /shops/1 from validateShopBeforeScene
    // - 1 call to GET /follows/check-limit from createFollow scene entry
    const nonExpectedGets = mock.history.get.filter(
      (r) => !r.url.startsWith('/shops/') && !r.url.includes('/follows/check-limit')
    );
    expect(nonExpectedGets.length).toBe(0);
  });

  it('невалидный shopId (отрицательное число) → ошибка', async () => {
    await testBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    await testBot.handleUpdate(textUpdate('-5'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    // FIX BUG #4: Updated error message
    expect(text).toContain('Нужен числовой ID');
  });

  it('markup < 1% → ошибка валидации', async () => {
    // Enter scene and shop ID
    await testBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    mock.onGet('/shops/555').reply(200, {
      data: { id: 555, name: 'TestShop', sellerId: 2 },
    });

    await testBot.handleUpdate(textUpdate('555'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    // Select Resell mode
    await testBot.handleUpdate(callbackUpdate('mode:resell'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    // Enter markup < 1
    await testBot.handleUpdate(textUpdate('0'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Наценка должна быть в диапазоне от 1 до 500%');

    // Verify POST to /follows was NOT called
    // Note: validateCircular POST may have been called (1 call)
    const followPosts = mock.history.post.filter((r) => r.url === '/follows');
    expect(followPosts.length).toBe(0);
  });

  it('markup > 500% → ошибка валидации', async () => {
    await testBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    mock.onGet('/shops/444').reply(200, {
      data: { id: 444, name: 'Shop444', sellerId: 3 },
    });

    await testBot.handleUpdate(textUpdate('444'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    await testBot.handleUpdate(callbackUpdate('mode:resell'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    // Enter markup > 500
    await testBot.handleUpdate(textUpdate('501'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Наценка должна быть в диапазоне от 1 до 500%');

    // Verify POST to /follows was NOT called
    // Note: validateCircular POST may have been called (1 call)
    const followPosts = mock.history.post.filter((r) => r.url === '/follows');
    expect(followPosts.length).toBe(0);
  });

  it('markup не число → ошибка валидации', async () => {
    await testBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    mock.onGet('/shops/333').reply(200, {
      data: { id: 333, name: 'Shop333', sellerId: 4 },
    });

    await testBot.handleUpdate(textUpdate('333'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    await testBot.handleUpdate(callbackUpdate('mode:resell'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    // Enter non-numeric markup
    await testBot.handleUpdate(textUpdate('twenty'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Наценка должна быть в диапазоне от 1 до 500%');
  });

  it('валидный markup (краевой случай 1%) → успех', async () => {
    await testBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    mock.onGet('/shops/222').reply(200, {
      data: { id: 222, name: 'Shop222', sellerId: 5 },
    });

    await testBot.handleUpdate(textUpdate('222'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    await testBot.handleUpdate(callbackUpdate('mode:resell'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    mock.onPost('/follows').reply(201, {
      data: { id: 3, source_shop_id: 222, target_shop_id: 1, mode: 'resell', markup_percentage: 1 },
    });

    await testBot.handleUpdate(textUpdate('1'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('✅');

    // Check only /follows POST (validateCircular POST also happens)
    const followPosts = mock.history.post.filter((r) => r.url === '/follows');
    expect(followPosts.length).toBe(1);
    const requestData = JSON.parse(followPosts[0].data);
    expect(requestData.markupPercentage).toBe(1);
  });

  it('валидный markup (краевой случай 500%) → успех', async () => {
    await testBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    mock.onGet('/shops/111').reply(200, {
      data: { id: 111, name: 'Shop111', sellerId: 6 },
    });

    await testBot.handleUpdate(textUpdate('111'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    await testBot.handleUpdate(callbackUpdate('mode:resell'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    mock.onPost('/follows').reply(201, {
      data: {
        id: 4,
        source_shop_id: 111,
        target_shop_id: 1,
        mode: 'resell',
        markup_percentage: 500,
      },
    });

    await testBot.handleUpdate(textUpdate('500'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('✅');

    // Check only /follows POST (ignore validation endpoints)
    const followPosts = mock.history.post.filter((r) => r.url === '/follows');
    expect(followPosts.length).toBe(1);
    const requestData = JSON.parse(followPosts[0].data);
    expect(requestData.markupPercentage).toBe(500);
  });

  it('отмена через кнопку Cancel → выход из scene', async () => {
    await testBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));

    const text1 = testBot.getLastReplyText();
    // FIX BUG #4: Updated prompt text
    expect(text1).toContain('ID магазина');

    testBot.captor.reset();

    // Click cancel button
    await testBot.handleUpdate(callbackUpdate('cancel_scene'));
    await new Promise((resolve) => setImmediate(resolve));

    const text2 = testBot.getLastReplyText();
    expect(text2).toContain('🔧 Инструменты'); // Cancel returns to seller tools menu

    // Verify no unexpected API calls
    expect(mock.history.post.length).toBe(0);
  });

  // Test removed: /cancel command is not implemented and should not exist
  // it('отмена через /cancel команду → выход из scene', async () => {});

  it('создание без токена → ошибка авторизации', async () => {
    const noTokenBot = createTestBot({
      skipAuth: true,
      mockSession: {
        token: null,
        shopId: 1,
        shopName: 'MyShop',
        user: { id: 1, telegramId: '123456', selectedRole: 'seller' },
      },
    });

    // Try to enter scene - validateShopBeforeScene will block and show error
    await noTokenBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));

    // Error message is shown immediately by validateShopBeforeScene
    const text = noTokenBot.getLastReplyText();
    expect(text).toContain('Требуется авторизация');

    // Scene entry was blocked, so no API calls should happen
    expect(mock.history.post.length).toBe(0);
    expect(mock.history.get.length).toBe(0); // No shop validation call either

    noTokenBot.reset();
  });

  it('создание без shopId в session → ошибка', async () => {
    const noShopBot = createTestBot({
      skipAuth: true,
      mockSession: {
        token: 'test-jwt-token',
        shopId: null, // No shop
        user: { id: 1, telegramId: '123456', selectedRole: 'seller' },
      },
    });

    await noShopBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = noShopBot.getLastReplyText();
    expect(text).toContain('Создайте магазин');

    // No API calls expected (no shop validation because shopId is null)
    expect(mock.history.get.length).toBe(0);

    noShopBot.reset();
  });

  it('Backend API error (500) → показать ошибку пользователю', async () => {
    await testBot.handleUpdate(callbackUpdate('follows:create'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    mock.onGet('/shops/777').reply(200, {
      data: { id: 777, name: 'Shop777', sellerId: 8 },
    });

    await testBot.handleUpdate(textUpdate('777'));
    await new Promise((resolve) => setImmediate(resolve));
    testBot.captor.reset();

    // Backend error on POST
    mock.onPost('/follows').reply(500, {
      error: 'Internal server error',
    });

    await testBot.handleUpdate(callbackUpdate('mode:monitor'));
    await new Promise((resolve) => setImmediate(resolve));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Не удалось оформить подписку');

    // Verify POST was attempted (may include validation endpoints)
    expect(mock.history.post.length).toBeGreaterThanOrEqual(1);
  });

  // Test removed: invalid test that checks impossible scenario
  // (scene is already finished after ctx.scene.leave(), subsequent callbacks
  // are handled by regular handlers, not wizard steps)
});
