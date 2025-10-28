/**
 * Create Shop Flow Integration Test
 *
 * Тестирует wizard создания магазина с валидацией
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import { createTestBot } from '../helpers/testBot.js';
import { callbackUpdate, textUpdate } from '../helpers/updateFactories.js';
import { api } from '../../src/utils/api.js';

describe('Create Shop Flow - Wizard Validation (P0)', () => {
  let testBot;
  let mock;

  beforeEach(() => {
    testBot = createTestBot({
      skipAuth: true,
      mockSession: {
        token: 'test-jwt-token',
        user: { id: 1, telegramId: '123456', selectedRole: 'seller' }
      }
    });
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    testBot.reset();
    mock.reset();
  });

  it('создание магазина: короткое имя → ошибка, валидное имя → успех', async () => {
    // Step 1: Enter chooseTier scene (via seller:create_shop callback)
    await testBot.handleUpdate(callbackUpdate('seller:create_shop'));

    // Проверяем что answerCbQuery был вызван
    expect(testBot.captor.wasAnswerCbQueryCalled()).toBe(true);

    // Проверяем что показали выбор тарифа
    const text0 = testBot.getLastReplyText();
    expect(text0).toContain('Выберите тариф');

    testBot.captor.reset();

    // Step 2: Select BASIC tier → transition to createShop
    await testBot.handleUpdate(callbackUpdate('tier_select:basic'));

    // Проверяем что показали приглашение ввести имя магазина
    const text1 = testBot.getLastReplyText();
    expect(text1).toContain('название магазина');

    testBot.captor.reset();

    // Step 3: Enter short name (less than 3 chars) → validation error
    await testBot.handleUpdate(textUpdate('ab'));

    const text2 = testBot.getLastReplyText();
    expect(text2).toContain('Название должно быть от 3 до 100 символов');

    // Проверяем что session.shopId НЕ установлен
    const session1 = testBot.getSession();
    expect(session1.shopId).toBeUndefined();

    testBot.captor.reset();

    // Step 4: Enter valid name → success
    const shopName = 'MyTestShop';
    mock.onPost('/shops').reply(201, {
      data: {
        id: 1,
        name: shopName,
        description: `Магазин ${shopName}`,
        sellerId: 1
      }
    });

    await testBot.handleUpdate(textUpdate(shopName));

    // Проверяем что показали сообщение о сохранении
    const replies = testBot.captor.getReplies();
    expect(replies.some(r => r.text && r.text.includes('Создаём магазин'))).toBe(true);

    // Проверяем что показали успех
    const text3 = testBot.getLastReplyText();
    expect(text3).toContain('готов');
    expect(text3).toContain(shopName);

    // Проверяем что session.shopId установлен
    const session2 = testBot.getSession();
    expect(session2.shopId).toBe(1);
    expect(session2.shopName).toBe(shopName);

    // Проверяем что API был вызван один раз
    expect(mock.history.post.length).toBe(1);
    expect(mock.history.post[0].url).toBe('/shops');
    const requestData = JSON.parse(mock.history.post[0].data);
    expect(requestData.name).toBe(shopName);
  });

  it('имя слишком длинное (>100 символов) → ошибка', async () => {
    // Enter chooseTier scene
    await testBot.handleUpdate(callbackUpdate('seller:create_shop'));
    testBot.captor.reset();

    // Select tier
    await testBot.handleUpdate(callbackUpdate('tier_select:basic'));
    testBot.captor.reset();

    // Enter too long name (101 characters)
    const longName = 'a'.repeat(101);
    await testBot.handleUpdate(textUpdate(longName));

    const text = testBot.getLastReplyText();
    expect(text).toContain('Название должно быть от 3 до 100 символов');

    // Проверяем что session.shopId НЕ установлен
    const session = testBot.getSession();
    expect(session.shopId).toBeUndefined();
  });

  it('имя с недопустимыми символами (пробелы, спецсимволы) → ошибка', async () => {
    // Enter chooseTier scene
    await testBot.handleUpdate(callbackUpdate('seller:create_shop'));
    testBot.captor.reset();

    // Select tier
    await testBot.handleUpdate(callbackUpdate('tier_select:basic'));
    testBot.captor.reset();

    // Test with spaces
    await testBot.handleUpdate(textUpdate('My Shop'));
    let text = testBot.getLastReplyText();
    expect(text).toContain('Название может содержать буквы, цифры и подчёркивание');

    testBot.captor.reset();

    // Test with special characters
    await testBot.handleUpdate(textUpdate('shop@2024'));
    text = testBot.getLastReplyText();
    expect(text).toContain('Название может содержать буквы, цифры и подчёркивание');

    // Проверяем что session.shopId НЕ установлен
    const session = testBot.getSession();
    expect(session.shopId).toBeUndefined();
  });

  it('имя уже занято (backend error) → показать ошибку и остаться в scene', async () => {
    // Enter chooseTier scene
    await testBot.handleUpdate(callbackUpdate('seller:create_shop'));
    testBot.captor.reset();

    // Select tier
    await testBot.handleUpdate(callbackUpdate('tier_select:basic'));
    testBot.captor.reset();

    // Mock API to return "already taken" error
    const shopName = 'ExistingShop';
    mock.onPost('/shops').reply(409, {
      error: 'Shop name already taken'
    });

    await testBot.handleUpdate(textUpdate(shopName));

    // Проверяем что показали ошибку "Имя уже занято"
    const text = testBot.getLastReplyText();
    expect(text).toContain('уже занято');

    // Проверяем что session.shopId НЕ установлен
    const session = testBot.getSession();
    expect(session.shopId).toBeUndefined();

    // Проверяем что API был вызван один раз
    expect(mock.history.post.length).toBe(1);

    // User can try again (scene should NOT leave)
    testBot.captor.reset();
    mock.reset();

    // Try with different name
    const newName = 'MyUniqueShop';
    mock.onPost('/shops').reply(201, {
      data: {
        id: 1,
        name: newName,
        description: `Магазин ${newName}`,
        sellerId: 1
      }
    });

    await testBot.handleUpdate(textUpdate(newName));

    // Should succeed now
    const text2 = testBot.getLastReplyText();
    expect(text2).toContain('готов');
    expect(text2).toContain(newName);

    const session2 = testBot.getSession();
    expect(session2.shopId).toBe(1);
  });

  it('создание магазина без токена → ошибка', async () => {
    // Create new testBot with no token
    const noTokenBot = createTestBot({
      skipAuth: true,
      mockSession: {
        token: null, // No token
        user: { id: 1, telegramId: '123456', selectedRole: 'seller' }
      }
    });

    // Enter chooseTier scene
    await noTokenBot.handleUpdate(callbackUpdate('seller:create_shop'));
    noTokenBot.captor.reset();

    // Select tier
    await noTokenBot.handleUpdate(callbackUpdate('tier_select:basic'));
    noTokenBot.captor.reset();

    // Try to create shop
    await noTokenBot.handleUpdate(textUpdate('MyShop'));

    // Проверяем что показали ошибку авторизации
    const text = noTokenBot.getLastReplyText();
    expect(text).toContain('Требуется авторизация');

    // Проверяем что session.shopId НЕ установлен
    const session = noTokenBot.getSession();
    expect(session.shopId).toBeUndefined();

    // Проверяем что API НЕ был вызван
    expect(mock.history.post.length).toBe(0);

    noTokenBot.reset();
  });

  it('повторное подтверждение → НЕ дублирует POST запрос', async () => {
    // Enter chooseTier scene
    await testBot.handleUpdate(callbackUpdate('seller:create_shop'));
    testBot.captor.reset();

    // Select tier
    await testBot.handleUpdate(callbackUpdate('tier_select:basic'));
    testBot.captor.reset();

    // Create shop
    const shopName = 'UniqueShop';
    mock.onPost('/shops').reply(201, {
      data: { id: 1, name: shopName, description: `Магазин ${shopName}`, sellerId: 1 }
    });

    await testBot.handleUpdate(textUpdate(shopName));

    // Проверяем что API был вызван один раз
    expect(mock.history.post.length).toBe(1);

    // Wizard уже завершён и вышел из scene
    // Повторная попытка создать магазин НЕ должна быть возможна
    // (пользователь вышел из scene после успешного создания)
    testBot.captor.reset();

    // Попытка отправить ещё одно имя (но scene уже завершён)
    await testBot.handleUpdate(textUpdate('AnotherShop'));

    // Проверяем что API НЕ был вызван повторно
    expect(mock.history.post.length).toBe(1); // Всё ещё 1
  });
});
