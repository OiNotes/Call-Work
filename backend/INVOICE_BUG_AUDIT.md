# 🔍 АУДИТ: Invoice Generation Bug

**Дата аудита:** 2025-11-15  
**Проблема:** Генерация invoice через `POST /api/subscriptions/:id/payment/generate` завершается успешно, но сразу же `GET /api/subscriptions/:id/payment/status` возвращает 404: "No active payment invoice found for this subscription"

---

## 1. Код generateSubscriptionInvoice() - INSERT секция

**Файл:** `backend/src/services/subscriptionInvoiceService.js`  
**Строки:** 194-204

```javascript
// 10. Create invoice record with crypto_amount and usd_rate (migration 016)
const invoiceResult = await query(
  `INSERT INTO invoices
   (subscription_id, chain, address, address_index, expected_amount, crypto_amount, usd_rate, currency, tatum_subscription_id, expires_at, status)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
   RETURNING *`,
  [
    subscriptionId,        // $1
    normalizedChain,       // $2
    address,               // $3
    nextIndex,             // $4
    usdAmount,             // $5
    cryptoAmount,          // $6
    usdRate,               // $7
    currency,              // $8
    webhookSubscriptionId, // $9
    expiresAt,             // $10
  ]
);
```

**Анализ INSERT:**
- ✅ `subscription_id` передаётся корректно как `$1`
- ✅ `expected_amount` = `usdAmount` (цена подписки в USD)
- ✅ `crypto_amount` = конвертированная сумма в криптовалюте
- ✅ `usd_rate` = курс обмена
- ✅ `expires_at` = `expiresAt` (NOW() + 30 минут)
- ✅ `status` = `'pending'` (hardcoded в SQL)

---

## 2. Все места INSERT INTO invoices в проекте

### 2.1 Production code (3 места):

#### A) `backend/src/services/subscriptionInvoiceService.js:194`
```javascript
INSERT INTO invoices
(subscription_id, chain, address, address_index, expected_amount, crypto_amount, usd_rate, currency, tatum_subscription_id, expires_at, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
```
- **Purpose:** Subscription invoices
- **Uses:** `subscription_id` ✅
- **Function:** `generateSubscriptionInvoice()`

#### B) `backend/src/database/queries/invoiceQueries.js:21`
```javascript
INSERT INTO invoices (order_id, chain, address, address_index, expected_amount, currency, tatum_subscription_id, expires_at, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
```
- **Purpose:** Order invoices
- **Uses:** `order_id` ✅
- **Function:** `invoiceQueries.create()`

#### C) `backend/src/models/db.js:907`
```javascript
INSERT INTO invoices (order_id, chain, address, address_index, expected_amount, currency, tatum_subscription_id, expires_at, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
```
- **Purpose:** Order invoices (legacy code в models/db.js)
- **Uses:** `order_id` ✅

### 2.2 Test fixtures (11 мест в `backend/__tests__/`)
- Все test fixtures используют правильно `subscription_id` для subscription invoices

**Вывод:** Все production INSERT корректно различают `order_id` vs `subscription_id`.

---

## 3. Код findActiveInvoiceForSubscription()

**Файл:** `backend/src/services/subscriptionInvoiceService.js`  
**Строки:** 242-270

```javascript
export async function findActiveInvoiceForSubscription(subscriptionId) {
  try {
    const result = await query(
      `SELECT * FROM invoices
       WHERE subscription_id = $1
       AND status = 'pending'
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [subscriptionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    logger.info(`[SubscriptionInvoice] Found active invoice for subscription ${subscriptionId}:`, {
      invoiceId: result.rows[0].id,
      address: result.rows[0].address,
      expiresAt: result.rows[0].expires_at,
    });

    return result.rows[0];
  } catch (error) {
    logger.error('[SubscriptionInvoice] Error finding active invoice:', {
      error: error.message,
      subscriptionId,
    });
    return null;
  }
}
```

**SQL WHERE условия:**
1. `subscription_id = $1` ✅
2. `status = 'pending'` ✅
3. `expires_at > NOW()` ✅ ← **ПОТЕНЦИАЛЬНАЯ ПРОБЛЕМА!**

---

## 4. Step-by-step trace сценария

### Сценарий выполнения:

```
1. User создаёт pending subscription
   → POST /api/subscriptions/pending
   → subscriptionId = 42 создан в БД

