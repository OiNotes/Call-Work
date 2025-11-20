// MSW Handlers - собираем все API handlers в один массив
import { shopsHandlers } from './shops.js';
import { productsHandlers } from './products.js';
import { ordersHandlers } from './orders.js';
import { followsHandlers } from './follows.js';
import { settingsHandlers } from './settings.js';
import { analyticsHandlers } from './analytics.js';
import { subscriptionsHandlers } from './subscriptions.js';
import { authHandlers } from './auth.js';

// Экспортируем все handlers одним массивом
export const handlers = [
  ...shopsHandlers,
  ...productsHandlers,
  ...ordersHandlers,
  ...followsHandlers,
  ...settingsHandlers,
  ...analyticsHandlers,
  ...subscriptionsHandlers,
  ...authHandlers,
];

// Для удобства экспортируем и по отдельности
export {
  shopsHandlers,
  productsHandlers,
  ordersHandlers,
  followsHandlers,
  settingsHandlers,
  analyticsHandlers,
  subscriptionsHandlers,
  authHandlers,
};
