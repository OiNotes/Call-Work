/**
 * /start Flow Integration Test
 *
 * Тестирует memory роли: повторный /start должен сразу показывать ЛК
 * БЕЗ повторного вопроса о роли (P0 priority)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import { createTestBot } from '../helpers/testBot.js';
import { commandUpdate } from '../helpers/updateFactories.js';
import { api } from '../../src/utils/api.js';

describe('/start Flow - Role Memory (P0)', () => {
  let testBot;
  let mock;

  beforeEach(() => {
    testBot = createTestBot({ skipAuth: false });
    mock = new MockAdapter(api);
  });

  afterEach(() => {
    testBot.reset();
    mock.reset();
  });

  it('первый /start без роли → показать "Выберите роль"', async () => {
    // Mock auth API (первый вход, нет selectedRole)
    mock.onPost('/auth/register').reply(200, {
      data: {
        token: 'test-jwt-token',
        user: {
          id: 1,
          telegramId: '123456',
          username: 'testuser',
          selectedRole: null, // Нет сохранённой роли
        },
      },
    });

    // Mock shop APIs - no shop, no workspace
    mock.onGet('/shops/my').reply(404, { error: 'Shop not found' });
    mock.onGet('/shops/workspace').reply(404, { error: 'No workspace access' });

    // Отправляем /start
    await testBot.handleUpdate(commandUpdate('start'));

    // Проверяем что показали выбор роли (новый welcome message)
    const lastText = testBot.getLastReplyText();
    expect(lastText).toContain('Status Stock');
  });

  it('пользователь с магазином → автоматически seller ЛК (приоритет 1)', async () => {
    // Mock auth API
    mock.onPost('/auth/register').reply(200, {
      data: {
        token: 'test-jwt-token',
        user: {
          id: 1,
          telegramId: '123456',
          username: 'testuser',
          selectedRole: null,
        },
      },
    });

    // Mock: user has shop
    mock.onGet('/shops/my').reply(200, {
      data: [{ id: 1, name: 'MyShop', sellerId: 1 }],
    });

    // Mock: update role to seller
    mock.onPut('/auth/role').reply(200, { data: { selectedRole: 'seller' } });

    await testBot.handleUpdate(commandUpdate('start'));

    // Проверяем что показали seller меню БЕЗ вопроса о роли
    const lastText = testBot.getLastReplyText();
    expect(lastText).not.toContain('Выберите роль');
    expect(lastText).toContain('Магазин'); // seller menu
  });

  it('пользователь без магазина + buyer роль → buyer ЛК (приоритет 2)', async () => {
    // Mock auth API с сохраненной buyer ролью
    mock.onPost('/auth/register').reply(200, {
      data: {
        token: 'test-jwt-token',
        user: {
          id: 1,
          telegramId: '123456',
          username: 'testuser',
          selectedRole: 'buyer', // Saved buyer role
        },
      },
    });

    // Mock: no shop
    mock.onGet('/shops/my').reply(404, { error: 'Shop not found' });

    await testBot.handleUpdate(commandUpdate('start'));

    // Проверяем что показали buyer меню БЕЗ вопроса о роли
    const lastText = testBot.getLastReplyText();
    expect(lastText).not.toContain('Выберите роль');
    expect(lastText).toContain('Панель покупателя'); // buyer menu
  });

  it('пользователь с магазином перекрывает buyer роль в БД → seller (приоритет 1)', async () => {
    // Mock auth API с buyer ролью, но есть магазин
    mock.onPost('/auth/register').reply(200, {
      data: {
        token: 'test-jwt-token',
        user: {
          id: 1,
          telegramId: '123456',
          username: 'testuser',
          selectedRole: 'buyer', // User had buyer role
        },
      },
    });

    // Mock: user has shop (overrides buyer role)
    mock.onGet('/shops/my').reply(200, {
      data: [{ id: 1, name: 'MyShop', sellerId: 1 }],
    });

    // Mock: update role to seller
    mock.onPut('/auth/role').reply(200, { data: { selectedRole: 'seller' } });

    await testBot.handleUpdate(commandUpdate('start'));

    // Проверяем что показали seller меню (shop has priority)
    const lastText = testBot.getLastReplyText();
    expect(lastText).not.toContain('Выберите роль');
    expect(lastText).toContain('Магазин'); // seller menu
  });
});
