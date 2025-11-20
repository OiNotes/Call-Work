# ПОЛНЫЙ АУДИТ СИСТЕМЫ КРИПТО-ПЛАТЕЖЕЙ - Status Stock 4.0

> **Дата:** 2025-01-13  
> **Версия:** 1.0  
> **Статус:** КРИТИЧЕСКИЕ ПРОБЛЕМЫ НАЙДЕНЫ - ТРЕБУЕТСЯ ПОЛНОЕ ПЕРЕПИСЫВАНИЕ

---

## 📋 EXECUTIVE SUMMARY

### Общая оценка: 5/10

**Что работает:**
- ✅ HD Wallet система (BIP44 derivation)
- ✅ Blockchain API интеграции (BlockCypher, Etherscan, TronGrid)
- ✅ Polling service как fallback для webhooks
- ✅ Payment tolerance (0.5% допустимое отклонение)
- ✅ Invoice expiration и cleanup

**Критические проблемы:**
- 🔴 **10 race conditions** в payment verification
- 🔴 **Дублирование таблиц БД** (payments vs invoices)
- 🔴 **Stock check ПОСЛЕ payment** → cancelled orders после оплаты
- 🔴 **Нет idempotency** в subscription payments
- 🔴 **Bot делает polling** вместо WebSocket
- 🔴 **WebApp не получает real-time updates** статуса

**Бизнес-риски:**
- Потеря денег пользователей (double-spend, expired invoices)
- Плохой UX (timeouts, зависшие платежи, отсутствие обратной связи)
- Уязвимости безопасности (API key утечка в логах, xpriv acceptance)

---

## 🏗️ ТЕКУЩАЯ АРХИТЕКТУРА

### 1. Backend Services (backend/src/services/)

| Сервис | Назначение | Проблемы |
|--------|-----------|----------|
| `crypto.js` | Universal TX verification (BTC/ETH/USDT/LTC) | ⚠️ Использует blockchain.info вместо BlockCypher |
| `blockCypherService.js` | BTC/LTC API + webhooks | 🔴 API key утечка в debug логах |
| `etherscanService.js` | ETH API (polling only) | ✅ Работает (USDT ERC-20 удалён) |
| `tronService.js` | USDT TRC-20 API (polling only) | ✅ Работает |
| `walletService.js` | HD wallet адреса (BIP44) | 🔴 Нет защиты от xpriv, неправильная валидация xpub |
| `subscriptionService.js` | Подписки магазинов | 🔴 Race conditions, нет idempotency |
| `subscriptionInvoiceService.js` | Генерация invoice | ⚠️ Синхронный (блокирует HTTP request) |
| `pollingService.js` | Polling pending payments (60s) | 🔴 Нет mutex lock → concurrent execution |
| `invoiceCleanupService.js` | Очистка expired invoices | ✅ Работает |

### 2. Backend Controllers

| Controller | Endpoints | Проблемы |
|------------|-----------|----------|
| `paymentController.js` | `/verify`, `/status`, `/qr` | 🔴 Race conditions, stock check после payment |
| `subscriptionController.js` | `/pending`, `/pay`, `/upgrade` | 🔴 Race conditions |

### 3. Database Schema

**Платёжные таблицы:**
```sql
payments            -- TX hash verification (LEGACY - почти не используется)
invoices            -- HD wallet адреса (ОСНОВНАЯ)
shop_subscriptions  -- Подписки магазинов
shops               -- subscription_status (дублирует shop_subscriptions.status)
orders              -- payment_hash (дублирует payments.tx_hash)
```

**ПРОБЛЕМА:** Дублирование данных в 3 местах:
- `payments.tx_hash` + `orders.payment_hash` + `shop_subscriptions.tx_hash`
- Нет single source of truth

### 4. Payment Flow (текущий)

#### Order Payment:
```
1. User creates order → orders.status = 'pending'
2. Backend generates invoice → invoices.create() (HD wallet address)
3. User pays to address
4. Detection:
   - BTC/LTC: BlockCypher webhook → /api/webhooks/blockcypher
   - ETH/USDT: Polling (60s) → pollingService.js
5. Verification:
   - Verify TX with blockchain API
   - Check amount (payment tolerance 0.5%)
   - Lock products FOR UPDATE
   - Check stock AFTER payment (❌ ПРОБЛЕМА!)
   - Update orders.status = 'confirmed'
   - Deduct stock
```

