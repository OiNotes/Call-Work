# Pricing Unification + Debug Endpoints

## Проблема решена

**До изменений:**
```javascript
// subscriptionInvoiceService.js
const SUBSCRIPTION_PRICES = { basic: 1.0, pro: 1.0 };  // ❌ $1

// subscriptionService.js
const SUBSCRIPTION_PRICES = { basic: 25.0, pro: 35.0 };  // ✅ $25/$35
```

**Несоответствие цен!** При генерации invoice для subscription использовалась цена $1 вместо реальной $25/$35.

**После изменений:**
```javascript
// Единый источник правды: config/subscriptionPricing.js
export const SUBSCRIPTION_PRICES = {
  basic: 25.0,  // $25/month
  pro: 35.0,    // $35/month
};

// Оба сервиса импортируют из одного места
import { SUBSCRIPTION_PRICES } from '../config/subscriptionPricing.js';
```

**Результат:** Гарантируется консистентность цен во всей системе.

---

## Созданные и обновлённые файлы

### 1. **backend/src/config/subscriptionPricing.js** (новый файл)

**Назначение:** Единый источник правды для всех цен подписок

**Экспортируемые константы:**
- `SUBSCRIPTION_PRICES` - месячные цены ($25 basic, $35 pro)
- `SUBSCRIPTION_PRICES_YEARLY` - годовые цены со скидкой 17%
- `SUBSCRIPTION_TIERS` - доступные tier'ы ['basic', 'pro']
- `SUBSCRIPTION_PERIOD_DAYS` - период подписки (30 дней)
- `GRACE_PERIOD_DAYS` - льготный период (2 дня)
- `INVOICE_EXPIRATION_MINUTES` - время жизни invoice (30 минут)

**Экспортируемые функции:**
- `isValidTier(tier)` - валидация tier
- `getPrice(tier, yearly)` - получение цены для tier
- `calculateProratedUpgrade(start, end, fromTier, toTier)` - расчёт prorated upgrade

**Используется в:**
- `subscriptionInvoiceService.js` - для генерации crypto invoices
- `subscriptionService.js` - для создания subscriptions
- `subscriptionController.js` (потенциально) - для отображения цен в API

---

### 2. **backend/src/services/subscriptionInvoiceService.js** (обновлён)

**Изменения:**
```diff
- const SUBSCRIPTION_PRICES = { basic: 1.0, pro: 1.0 };
- const INVOICE_EXPIRATION_MINUTES = 30;
+ import { SUBSCRIPTION_PRICES, INVOICE_EXPIRATION_MINUTES } from '../config/subscriptionPricing.js';
```

**Удалены дубликаты:** Локальные константы заменены на импорт из config.

**Результат:** Теперь использует правильные цены $25/$35 при генерации invoices.

---

### 3. **backend/src/services/subscriptionService.js** (обновлён)

**Изменения:**
```diff
- const SUBSCRIPTION_PRICES = { basic: 25.0, pro: 35.0 };
- const SUBSCRIPTION_PRICES_YEARLY = { ... };
- const GRACE_PERIOD_DAYS = 2;
- const SUBSCRIPTION_PERIOD_DAYS = 30;
+ import {
+   SUBSCRIPTION_PRICES,
+   SUBSCRIPTION_PRICES_YEARLY,
+   SUBSCRIPTION_PERIOD_DAYS,
+   GRACE_PERIOD_DAYS,
+ } from '../config/subscriptionPricing.js';
```

**Результат:** Все константы теперь из единого источника.

**Backward compatibility:** Функция `calculateUpgradeAmount()` помечена как `@deprecated`, но оставлена для совместимости.

---

### 4. **backend/src/routes/debug.js** (новый файл)

**Назначение:** Debug endpoints для диагностики invoice и subscription проблем

**Endpoints:**

#### GET `/api/debug/invoice/:id`
Детальная инспекция invoice

**Response:**
```json
{
  "success": true,
  "invoice": { /* полные данные invoice */ },
  "checks": {
    "hasSubscriptionId": true,
    "invoiceType": "subscription",
    "statusIsPending": true,
    "isActiveByTime": true,
    "wouldBeFoundByActiveQuery": true,
    "secondsUntilExpiry": 1234.56,
    // ... другие проверки
  },
  "statusExplanation": "Invoice is active and waiting for payment",
  "debug": {
    "timezone": "UTC",
    "nodeEnv": "development"
  }
}
```