2. User генерирует invoice
   → POST /api/subscriptions/42/payment/generate
   → Body: { chain: "BTC" }

3. subscriptionController.generatePaymentInvoice() вызывается
   → verifySubscriptionOwnership(42, userId) ✅ PASS
   → subscription.status = 'pending' ✅ PASS
   → findActiveInvoiceForSubscription(42) → null (нет invoice пока)
   → generateSubscriptionInvoice(42, "BTC")

4. subscriptionInvoiceService.generateSubscriptionInvoice(42, "BTC") выполняется
   → expiresAt = new Date(Date.now() + 30 * 60 * 1000)
   → Пример: expiresAt = "2025-11-15T10:30:00.000Z"
   
   → INSERT INTO invoices:
     - subscription_id = 42 ✅
     - expires_at = "2025-11-15T10:30:00.000Z" ✅
     - status = 'pending' ✅
   
   → Invoice ID=100 создан в БД

5. Response возвращается клиенту:
   {
     "success": true,
     "invoice": { "invoiceId": 100, "address": "...", ... }
   }

6. СРАЗУ ЖЕ: GET /api/subscriptions/42/payment/status
   → subscriptionController.getPaymentStatus()
   → verifySubscriptionOwnership(42, userId) ✅ PASS
   → findActiveInvoiceForSubscription(42)

7. findActiveInvoiceForSubscription(42) ищет invoice:
   SELECT * FROM invoices
   WHERE subscription_id = 42
   AND status = 'pending'
   AND expires_at > NOW()  ← КРИТИЧНАЯ ПРОВЕРКА!
```

### Анализ условий WHERE:

**Вопрос:** Какое значение NOW() при шаге 7?

- **При INSERT (шаг 4):** NOW() = `2025-11-15T10:00:00.000Z`
- **expiresAt рассчитано:** `2025-11-15T10:00:00.000Z + 30 минут = 10:30:00.000Z`
- **При SELECT (шаг 7):** NOW() = `2025-11-15T10:00:00.001Z` (на 1ms позже)

**Проверка условия `expires_at > NOW()`:**
- `expires_at` в БД: `2025-11-15T10:30:00.000Z`
- `NOW()` при SELECT: `2025-11-15T10:00:00.001Z`
- Разница: **+29 минут 59.999 секунд**
- **Условие ДОЛЖНО выполняться:** ✅ `10:30:00 > 10:00:00`

### Результат trace:
- `subscription_id = 42`? **✅ PASS**
- `status = 'pending'`? **✅ PASS**
- `expires_at > NOW()`? **✅ PASS (теоретически)**

**Вывод:** Логика SQL запроса корректна. Проблема в другом месте.

---

## 5. Расчёт expires_at

**Файл:** `backend/src/services/subscriptionInvoiceService.js`

### 5.1 Константа:

**Строка 20:**
```javascript
// Invoice expiration time (30 minutes)
const INVOICE_EXPIRATION_MINUTES = 30;
```

✅ **Значение:** `30` минут

### 5.2 Использование константы:

**Строка 153:**
```javascript
// 8. Calculate expiration time (30 minutes from now)
const expiresAt = new Date(Date.now() + INVOICE_EXPIRATION_MINUTES * 60 * 1000);
```

✅ **Формула:** `NOW() + 30 * 60 * 1000` = `NOW() + 1800000ms` = **NOW() + 30 минут**

### 5.3 Проверка переопределения:

**Grep по всему subscriptionInvoiceService.js:**
```bash
grep -n "INVOICE_EXPIRATION_MINUTES" backend/src/services/subscriptionInvoiceService.js
```

**Результат:**
- Строка 20: объявление константы
- Строка 153: использование в расчёте

✅ **Константа НЕ переопределяется.**

---

## 6. Database Schema - invoices table

**Файл:** `backend/database/schema.sql`  
**Строки:** 363-397

```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  subscription_id INT REFERENCES shop_subscriptions(id) ON DELETE CASCADE,
  chain VARCHAR(20) NOT NULL CHECK (chain IN ('BTC', 'ETH', 'USDT_ERC20', 'USDT_TRC20', 'LTC')),
  address VARCHAR(255) UNIQUE NOT NULL,
  address_index INT NOT NULL,
  expected_amount DECIMAL(18, 8) NOT NULL CHECK (expected_amount > 0),
  crypto_amount DECIMAL(20, 8),
  usd_rate DECIMAL(20, 2),
  currency VARCHAR(10) NOT NULL,
  tatum_subscription_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT check_invoice_reference CHECK (
    (order_id IS NOT NULL AND subscription_id IS NULL) OR
    (order_id IS NULL AND subscription_id IS NOT NULL)
  )
);
```

### Анализ schema:

**expires_at:**
- Тип: `TIMESTAMP` (без timezone)
- Default: **НЕТ** (значение передаётся явно из кода)
- NOT NULL: ✅

**subscription_id:**
- Тип: `INT`
- References: `shop_subscriptions(id) ON DELETE CASCADE` ✅
- Constraint: `check_invoice_reference` ✅

**status:**
- Тип: `VARCHAR(20)`
- Default: `'pending'` ✅
- CHECK: `status IN ('pending', 'paid', 'expired', 'cancelled')` ✅

**Constraint check_invoice_reference:**
```sql
(order_id IS NOT NULL AND subscription_id IS NULL) OR
(order_id IS NULL AND subscription_id IS NOT NULL)
```
✅ **Гарантирует:** Только один из `order_id` или `subscription_id` заполнен.

### Проблема с TIMESTAMP:

**⚠️ КРИТИЧНО:** `expires_at TIMESTAMP` (без `TIMESTAMPTZ`)

- `TIMESTAMP` = локальное время **БЕЗ timezone**
- JavaScript `new Date()` = **WITH timezone (UTC)**

**Потенциальная проблема timezone mismatch:**

```javascript
// JavaScript (UTC timezone):
const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
// expiresAt = "2025-11-15T10:30:00.000Z" (ISO string with UTC)