#### Subscription Payment:
```
1. User creates pending subscription → shop_subscriptions (status='pending', shop_id=NULL)
2. Generate invoice → invoices.create() (HD wallet address)
3. User pays
4. Detection: Webhook (BTC/LTC) или Polling (ETH/USDT)
5. Verification:
   - Verify TX
   - ✅ AUTO-CREATE SHOP если shop_id = NULL (предотвращает потерю денег!)
   - Update shop_subscriptions.status = 'active'
   - Update shops.tier, subscription_status
```

---

## 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (P0 - ИСПРАВИТЬ НЕМЕДЛЕННО!)

### 1. RACE CONDITION в paymentController.verify

**Файл:** `backend/src/controllers/paymentController.js:28-150`

**Проблема:**
```javascript
// Line 33: BEGIN SERIALIZABLE transaction
await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

// Line 47: Lock tx_hash
const existingTx = await client.query(
  'SELECT * FROM payments WHERE tx_hash = $1 FOR UPDATE',
  [txHash]
);

// Line 54: Проверка дубликата
if (existingTx.rows.length > 0) {
  throw new Error('Transaction already processed');
}

// ПРОБЛЕМА: Между проверкой и INSERT другой request может успеть вставить тот же tx_hash!
```

**Атака:**
```javascript
// Attacker отправляет 2 параллельных запроса с ОДИНАКОВЫМ tx_hash для РАЗНЫХ orders:
Request 1: { orderId: 100, txHash: "0xABC..." }
Request 2: { orderId: 200, txHash: "0xABC..." }  // SAME TX!

// Race condition:
T1: Request 1 SELECT → 0 rows
T2: Request 2 SELECT → 0 rows (ещё не видит INSERT от Request 1)
T3: Request 1 INSERT payment (order_id=100)
T4: Request 2 INSERT payment (order_id=200) → CONFLICT!
```

**Последствия:**
- Один tx_hash может подтвердить 2 разных заказа
- Потеря денег для seller (attacker получает 2 товара за 1 оплату)

**Решение:**
```javascript
// Добавить advisory lock ДО проверки:
await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [txHash]);

// Теперь только 1 transaction сможет обработать tx_hash одновременно
```

### 2. INVOICE ADDRESS REUSE ATTACK

**Файл:** `backend/src/controllers/paymentController.js:106-127`

**Проблема:**
```javascript
// Line 106: Check invoice not reused for different order
const invoiceCheck = await client.query(
  `SELECT id, order_id FROM invoices
   WHERE address = $1 AND order_id != $2 FOR UPDATE`,
  [sellerAddress, orderId]  // ← sellerAddress это SHOP WALLET, НЕ invoice address!
);
```

**ОШИБКА:** Код проверяет `shop.wallet_btc` (статический кошелёк магазина), а не `invoices.address` (unique per order).

**Атака:**
```javascript
// Все orders к одному shop используют ОДИН wallet:
Order 1: shop.wallet_btc = '1ABC...'
Order 2: shop.wallet_btc = '1ABC...'  // SAME WALLET!

// Attacker создаёт 2 orders, платит 1 раз → оба orders confirmed
```

**Решение:**
```javascript
// НЕ использовать shop.wallet_* для verification!
// Использовать invoices.address (unique per order):
const invoice = await invoiceQueries.findByOrderId(orderId);
const verification = await cryptoService.verifyTransaction(
  invoice.address,  // ← Уникальный адрес из HD wallet
  txHash,
  invoice.crypto_amount,
  currency
);
```

### 3. STOCK CHECK ПОСЛЕ PAYMENT CONFIRMATION

**Файл:** `backend/src/controllers/paymentController.js:200-250`

**Проблема:**
```javascript
// Line 138: Verify payment FIRST
const verification = await cryptoService.verifyTransaction(...);

// Line 200: Lock products AFTER payment verified
await client.query(
  `SELECT id FROM products WHERE id = ANY($1::int[]) FOR UPDATE`,
  [productIds]
);

// Line 215: Check stock AFTER payment
if (item.stock_quantity < item.ordered_quantity) {
  // Cancel order AFTER user paid!
  await client.query('UPDATE orders SET status = $1 WHERE id = $2', ['cancelled', orderId]);
}
```

**Последствия:**
- User оплатил, но order отменяется из-за нехватки stock
- Плохой UX (нужен refund)
- Потеря продажи для seller