**Использование:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/debug/invoice/123
```

**Use case:** Почему invoice не найден в `findActiveInvoiceForSubscription()`?

---

#### GET `/api/debug/subscription/:id/invoices`
Все invoices для subscription

**Response:**
```json
{
  "success": true,
  "subscriptionId": 456,
  "subscription": { /* shop_subscription data */ },
  "count": 3,
  "invoices": [ /* массив всех invoices */ ],
  "summary": {
    "pending": 1,
    "paid": 1,
    "expired": 1,
    "active": 1
  }
}
```

**Использование:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/debug/subscription/456/invoices
```

**Use case:** История платежей за subscription, lifecycle invoices.

---

#### GET `/api/debug/shop/:id/subscription`
Полный обзор subscription статуса магазина

**Response:**
```json
{
  "success": true,
  "shop": { /* shop data */ },
  "subscriptions": {
    "count": 2,
    "records": [ /* shop_subscriptions */ ],
    "summary": { "active": 1, "expired": 1, "cancelled": 0 }
  },
  "invoices": {
    "count": 4,
    "records": [ /* invoices */ ],
    "summary": { "pending": 1, "paid": 2, "expired": 1, "active": 1 }
  }
}
```

**Использование:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/debug/shop/789/subscription
```

**Use case:** Полная картина subscription состояния магазина.

---

### 5. **backend/src/server.js** (обновлён)

**Изменения:**
```diff
+ import debugRoutes from './routes/debug.js';

// В секции API routes:
+ // Debug routes (development only - protected by authentication)
+ if (config.nodeEnv === 'development' || process.env.ENABLE_DEBUG_ROUTES === 'true') {
+   app.use('/api/debug', debugRoutes);
+   logger.info('Debug routes enabled at /api/debug');
+ }
```

**Безопасность:**
- Debug routes включены **только в development mode**
- Можно включить в production через env: `ENABLE_DEBUG_ROUTES=true`
- Все endpoints защищены `authenticateToken` middleware
- В production рекомендуется дополнительно ограничить через admin role

---

## Тестирование

### Test 1: Проверка консистентности цен

**Проверить импорты:**
```bash
# Должны импортировать из config/subscriptionPricing.js
grep -r "SUBSCRIPTION_PRICES" backend/src/services/subscription*.js

# Ожидаемый результат:
# subscriptionInvoiceService.js: import { SUBSCRIPTION_PRICES, ... } from '../config/subscriptionPricing.js';
# subscriptionService.js: import { SUBSCRIPTION_PRICES, ... } from '../config/subscriptionPricing.js';
```

**Проверить значения:**
```bash
node -e "
import('./backend/src/config/subscriptionPricing.js').then(m => {
  console.log('SUBSCRIPTION_PRICES:', m.SUBSCRIPTION_PRICES);
  console.log('Expected: { basic: 25, pro: 35 }');
});
"
```

---

### Test 2: Debug endpoints

**Запустить backend:**
```bash
cd backend
npm run dev
```

**Test 2.1: Inspect invoice**
```bash
# Получить JWT token (замени на реальный)
TOKEN="your_jwt_token_here"

# Проверить invoice #123
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/debug/invoice/123 | jq

# Ожидаемый response:
# {
#   "success": true,
#   "invoice": { ... },
#   "checks": {
#     "wouldBeFoundByActiveQuery": true/false,
#     ...
#   }
# }
```

**Test 2.2: List subscription invoices**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/debug/subscription/456/invoices | jq

# Должен показать все invoices для subscription
```

**Test 2.3: Shop subscription overview**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/debug/shop/789/subscription | jq

# Должен показать полную картину: shop + subscriptions + invoices
```

---

### Test 3: Проверка в работе

**Создать новую subscription invoice:**
```javascript
// В коде или через API
const invoice = await generateSubscriptionInvoice(subscriptionId, 'BTC');

console.log('Expected amount (USD):', invoice.expectedAmount);
// Должно быть 25.0 или 35.0 (в зависимости от tier)

console.log('Crypto amount:', invoice.cryptoAmount);
// Должно быть конвертировано из $25/$35 в BTC
```

**Проверить логи:**
```bash
tail -f backend/logs/combined.log | grep "Subscription tier"

