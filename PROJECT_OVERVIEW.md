# Status Stock 4.0 - Project Overview

> Краткое описание проекта для Claude промптера

---

## Что это?

**Telegram E-Commerce платформа** для цифровых магазинов с криптовалютными платежами (BTC, ETH, USDT).

**Структура:**
- `backend/` - Express.js API + PostgreSQL
- `bot/` - Telegram Bot (Telegraf.js)
- `webapp/` - React Mini App (Telegram WebApp)

---

## Стек технологий

### Backend
- Express.js 4.x + PostgreSQL 14+ (**БЕЗ ORM - чистый SQL**)
- JWT auth + X-Telegram-Init-Data validation
- Socket.io для real-time updates
- Winston logging (daily rotation)

### Bot
- Telegraf.js 4.x
- Memory-based sessions
- Scenes для multi-step flows
- Прямые SQL запросы к PostgreSQL

### WebApp
- React 18 + Vite 5.4
- **Zustand** (state management, NO Redux)
- **БЕЗ React Router** - state-based navigation через `activeTab`
- TailwindCSS 3.x + Framer Motion 11.x
- Axios + custom useApi hook (timeout 15s)
- Telegram WebApp SDK (@twa-dev/sdk)

---

## Основные функции

### 1. Для покупателей
- Просмотр магазинов и товаров
- Подписка на магазины → уведомления о новых товарах
- Покупка через криптовалюту (BTC/ETH/USDT)
- Предзаказ товаров (preorder)
- Корзина и checkout

### 2. Для продавцов
- Создание магазина (привязан к Telegram каналу)
- Управление товарами (CRUD через Bot или WebApp)
- Настройка криптокошельков (HD wallet derivation)
- Статистика продаж
- PRO подписка → доп. функции
- Миграция канала (при блокировке)
- Подписки на других продавцов (follows)

### 3. Payment Flow
```
Добавить товар → Корзина → Checkout → Выбор крипты →
→ Генерация invoice → QR code + адрес + сумма →
→ Отправка крипты → Ввод tx_hash → Верификация → Success
```

---

## Ключевые особенности архитектуры

### 1. БД (PostgreSQL)
Основные таблицы:
- `users` - пользователи Telegram
- `shops` - магазины (channel_url, tier: 'FREE'/'PRO')
- `products` - товары (price, stock_quantity, availability: 'stock'/'preorder')
- `orders` - заказы (status: 'pending'/'paid'/'completed')
- `wallets` - криптокошельки (BTC/ETH/USDT, HD derivation)
- `subscriptions` - подписки пользователей на магазины
- `shop_follows` - подписки продавцов друг на друга

**Все запросы - чистый SQL через `pg` pool, НЕТ ORM!**

### 2. Zustand Store (WebApp)
Главный state:
```javascript
{
  // Cart - КРИТИЧНО: каждый item ДОЛЖЕН иметь shopId!
  cart: [{ ...product, quantity, shopId }],
  
  // Payment Flow
  paymentStep: 'idle' | 'method' | 'details' | 'hash' | 'success',
  currentOrder: {...},
  selectedCrypto: 'BTC'|'ETH'|'USDT',
  isGeneratingInvoice: boolean,  // показывает loading overlay
  
  // Navigation (NO React Router!)
  activeTab: 'subscriptions'|'follows'|'catalog'|'settings',
  
  // Shop & Products
  currentShop: {...},
  products: [...],
  productsShopId: number  // ID магазина для products
}
```

**Важно:**
- Все loading states (`isGeneratingInvoice`, `isCreatingOrder`) сбрасываются в `finally` блоках
- `shopId` обязателен при `addToCart` - fallback: `currentShop?.id || product.shop_id || product.shopId || productsShopId`
- Timeout 15s на всех async операциях через `AbortController`

### 3. Payment Flow (детально)
1. **Checkout:** проверка `cart[0].shopId` → установка `currentShop` + `paymentStep='method'`
2. **Select Crypto:** загрузка wallets магазина → показ кнопок BTC/ETH/USDT
3. **Generate Invoice:** `createOrder()` + `POST /orders/:id/invoice` → получение {address, cryptoAmount, expiresAt}
4. **Payment Details:** QR code + wallet address + сумма
5. **Submit Hash:** пользователь вводит tx_hash → `POST /payments/verify`
6. **Verify:** backend проверяет транзакцию через Blockchain API (Etherscan/BlockCypher/TronGrid)
7. **Success:** order.status = 'paid' → уведомление продавцу