**Решение:**
```javascript
// Reserve stock ПРИ СОЗДАНИИ ORDER:
// orderController.js:create()
await client.query('BEGIN');

for (const item of items) {
  await client.query(
    `UPDATE products
     SET reserved_quantity = reserved_quantity + $1
     WHERE id = $2
     AND (stock_quantity - reserved_quantity) >= $1`,  // Atomic check-and-reserve
    [item.quantity, item.product_id]
  );
}

await client.query('COMMIT');

// Затем при payment confirmation:
// paymentController.js:verify()
await client.query(
  `UPDATE products
   SET stock_quantity = stock_quantity - $1,
       reserved_quantity = reserved_quantity - $1
   WHERE id = $2`,
  [quantity, product_id]
);
```

### 4. NO IDEMPOTENCY в subscription payments

**Файл:** `backend/src/services/subscriptionService.js:48-120`

**Проблема:**
```javascript
// Line 67: Check duplicate tx_hash ВНУТРИ transaction
const duplicateCheck = await client.query(
  'SELECT id FROM shop_subscriptions WHERE tx_hash = $1',
  [txHash]
);

if (duplicateCheck.rows.length > 0) {
  throw new Error('Transaction already processed');
}

// ПРОБЛЕМА: Между check и INSERT другой webhook может вставить тот же tx_hash!
```

**Решение:**
```sql
-- Использовать ON CONFLICT:
INSERT INTO shop_subscriptions (shop_id, tx_hash, ...)
VALUES ($1, $2, ...)
ON CONFLICT (tx_hash) DO UPDATE
SET status = CASE
  WHEN shop_subscriptions.status = 'pending' THEN 'active'
  ELSE shop_subscriptions.status
END
RETURNING *;
```

### 5. POLLING SERVICE - CONCURRENT EXECUTION

**Файл:** `backend/src/services/pollingService.js:73-110`

**Проблема:**
```javascript
// Line 73: Start polling
pollingInterval = setInterval(async () => {
  if (isPolling) {
    await checkPendingPayments();  // Может выполняться параллельно!
  }
}, POLLING_INTERVAL_MS);
```

**Последствия:**
- Если `checkPendingPayments()` занимает > 60s, следующий интервал запустит его снова
- Одни и те же invoices обрабатываются дважды
- Race conditions в payment verification

**Решение:**
```javascript
let isProcessing = false;

pollingInterval = setInterval(async () => {
  if (isPolling && !isProcessing) {
    isProcessing = true;
    try {
      await checkPendingPayments();
    } finally {
      isProcessing = false;
    }
  }
}, POLLING_INTERVAL_MS);
```

### 6. BLOCKCYPHER API KEY LEAK в логах

**Файл:** `backend/src/services/blockCypherService.js:361`

**Проблема:**
```javascript
logger.debug('[BlockCypher] Request config:', { 
  url, 
  params: config.params  // ❌ УТЕЧКА! params содержит { token: BLOCKCYPHER_API_KEY }
});
```

**Последствия:**
- API key попадает в production логи
- Может быть украден через log aggregation tools (Sentry, Datadog)

**Решение:**
```javascript
// УДАЛИТЬ эту строку логирования
// Или sanitize:
logger.debug('[BlockCypher] Request config:', { 
  url,
  hasToken: !!config.params?.token  // ← Безопасно
});
```

### 7. WALLET SERVICE - НЕТ ЗАЩИТЫ ОТ XPRIV

**Файл:** `backend/src/services/walletService.js:38-53`

**Проблема:**
```javascript
function validateXpub(xpub, chain) {
  // Проверяет только формат префикса (xpub/ypub/zpub)
  // НЕТ проверки что это НЕ приватный ключ!
}
```

**Последствия:**
- Если пользователь случайно передаст `xprv` (приватный ключ) вместо `xpub`
- Backend сможет **украсть все средства** с этого кошелька

**Решение:**
```javascript
function validateXpub(xpub, chain) {
  // ✅ КРИТИЧНО: Проверка что это НЕ приватный ключ
  const privatePrefixes = ['xprv', 'yprv', 'zprv', 'Ltpv', 'tprv'];
  if (privatePrefixes.some(prefix => xpub.startsWith(prefix))) {
    throw new Error('SECURITY ERROR: Private key detected. Only public keys (xpub) allowed.');
  }
  
  // ... остальные проверки
}
```

### 8. GET BITCOIN BLOCK HEIGHT - RETURNS 0 ON ERROR

**Файл:** `backend/src/services/crypto.js:114-125`