// PostgreSQL INSERT:
INSERT INTO invoices (expires_at, ...) VALUES ('2025-11-15T10:30:00.000Z', ...)
// PostgreSQL интерпретирует как TIMESTAMP WITHOUT TIMEZONE
// → Сохраняется: "2025-11-15 10:30:00" (без timezone info)

// PostgreSQL SELECT:
SELECT expires_at FROM invoices WHERE expires_at > NOW()
// NOW() в PostgreSQL = текущее локальное время сервера БД
// Если PostgreSQL сервер НЕ в UTC, возможен mismatch!
```

**Пример:**
- JavaScript server в UTC: `NOW() = 10:00:00 UTC`
- PostgreSQL server в MSK (UTC+3): `NOW() = 13:00:00 MSK`
- `expires_at` сохранено как `10:30:00` (без timezone)
- **Проверка `expires_at > NOW()`:**
  - `10:30:00 > 13:00:00`? **❌ FAIL**

---

## 7. Сравнение функций INSERT

### 7.1 Для Orders (invoiceQueries.create):

**Файл:** `backend/src/database/queries/invoiceQueries.js:21`

```javascript
create: async (invoiceData) => {
  const {
    orderId,
    chain,
    address,
    addressIndex,
    expectedAmount,
    currency,
    webhookSubscriptionId,
    expiresAt,
  } = invoiceData;
  
  const result = await query(
    `INSERT INTO invoices (order_id, chain, address, address_index, expected_amount, currency, tatum_subscription_id, expires_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING *`,
    [
      orderId,                  // order_id
      chain,
      address,
      addressIndex,
      expectedAmount,
      currency,
      webhookSubscriptionId,
      expiresAt,
    ]
  );
  
  return result.rows[0];
}
```

**Uses:** `order_id` ✅  
**Columns:** 9 колонок (без `crypto_amount`, `usd_rate`)

### 7.2 Для Subscriptions (generateSubscriptionInvoice):

**Файл:** `backend/src/services/subscriptionInvoiceService.js:194`

```javascript
const invoiceResult = await query(
  `INSERT INTO invoices
   (subscription_id, chain, address, address_index, expected_amount, crypto_amount, usd_rate, currency, tatum_subscription_id, expires_at, status)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
   RETURNING *`,
  [
    subscriptionId,           // subscription_id
    normalizedChain,
    address,
    nextIndex,
    usdAmount,
    cryptoAmount,             // extra field
    usdRate,                  // extra field
    currency,
    webhookSubscriptionId,
    expiresAt,
  ]
);
```

**Uses:** `subscription_id` ✅  
**Columns:** 11 колонок (включая `crypto_amount`, `usd_rate`)

**Вывод:** Обе функции используют правильные поля (`order_id` vs `subscription_id`).

---

## 8. 🔴 ДИАГНОЗ

### Найденная проблема:

**TIMEZONE MISMATCH между JavaScript и PostgreSQL**

### Точная причина:

1. **JavaScript генерирует `expiresAt` в UTC timezone:**
   ```javascript
   const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
   // expiresAt.toISOString() = "2025-11-15T10:30:00.000Z"
   ```

2. **PostgreSQL column `expires_at` имеет тип `TIMESTAMP` (WITHOUT TIMEZONE):**
   ```sql
   expires_at TIMESTAMP NOT NULL
   ```

3. **При INSERT PostgreSQL сбрасывает timezone info:**
   ```sql
   INSERT INTO invoices (expires_at, ...) VALUES ('2025-11-15T10:30:00.000Z', ...)
   -- PostgreSQL сохраняет: "2025-11-15 10:30:00" (без UTC marker)
   ```

4. **При SELECT PostgreSQL использует `NOW()` в локальном timezone сервера БД:**
   ```sql
   SELECT * FROM invoices WHERE expires_at > NOW()
   -- NOW() = текущее время в timezone PostgreSQL сервера
   ```

5. **Если PostgreSQL server НЕ в UTC:**
   - Пример: сервер в MSK (UTC+3)
   - JavaScript INSERT: `expires_at = 10:30:00` (думая это UTC)
   - PostgreSQL NOW(): `13:00:00` (MSK время)
   - **Проверка `10:30:00 > 13:00:00` → FAIL**
   - Invoice считается expired сразу после создания!

### Доказательство:

**Проверка timezone PostgreSQL сервера:**

```sql
SHOW timezone;
-- Если вернёт не 'UTC', значит есть mismatch
```

**Воспроизведение бага:**

```sql
-- Создать test invoice (simulate JavaScript UTC)
INSERT INTO invoices (subscription_id, chain, address, address_index, expected_amount, currency, expires_at, status)
VALUES (42, 'BTC', 'test_address', 1, 25.0, 'BTC', '2025-11-15 10:30:00', 'pending');