# Ожидаемый вывод:
# [SubscriptionInvoice] Subscription tier: basic, USD amount: $25
# [SubscriptionInvoice] Subscription tier: pro, USD amount: $35
```

---

## Потенциальные проблемы и решения

### Проблема 1: Старые invoices с ценой $1

**Симптом:** В БД могут остаться invoices с `expected_amount = 1.0` (старые данные)

**Решение:**
```sql
-- Проверить сколько таких invoices
SELECT COUNT(*) FROM invoices 
WHERE subscription_id IS NOT NULL 
AND expected_amount = 1.0;

-- Если нужно обновить (осторожно!):
UPDATE invoices
SET expected_amount = 25.0,
    crypto_amount = expected_amount / usd_rate  -- пересчитать crypto amount
WHERE subscription_id IS NOT NULL
AND expected_amount = 1.0
AND status = 'pending';
```

**ВАЖНО:** Проверить корректность usd_rate перед обновлением!

---

### Проблема 2: Debug routes в production

**Симптом:** Debug endpoints доступны в production

**Решение:**
```bash
# В production .env НЕ устанавливать:
# ENABLE_DEBUG_ROUTES=true  # ❌ Убрать эту строку

# Debug routes будут disabled автоматически
```

**Альтернатива:** Добавить admin role check в middleware:
```javascript
// В routes/debug.js
import { requireAdmin } from '../middleware/authorization.js';

router.get('/invoice/:id', authenticateToken, requireAdmin, async (req, res) => {
  // ...
});
```

---

### Проблема 3: Разные цены в разных частях кода

**Симптом:** Controller или другой код использует hardcoded цены

**Проверка:**
```bash
# Найти все упоминания цен
grep -r "25.0\|35.0" backend/src/ | grep -v "config/subscriptionPricing.js"

# Заменить на импорт из config
```

**Fix:**
```javascript
// ❌ Было
const price = tier === 'basic' ? 25.0 : 35.0;

// ✅ Стало
import { getPrice } from '../config/subscriptionPricing.js';
const price = getPrice(tier);
```

---

## Миграция для существующих данных (опционально)

Если в БД есть invoices с неправильными ценами:

```sql
-- backend/database/migrations/999_fix_subscription_invoice_prices.sql

/**
 * Fix subscription invoice prices
 * Updates invoices with incorrect $1 prices to correct $25/$35 based on tier
 */

BEGIN;

-- Update basic tier invoices
UPDATE invoices i
SET 
  expected_amount = 25.0,
  crypto_amount = 25.0 / COALESCE(i.usd_rate, 1.0)
FROM shop_subscriptions ss
WHERE 
  i.subscription_id = ss.id
  AND ss.tier = 'basic'
  AND i.expected_amount = 1.0
  AND i.status = 'pending';

-- Update pro tier invoices
UPDATE invoices i
SET 
  expected_amount = 35.0,
  crypto_amount = 35.0 / COALESCE(i.usd_rate, 1.0)
FROM shop_subscriptions ss
WHERE 
  i.subscription_id = ss.id
  AND ss.tier = 'pro'
  AND i.expected_amount = 1.0
  AND i.status = 'pending';

COMMIT;
```

**Применение:**
```bash
psql $DATABASE_URL -f backend/database/migrations/999_fix_subscription_invoice_prices.sql
```

---

## Итоги

### Что было исправлено

1. **Унифицированы цены подписок** - теперь единый источник правды в `config/subscriptionPricing.js`
2. **Исправлено несоответствие** - `subscriptionInvoiceService.js` использовал $1 вместо $25/$35
3. **Созданы debug endpoints** - для диагностики invoice/subscription проблем
4. **Улучшена поддерживаемость** - изменение цен теперь в одном месте

### Что стало лучше

- **Консистентность:** Все сервисы используют одинаковые цены
- **Поддерживаемость:** Цены меняются в одном файле
- **Отладка:** Debug endpoints помогают быстро найти проблемы
- **Безопасность:** Debug routes защищены authentication + disabled в production

### Следующие шаги

1. Проверить существующие invoices в БД на наличие неправильных цен
2. При необходимости применить миграцию для исправления данных
3. Добавить unit tests для `subscriptionPricing.js` функций
4. Рассмотреть добавление admin role check для debug endpoints в production

---

**Дата:** 2025-11-15  
**Версия:** 1.0  
**Статус:** Готово к тестированию