**Проблема:**
```javascript
async getBitcoinBlockHeight() {
  try {
    const response = await axios.get('https://blockchain.info/latestblock');
    return response.data.height;
  } catch (error) {
    logger.error('Get block height error:', ...);
    return 0; // ❌ ОПАСНО!
  }
}
```

**Последствия:**
- Если blockchain.info API упал, функция возвращает `0`
- Confirmations считаются неправильно: `0 - txBlockHeight` = отрицательное число
- Payment может быть принят с **0 confirmations** вместо 3

**Решение:**
```javascript
async getBitcoinBlockHeight() {
  try {
    const response = await axios.get('https://blockchain.info/latestblock');
    return response.data.height;
  } catch (error) {
    logger.error('Get block height error:', ...);
    throw new Error(`Failed to get block height: ${error.message}`); // ✅ Throw, не return 0
  }
}
```

### 9. BOT ДЕЛАЕТ POLLING ВМЕСТО WEBSOCKET

**Файл:** `bot/src/scenes/paySubscription.js:250-280`

**Проблема:**
```javascript
// Step 4: Handle "I paid" button
if (data === 'subscription:paid') {
  // Bot синхронно ждёт ответа от Backend (60s!)
  const paymentStatus = await subscriptionApi.getSubscriptionPaymentStatus(subscriptionId, token);
  
  if (paymentStatus.status === 'paid') {
    // Success!
  } else {
    // Show "Payment pending"
  }
}
```

**Последствия:**
- Bot блокируется на 60s (timeout HTTP request)
- Backend делает blockchain API call синхронно
- User видит infinite spinner
- Плохой UX

**Решение:**
```javascript
// Backend делает polling в фоне (pollingService уже есть!)
// WebSocket отправляет событие 'payment:confirmed' клиенту
// Bot только слушает WebSocket:

ws.on('message', (data) => {
  const event = JSON.parse(data);
  if (event.type === 'payment:confirmed' && event.subscriptionId === ctx.wizard.state.subscriptionId) {
    ctx.reply('✅ Payment confirmed!');
    ctx.scene.leave();
  }
});
```

### 10. WEBAPP - НЕТ REAL-TIME UPDATES СТАТУСА

**Файл:** `webapp/src/components/Payment/OrderStatusModal.jsx`

**Проблема:**
- После submit TX hash показывается "Waiting for confirmation"
- НЕТ автоматического обновления когда backend подтверждает транзакцию
- WebSocket подключен, но payment modals НЕ подписаны на `order_status` events

**Последствия:**
- User не знает когда payment подтверждён
- Нужно вручную обновлять страницу

**Решение:**
```javascript
// В OrderStatusModal.jsx добавить:
useEffect(() => {
  if (paymentStep !== 'success' || !currentOrder?.id) return;
  
  const ws = useWebSocket();
  const handleOrderUpdate = (data) => {
    if (data.orderId === currentOrder.id && data.status === 'confirmed') {
      toast.success('Payment confirmed!');
      setPaymentStep('confirmed'); // Update UI
    }
  };
  
  ws.on('order_status', handleOrderUpdate);
  return () => ws.off('order_status', handleOrderUpdate);
}, [paymentStep, currentOrder]);
```

---

## ⚠️ ВАЖНЫЕ ПРОБЛЕМЫ (P1 - ВЫСОКИЙ ПРИОРИТЕТ)

### 11. ДУБЛИРОВАНИЕ ТАБЛИЦ: payments vs invoices

**Проблема:** 2 таблицы хранят связанные данные:
- `payments.tx_hash` + `payments.amount` + `payments.currency`
- `invoices.expected_amount` + `invoices.crypto_amount` + `invoices.currency`

**Последствия:**
- Данные могут рассинхронизироваться
- Нет прямой связи `payments.id ↔ invoices.id`

**Решение:** Добавить FK `payments.invoice_id → invoices.id`

### 12. ДУБЛИРОВАНИЕ ИНДЕКСОВ В БД

**Проблема:**
```sql
-- UNIQUE constraint автоматически создаёт индекс
invoices_address_key (UNIQUE)
idx_invoices_address          -- ДУБЛИКАТ! Удалить

shop_subscriptions_tx_hash_key (UNIQUE)
idx_shop_subscriptions_tx_hash         -- ДУБЛИКАТ!

payments_tx_hash_key (UNIQUE)
idx_payments_tx_hash          -- ДУБЛИКАТ!
```