-- Проверка timezone NOW()
SELECT NOW(), timezone;
-- Если NOW() > 10:30:00 (из-за timezone offset), invoice expired!

-- Попытка найти active invoice
SELECT * FROM invoices
WHERE subscription_id = 42
AND status = 'pending'
AND expires_at > NOW();
-- Вернёт пустой результат, если NOW() в другом timezone!
```

---

## 9. 🔧 РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ

### Фикс #1: Изменить тип колонки на TIMESTAMPTZ (RECOMMENDED)

**Миграция:**

```sql
-- Migration: 038_fix_invoice_timezone.sql

-- 1. Изменить тип колонки expires_at на TIMESTAMPTZ
ALTER TABLE invoices
ALTER COLUMN expires_at TYPE TIMESTAMPTZ
USING expires_at AT TIME ZONE 'UTC';

-- 2. Также поправить created_at и updated_at для консистентности
ALTER TABLE invoices
ALTER COLUMN created_at TYPE TIMESTAMPTZ
USING created_at AT TIME ZONE 'UTC';

ALTER TABLE invoices
ALTER COLUMN updated_at TYPE TIMESTAMPTZ
USING updated_at AT TIME ZONE 'UTC';

-- 3. Обновить trigger для updated_at (если нужно)
-- Trigger update_updated_at_column уже существует, работает автоматически
```

**Почему это правильное решение:**

- `TIMESTAMPTZ` (TIMESTAMP WITH TIME ZONE) хранит UTC время
- PostgreSQL автоматически конвертирует в/из UTC при INSERT/SELECT
- JavaScript `new Date()` всегда работает в UTC
- `NOW()` в PostgreSQL с `TIMESTAMPTZ` возвращает UTC время
- **Гарантия:** `expires_at > NOW()` всегда корректна независимо от timezone сервера

**Пример до/после:**

```sql
-- ДО (TIMESTAMP):
INSERT INTO invoices (expires_at) VALUES ('2025-11-15T10:30:00.000Z');
-- Сохраняется: "2025-11-15 10:30:00" (timezone lost!)

SELECT expires_at FROM invoices;
-- Возвращает: "2025-11-15 10:30:00" (без timezone)

-- ПОСЛЕ (TIMESTAMPTZ):
INSERT INTO invoices (expires_at) VALUES ('2025-11-15T10:30:00.000Z');
-- Сохраняется: "2025-11-15 10:30:00+00" (UTC preserved)