**Критичные моменты:**
- ⚠️ `createOrder` требует header `X-Telegram-Init-Data` для auth
- ⚠️ Все API запросы имеют timeout 15s
- ⚠️ Loading states ВСЕГДА сбрасываются в `finally`
- ⚠️ Error Boundary защищает весь payment flow

### 4. WebApp Navigation
**БЕЗ React Router!** State-based:
```javascript
// App.jsx
const renderPage = () => {
  if (followDetailId) return <FollowDetail />;
  switch (activeTab) {
    case 'subscriptions': return <Subscriptions />;
    case 'follows': return <Follows />;
    case 'catalog': return <Catalog />;
    case 'settings': return <Settings />;
  }
};
```

Переключение: `setActiveTab('catalog')`

---

## Типичные проблемы и решения

### ❌ "Вечный спиннер" при оплате
**Причина:** `setLoading(false)` не вызывается в `finally`
**Решение:** Всегда оборачивать async функции:
```javascript
try {
  setLoading(true);
  await api.call();
} catch (err) {
  // error handling
} finally {
  setLoading(false);  // ← ОБЯЗАТЕЛЬНО!
}
```

### ❌ "shopId missing" в cart
**Причина:** товар добавляется без shopId
**Решение:** Множественные fallback в `addToCart`:
```javascript
const shopId = currentShop?.id || product.shop_id || product.shopId || productsShopId;
if (!shopId) {
  toast.error('Ошибка: товар без магазина');
  return;
}
```

### ❌ Модалка не открывается
**Причина:** неправильный `paymentStep` state
**Решение:** проверить что `startCheckout()` устанавливает `paymentStep='method'`

### ❌ Timeout / зависание запросов
**Причина:** нет timeout на API запросах
**Решение:** использовать `AbortController`:
```javascript
const controller = new AbortController();
setTimeout(() => controller.abort(), 15000);
await api.get(url, { signal: controller.signal });
```

---

## Development

### Запуск:
```bash
# Backend
cd backend && npm run dev  # :3000

# Bot
cd bot && npm start

# WebApp
cd webapp && npm run dev  # :5173

# ngrok (ОБЯЗАТЕЛЕН для Mini App!)
ngrok http 3000
```

### Build:
```bash
cd webapp && npm run build  # → dist/
```

### Тесты:
```bash
npm test                    # все
npm run test:unit           # unit
npm run test:integration    # integration (требует running backend)
```

---

## Design System (WebApp)

**Colors:**
- Orange: `#FF6B00` (primary)
- Dark: `#0A0A0A` (background)

**Components:**
- **Glassmorphism:** `glass-card`, `glass-elevated`
- **Buttons:** gradient orange, rounded-xl, 44px min-height
- **Modals:** Bottom sheets с backdrop blur
- **Animations:** Framer Motion spring physics

**Patterns:**
- Loading: Skeleton loaders + spinner overlays
- Empty states: Icon + title + description + CTA
- Errors: Toast notifications (3-4s duration)

---

## API Endpoints (основные)

### Auth
- `POST /api/auth/telegram` - валидация initData → JWT

### Shops
- `GET /api/shops` - все магазины
- `GET /api/shops/my` - мои магазины (продавец)
- `GET /api/shops/:id/wallets` - криптокошельки

### Products
- `GET /api/products?shopId=X` - товары магазина

### Orders
- `POST /api/orders` - создать заказ
- `POST /api/orders/:id/invoice` - сгенерировать invoice

### Payments
- `POST /api/payments/verify` - проверить платёж (tx_hash)

---

## Real-time (Socket.io)

События:
- `product:updated` - товар изменён
- `order:status` - статус заказа изменён
- `shop:subscriber_count` - кол-во подписчиков изменилось

---

## Best Practices

### ✅ Делай:
- Используй `finally` для сброса loading states
- Добавляй timeout 15s на все async операции
- Проверяй `shopId` при `addToCart`
- Показывай toast при ошибках
- Используй параметризованные SQL запросы: `pool.query('...WHERE id=$1', [id])`
- Используй Error Boundary для защиты от краша

### ❌ НЕ делай:
- ~~React Router~~ → используй state-based navigation
- ~~Redux~~ → используй Zustand
- ~~ORM~~ → используй чистый SQL
- ~~localStorage~~ → данные с сервера (только pendingOrders persist)
- ~~cat/grep/find в Bash~~ → используй MCP File System tools

---

## Важные файлы

- `CLAUDE.md` - инструкции для Claude Code
- `DEV_CHEATSHEET.md` - команды и shortcuts
- `.claude/skills/` - 14 автоматизированных рабочих процессов
- `backend/database/schema.sql` - полная схема БД

---

**Last Updated:** 2025-11-05  
**Version:** 4.0