**Последствия:**
- 2x размер индексов (лишние GB на диске)
- 2x время записи (каждый INSERT обновляет 2 индекса)

**Решение:**
```sql
DROP INDEX idx_invoices_address;
DROP INDEX idx_shop_subscriptions_tx_hash;
DROP INDEX idx_payments_tx_hash;
```

### 13. ОТСУТСТВИЕ ИНДЕКСА: invoices(status)

**Проблема:**
```sql
-- Этот запрос НЕ использует индекс (full table scan):
SELECT * FROM invoices WHERE status = 'pending';
```

**Решение:**
```sql
CREATE INDEX idx_invoices_status ON invoices(status);
```

### 14. ДУБЛИРОВАНИЕ СТАТУСА: shops.subscription_status vs shop_subscriptions.status

**Проблема:**
- `shops.subscription_status` = 'active' | 'grace_period' | 'inactive'
- `shop_subscriptions.status` = 'active' | 'pending' | 'expired' | 'cancelled'
- Могут рассинхронизироваться

**Решение:** Убрать `shops.subscription_status`, вычислять через VIEW:
```sql
CREATE VIEW shops_with_subscription AS
SELECT s.*, 
       CASE
         WHEN ss.status = 'active' AND ss.period_end > NOW() THEN 'active'
         WHEN ss.status = 'active' AND ss.period_end <= NOW() 
              AND ss.period_end + INTERVAL '2 days' > NOW() THEN 'grace_period'
         ELSE 'inactive'
       END as subscription_status
FROM shops s
LEFT JOIN shop_subscriptions ss ON s.id = ss.shop_id;
```

### 15. AMOUNT MISMATCH NOT CHECKED PROPERLY

**Файл:** `backend/src/controllers/paymentController.js:138-145`

**Проблема:**
```javascript
// Проверяет только underpayment, но не overpayment:
if (verification.amount < parseFloat(order.total_price)) {
  return res.status(400).json({ error: 'Payment amount insufficient' });
}

// ПРОБЛЕМА: Использует order.total_price (USD), а не invoice.crypto_amount (BTC/ETH)
```

**Решение:**
```javascript
if (!amountsMatchWithTolerance(verification.amount, invoice.crypto_amount, 0.005, currency)) {
  return res.status(400).json({ error: 'Amount mismatch' });
}
```

---

## 🟢 УЛУЧШЕНИЯ (P2 - СРЕДНИЙ ПРИОРИТЕТ)

### 16. INVOICE EXPIRY CHECK ДО BLOCKCHAIN VERIFICATION

**Файл:** `backend/src/controllers/paymentController.js:196-215`

**Проблема:**
- Код проверяет `invoice.expires_at` **ПОСЛЕ** blockchain verification
- Тратит API credits на expired invoices

**Решение:** Проверять `expires_at` **ДО** blockchain verification

### 17. NO MONITORING/ALERTING ДЛЯ FAILED PAYMENTS

**Проблема:** Когда payment fails, нет уведомлений для admin/seller

**Решение:**
```javascript
if (verification.amount < invoice.crypto_amount) {
  await telegramService.notifyAdminPaymentFailed({
    orderId, txHash, expected, received, shortage
  });
}
```

### 18. CRYPTO.JS ИСПОЛЬЗУЕТ BLOCKCHAIN.INFO ВМЕСТО BLOCKCYPHER

**Файл:** `backend/src/services/crypto.js:56-280`

**Проблема:**
- BTC использует `blockchain.info` API
- LTC использует `blockchair.com` API
- Но есть `blockCypherService` который поддерживает **оба** + webhooks!

**Решение:** Мигрировать на `blockCypherService` для BTC и LTC

### 19. BOT HARDCODED PAYMENT ADDRESSES

**Файл:** `bot/src/scenes/upgradeShop.js:15-20`

**Проблема:**
```javascript
const PAYMENT_ADDRESSES = {
  BTC: process.env.BTC_PAYMENT_ADDRESS || '1A1zP1...',
  ETH: process.env.ETH_PAYMENT_ADDRESS || '0x742d...',
}
```

**Последствия:**
- Bot содержит payment logic (должен быть только UI!)
- Невозможно track индивидуальные платежи

**Решение:** Bot НЕ должен знать про payment addresses, Backend генерирует unique address

### 20. WEBAPP - CART CLEARED ДО ПОДТВЕРЖДЕНИЯ PAYMENT

**Файл:** `webapp/src/hooks/useStore.js` (submitPaymentHash)