SELECT expires_at FROM invoices;
-- Возвращает: "2025-11-15 10:30:00+00" (с UTC timezone)
```

---

### Фикс #2: Явно установить timezone PostgreSQL в UTC (Workaround)

**Если НЕ хочешь менять schema:**

**В `backend/src/config/database.js`:**

```javascript
// Перед созданием pool добавить:
import pkg from 'pg';
const { types } = pkg;

// Force PostgreSQL to use UTC timezone
pool.on('connect', (client) => {
  client.query('SET timezone = "UTC"');
});
```

**Или через переменную окружения:**

```bash
# В .env
PGTZ=UTC
```

**Или через postgresql.conf:**

```
# В /etc/postgresql/14/main/postgresql.conf
timezone = 'UTC'
```

**Недостатки этого подхода:**

- ❌ Влияет на **все** TIMESTAMP колонки (не только invoices)
- ❌ Может сломать existing queries, которые полагаются на локальный timezone
- ❌ Не решает проблему кардинально (TIMESTAMP всё равно без timezone)

---

### Фикс #3: Добавить explicit timezone conversion в SQL queries (Hack)

**В `findActiveInvoiceForSubscription()`:**

```javascript
// БЫЛО:
const result = await query(
  `SELECT * FROM invoices
   WHERE subscription_id = $1
   AND status = 'pending'
   AND expires_at > NOW()`,
  [subscriptionId]
);

// СТАЛО:
const result = await query(
  `SELECT * FROM invoices
   WHERE subscription_id = $1
   AND status = 'pending'
   AND expires_at AT TIME ZONE 'UTC' > NOW() AT TIME ZONE 'UTC'`,
  [subscriptionId]
);
```

**Недостатки:**

- ❌ Нужно править **каждый** SQL query с `expires_at`
- ❌ Verbose и неудобно поддерживать
- ❌ Может замедлить queries (extra conversion)

---

## 10. 📋 ИТОГОВЫЙ ПЛАН ИСПРАВЛЕНИЯ

### Шаг 1: Проверить timezone PostgreSQL сервера

```bash
psql telegram_shop -c "SHOW timezone;"
```

**Ожидаемый результат:** `UTC`

**Если НЕ UTC:** Проблема подтверждена.

---

### Шаг 2: Создать migration 038

**Файл:** `backend/database/migrations/038_fix_invoice_timezone.sql`

```sql
-- Migration: Fix invoice timezone issues
-- Problem: TIMESTAMP (without timezone) causes mismatch between JavaScript UTC and PostgreSQL local time
-- Solution: Change to TIMESTAMPTZ (with timezone) to ensure consistent UTC handling

BEGIN;

-- 1. Change expires_at to TIMESTAMPTZ
ALTER TABLE invoices
ALTER COLUMN expires_at TYPE TIMESTAMPTZ
USING expires_at AT TIME ZONE 'UTC';

-- 2. Change created_at to TIMESTAMPTZ for consistency
ALTER TABLE invoices
ALTER COLUMN created_at TYPE TIMESTAMPTZ
USING created_at AT TIME ZONE 'UTC';

-- 3. Change updated_at to TIMESTAMPTZ for consistency
ALTER TABLE invoices
ALTER COLUMN updated_at TYPE TIMESTAMPTZ
USING updated_at AT TIME ZONE 'UTC';

COMMIT;

-- Verify changes
\d invoices
```

---

### Шаг 3: Применить migration

```bash
cd backend
psql telegram_shop -f database/migrations/038_fix_invoice_timezone.sql
```

---

### Шаг 4: Тестировать сценарий

```bash
# 1. Создать pending subscription
curl -X POST http://localhost:3000/api/subscriptions/pending \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "basic"}'

# Response: { "subscriptionId": 42, ... }

# 2. Сгенерировать invoice
curl -X POST http://localhost:3000/api/subscriptions/42/payment/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"chain": "BTC"}'

# Response: { "success": true, "invoice": { "invoiceId": 100, ... } }