**Проблема:**
- `clearCart()` вызывается сразу после `response.data.success`
- User теряет возможность восстановить корзину если payment failed

**Решение:** Сохранять `originalCart` в `pendingOrders`, очищать только при status = 'confirmed'

---

## 📊 СТАТИСТИКА ПРОБЛЕМ

| Приоритет | Количество | Категория |
|-----------|------------|-----------|
| P0 (Critical) | 10 | Race conditions, Security, UX blocking |
| P1 (High) | 5 | Architecture, Database, Performance |
| P2 (Medium) | 5 | Optimizations, Monitoring |
| **ИТОГО** | **20** | **Найденных проблем** |

### Распределение по компонентам:

| Компонент | P0 | P1 | P2 | Всего |
|-----------|----|----|----|----|
| Backend (Services) | 5 | 3 | 2 | 10 |
| Backend (Controllers) | 3 | 1 | 1 | 5 |
| Database (Schema) | 0 | 3 | 0 | 3 |
| Bot | 1 | 1 | 0 | 2 |
| WebApp | 1 | 0 | 1 | 2 |

---

## 🎯 ПЛАН ИСПРАВЛЕНИЯ

### Фаза 1: Критические баги (1-2 дня)

**Цель:** Устранить security vulnerabilities и race conditions

1. ✅ Добавить `pg_advisory_xact_lock()` в paymentController.verify
2. ✅ Fix invoice address reuse (использовать invoices.address, не shop.wallet_*)
3. ✅ Добавить xpriv protection в walletService
4. ✅ Fix getBitcoinBlockHeight() (throw вместо return 0)
5. ✅ Удалить API key leak из blockCypherService logs
6. ✅ Добавить mutex lock в pollingService
7. ✅ ON CONFLICT idempotency для subscription payments

**Тестирование:** Симулировать race conditions (concurrent requests), проверить что payment не проходит дважды

### Фаза 2: Stock Reservation System (2-3 дня)

**Цель:** Reserve stock при создании order, а не при payment

1. ✅ Добавить `products.reserved_quantity` column (migration)
2. ✅ Implement reserve logic в orderController.create()
3. ✅ Update deduct logic в paymentController.verify()
4. ✅ Auto-release reserved stock при invoice expiration (invoiceCleanupService)

**Тестирование:** 
- Создать order → check reserved_quantity увеличился
- Pay → check stock_quantity уменьшился, reserved_quantity уменьшился
- Expire invoice → check reserved_quantity released

### Фаза 3: Database Optimization (1 день)

**Цель:** Удалить дубликаты, добавить индексы

1. ✅ DROP дублирующие индексы (idx_invoices_address, etc)
2. ✅ CREATE недостающие индексы (idx_invoices_status, idx_payments_subscription_status)
3. ✅ ADD NOT NULL constraints (invoices.crypto_amount, invoices.usd_rate)

**Тестирование:** Check query performance (EXPLAIN ANALYZE)

### Фаза 4: Real-Time Updates (2-3 дня)

**Цель:** WebSocket integration для Bot и WebApp

**Bot:**
1. ✅ Создать websocket client (bot/src/services/websocket.js)
2. ✅ Subscribe на события: 'payment:confirmed', 'subscription:expired'
3. ✅ Remove polling из paySubscription.js
4. ✅ Notify user через WebSocket events

**WebApp:**
1. ✅ Subscribe на 'order_status' events в OrderStatusModal
2. ✅ Auto-update UI при payment confirmation
3. ✅ Add countdown timer для invoice expiry
4. ✅ Add blockchain explorer links

**Backend:**
1. ✅ Broadcast WebSocket events в pollingService
2. ✅ Broadcast в webhooks handlers

**Тестирование:**
- Симулировать payment → check Bot и WebApp получают real-time уведомление
- Check countdown timer работает
- Check WebSocket reconnection при disconnect

### Фаза 5: Code Cleanup (1-2 дня)

**Цель:** Удалить legacy код, улучшить архитектуру

1. ✅ Migrate crypto.js к BlockCypher (вместо blockchain.info)
2. ✅ Remove hardcoded addresses из Bot
3. ✅ Consolidate payment tables (опционально - можно отложить)
4. ✅ Add admin monitoring для failed payments

---

## 🔧 НОВАЯ АРХИТЕКТУРА (Рекомендуется)

### Унифицированная таблица транзакций:

```sql
CREATE TABLE transactions (
  id                  SERIAL PRIMARY KEY,
  order_id            INT REFERENCES orders(id) ON DELETE CASCADE,
  subscription_id     INT REFERENCES shop_subscriptions(id) ON DELETE CASCADE,
  
  -- Invoice data
  chain               VARCHAR(20) NOT NULL CHECK (chain IN ('BTC', 'ETH', 'USDT_TRC20', 'LTC')),
  payment_address     VARCHAR(255) UNIQUE NOT NULL,
  address_index       INT NOT NULL,
  
  -- Pricing
  usd_amount          DECIMAL(10, 2) NOT NULL CHECK (usd_amount > 0),
  crypto_amount       DECIMAL(20, 8) NOT NULL CHECK (crypto_amount > 0),
  usd_rate            DECIMAL(20, 2) NOT NULL,
  currency            VARCHAR(10) NOT NULL,
  
  -- Payment verification
  tx_hash             VARCHAR(255) UNIQUE,
  confirmations       INT DEFAULT 0,
  
  -- Status
  status              VARCHAR(20) NOT NULL DEFAULT 'pending' 
                      CHECK (status IN ('pending', 'paid', 'confirmed', 'expired', 'cancelled', 'failed')),
  
  -- Timestamps
  expires_at          TIMESTAMP NOT NULL,
  verified_at         TIMESTAMP,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT check_transaction_reference CHECK (
    (order_id IS NOT NULL AND subscription_id IS NULL) OR
    (order_id IS NULL AND subscription_id IS NOT NULL)
  )
);
```

**Преимущества:**
- ✅ Одна таблица вместо 2 (payments + invoices)
- ✅ Нет дублирования данных
- ✅ Atomic updates (status + tx_hash в 1 транзакции)
- ✅ Проще JOIN: `orders → transactions` (1 step)

### Сервисная архитектура:

```
services/
  cryptoService.js        # Валидация транзакций (BTC/ETH/USDT/LTC)
  paymentService.js       # Создание, обновление payments
  subscriptionService.js  # Активация подписки
  invoiceService.js       # Генерация HD wallet адресов
  pollingService.js       # Проверка pending payments (с mutex lock)
  webhookService.js       # Обработка BlockCypher webhooks
  websocketService.js     # Real-time broadcasting
```

### API Endpoints:

```
POST   /api/orders/{orderId}/invoice         # Создать invoice для order
GET    /api/orders/{orderId}/payment/status  # Проверить статус payment
POST   /api/payments/verify                  # Submit TX hash для verification

POST   /api/subscriptions/pending            # Создать pending subscription
POST   /api/subscriptions/{id}/invoice       # Создать invoice для subscription
GET    /api/subscriptions/{id}/status        # Проверить статус payment

POST   /api/webhooks/blockcypher             # BlockCypher webhook handler
```

### Bot Architecture:

```
Bot = UI Layer ONLY
- Scenes (chooseTier, paySubscription, createShop)
- Keyboards (inline buttons)
- WebSocket client (listen for events)

Backend = Business Logic
- Payment verification
- Subscription activation
- WebSocket broadcasting
```

### WebApp Architecture:

```
PaymentFlowManager (orchestrator)
  → PaymentMethodModal (select crypto)
  → PaymentDetailsModal (show QR + address)
  → PaymentHashModal (submit TX hash)
  → OrderStatusModal (real-time updates via WebSocket)
```

---

## 📝 ТЕСТИРОВАНИЕ

### Сценарии для тестирования:

#### 1. Race Condition Test
```javascript
// Send 2 concurrent requests with same TX hash:
Promise.all([
  axios.post('/api/payments/verify', { orderId: 100, txHash: '0xABC...' }),
  axios.post('/api/payments/verify', { orderId: 200, txHash: '0xABC...' })
]);

// Expected: Только 1 request должен succeed, второй должен получить error
```

#### 2. Stock Reservation Test
```javascript
// Create order with product (stock=1)
const order1 = await createOrder({ productId: 1, quantity: 1 });
// Check: products.reserved_quantity = 1

// Try create second order (should fail - no stock):
const order2 = await createOrder({ productId: 1, quantity: 1 });
// Expected: Error "Insufficient stock"

// Pay order1:
await verifyPayment(order1.id, txHash);
// Check: products.stock_quantity = 0, reserved_quantity = 0
```