# 3. СРАЗУ проверить статус
curl -X GET http://localhost:3000/api/subscriptions/42/payment/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Ожидаемый результат: { "success": true, "payment": { "status": "pending", ... } }
# НЕ 404 error!
```

---

### Шаг 5: Проверить логи

```bash
tail -f backend/logs/combined.log | grep -i invoice
```

**Ожидаемые логи:**

```
[SubscriptionInvoice] Invoice created successfully: invoiceId=100, subscriptionId=42, ...
[SubscriptionInvoice] Found active invoice for subscription 42: invoiceId=100, ...
```

**НЕ ДОЛЖНО быть:**

```
[SubscriptionController] No active payment invoice found for this subscription
```

---

## 11. 🧪 ДОПОЛНИТЕЛЬНЫЕ ПРОВЕРКИ

### Проверка 1: Текущий timezone PostgreSQL

```sql
-- Проверить timezone сервера
SELECT name, setting FROM pg_settings WHERE name = 'timezone';

-- Проверить NOW() в разных timezone
SELECT 
  NOW() as server_time,
  NOW() AT TIME ZONE 'UTC' as utc_time,
  CURRENT_TIMESTAMP as current_timestamp;
```

### Проверка 2: Existing invoices в БД

```sql
-- Проверить есть ли уже созданные invoices
SELECT 
  id,
  subscription_id,
  expires_at,
  pg_typeof(expires_at) as type,
  status,
  created_at
FROM invoices
WHERE subscription_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

### Проверка 3: Воспроизведение бага в psql

```sql
-- Simulate timezone mismatch
SET timezone = 'Europe/Moscow';  -- UTC+3

-- Создать test invoice (как из JavaScript UTC)
INSERT INTO invoices (subscription_id, chain, address, address_index, expected_amount, currency, expires_at, status)
VALUES (999, 'BTC', 'test_tz_address', 999, 25.0, 'BTC', 
        (NOW() AT TIME ZONE 'UTC' + INTERVAL '30 minutes'), 'pending');

-- Попытка найти (как делает findActiveInvoiceForSubscription)
SELECT * FROM invoices
WHERE subscription_id = 999
AND status = 'pending'
AND expires_at > NOW();

-- Если timezone = MSK, вернёт пустой результат (invoice expired)!

-- Cleanup
DELETE FROM invoices WHERE subscription_id = 999;
SET timezone = 'UTC';
```

---

## 12. ✅ CHECKLIST ДЛЯ ПРОВЕРКИ ПОСЛЕ ФИКСА

- [ ] Migration 038 применена успешно
- [ ] `\d invoices` показывает `expires_at` как `timestamp with time zone`
- [ ] Test scenario (создать subscription → generate invoice → check status) работает БЕЗ 404
- [ ] Логи показывают "Found active invoice for subscription X"
- [ ] PostgreSQL timezone установлен в UTC (или migration гарантирует UTC handling)
- [ ] Existing invoices не сломались (проверить старые invoices)

---

## 13. 🚨 ДОПОЛНИТЕЛЬНЫЕ РИСКИ

### Риск 1: Other tables с TIMESTAMP

**Проверить другие таблицы:**

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'timestamp without time zone'
ORDER BY table_name, column_name;
```

**Возможные кандидаты для миграции:**
- `orders.created_at`, `orders.updated_at`, `orders.paid_at`, `orders.completed_at`
- `shop_subscriptions.period_start`, `period_end`, `created_at`, `verified_at`
- `payments.created_at`, `updated_at`, `verified_at`

**Рекомендация:** Создать отдельную migration для всех TIMESTAMP → TIMESTAMPTZ.

### Риск 2: JavaScript timezone handling

**Проверить что JavaScript server в UTC:**

```javascript
// backend/src/index.js (при старте)
console.log('[Server] Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('[Server] NOW:', new Date().toISOString());
```

**Ожидаемый результат:**
```
[Server] Timezone: UTC
[Server] NOW: 2025-11-15T10:00:00.000Z
```

**Если НЕ UTC:** Установить через environment variable:

```bash
# В start script
TZ=UTC node src/index.js
```

---

## 14. 📚 REFERENCES

- [PostgreSQL: Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [PostgreSQL: timezone vs timestamptz](https://wiki.postgresql.org/wiki/Don't_Do_This#Don.27t_use_timestamp_.28without_time_zone.29)
- [JavaScript Date and Timezones](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)
- [Best Practices: Always use TIMESTAMPTZ](https://tapoueh.org/blog/2018/04/postgresql-data-types-date-timestamp-and-time-zones/)

---

**Аудит завершён.**  
**Следующий шаг:** Применить **Фикс #1** (migration 038) для полного решения проблемы.