#### 3. WebSocket Real-Time Test
```javascript
// Bot WebSocket client:
ws.on('message', (data) => {
  if (data.type === 'payment:confirmed') {
    console.log('✅ Payment confirmed!'); // Should appear instantly
  }
});

// Simulate payment:
await pollingService.checkPendingPayments();

// Expected: Bot receives WebSocket event within 1s
```

#### 4. Invoice Expiry Test
```javascript
// Create invoice (expires in 30 min)
const invoice = await createInvoice(orderId, 'BTC');

// Fast-forward time (mock Date.now)
Date.now = () => new Date().getTime() + 31 * 60 * 1000;

// Try pay expired invoice:
await verifyPayment(orderId, txHash);

// Expected: Error "Invoice expired"
```

#### 5. Idempotency Test
```javascript
// Send same webhook twice:
await handleBlockCypherWebhook({ tx_hash: '0xABC...', subscription_id: 1 });
await handleBlockCypherWebhook({ tx_hash: '0xABC...', subscription_id: 1 });

// Expected: Subscription activated only once
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Перед deployment:

- [ ] Все P0 баги исправлены
- [ ] Database migrations применены (в staging)
- [ ] Integration tests passed (100% coverage для payment flow)
- [ ] Load testing (concurrent requests не создают race conditions)
- [ ] WebSocket reconnection tested
- [ ] Rollback plan готов (если что-то сломается)

### После deployment:

- [ ] Monitor error logs (первые 24 часа)
- [ ] Check payment success rate (должен быть > 95%)
- [ ] Check WebSocket connection stability
- [ ] Check polling service CPU usage (не должен зависать)
- [ ] User feedback (UX улучшился?)

---

## 📞 SUPPORT & DEBUGGING

### Логи для анализа:

```bash
# Backend errors:
tail -f backend/logs/error-$(date +%Y-%m-%d).log | grep -i "payment\|invoice\|subscription"

# Polling service:
tail -f backend/logs/combined-$(date +%Y-%m-%d).log | grep "\[PollingService\]"

# Bot errors:
tail -f bot/logs/error.log | grep -i "payment\|subscription"

# WebSocket events:
tail -f backend/logs/combined-$(date +%Y-%m-%d).log | grep "\[WebSocket\]"
```

### Типичные ошибки:

| Ошибка | Причина | Решение |
|--------|---------|---------|
| "Transaction already processed" | Duplicate webhook или polling collision | Check processed_webhooks table |
| "Invoice expired" | User paid после 30 min | Regenerate invoice |
| "Insufficient stock" | Stock sold out | Notify user, offer refund |
| "Amount mismatch" | Wrong payment amount | Check tolerance (0.5%), notify user |
| "Payment verification timeout" | Blockchain API slow | Retry, check pollingService |

### Debug Commands:

```sql
-- Check pending invoices:
SELECT id, order_id, subscription_id, chain, address, status, expires_at
FROM invoices
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Check stuck payments:
SELECT p.*, i.address, i.chain
FROM payments p
LEFT JOIN invoices i ON (p.order_id = i.order_id OR p.subscription_id = i.subscription_id)
WHERE p.status = 'pending'
AND p.created_at < NOW() - INTERVAL '1 hour';

-- Check reserved stock:
SELECT id, name, stock_quantity, reserved_quantity
FROM products
WHERE reserved_quantity > 0;
```

---

## 📚 ДОПОЛНИТЕЛЬНЫЕ РЕСУРСЫ

### Документация:
- Backend API: `backend/README.md`
- Bot guide: `bot/README.md`
- WebApp guide: `webapp/README.md`
- Database schema: `backend/database/schema.sql`

### Полезные файлы:
- Payment tolerance: `backend/src/utils/paymentTolerance.js`
- Order state machine: `backend/docs/ORDER_STATE_MACHINE.md`
- Payment tolerance docs: `backend/docs/PAYMENT_TOLERANCE_BOUNDS.md`

---

**Последнее обновление:** 2025-01-13  
**Версия:** 1.0  
**Автор:** Claude Code Audit Team

**Статус:** 🔴 КРИТИЧЕСКИЕ ПРОБЛЕМЫ - ТРЕБУЕТСЯ НЕМЕДЛЕННОЕ ИСПРАВЛЕНИЕ

**Estimated Fix Time:** 7-10 дней (с полным тестированием)

**Recommended Priority:**
1. P0 Security fixes (1-2 дня)
2. Stock reservation (2-3 дня)
3. WebSocket integration (2-3 дня)
4. Database optimization (1 день)
5. Code cleanup (1-2 дня)
