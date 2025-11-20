# Migration 038: Fix Invoice Timezone Issues

## Проблема

**Bug:** После создания invoice через `POST /api/subscriptions/:id/payment/generate`, сразу же `GET /api/subscriptions/:id/payment/status` возвращает 404: "No active payment invoice found".

**Root Cause:** Timezone mismatch между JavaScript (UTC) и PostgreSQL (Europe/Moscow).

### Детали:

1. **JavaScript генерирует `expiresAt` в UTC:**
   ```javascript
   const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
   // expiresAt.toISOString() = "2025-11-15T17:30:00.000Z" (UTC)
   ```

2. **PostgreSQL column `expires_at` - тип `TIMESTAMP` (WITHOUT TIMEZONE):**
   ```sql
   expires_at TIMESTAMP NOT NULL
   ```

3. **PostgreSQL сервер настроен на Europe/Moscow (UTC+3):**
   ```sql
   SHOW timezone;
   -- Europe/Moscow
   ```

4. **При INSERT timezone info теряется:**
   ```sql
   INSERT INTO invoices (expires_at, ...) VALUES ('2025-11-15T17:30:00.000Z', ...)
   -- PostgreSQL сохраняет: "2025-11-15 17:30:00" (timezone lost!)
   ```

5. **При SELECT `NOW()` возвращает Moscow time:**
   ```sql
   SELECT * FROM invoices WHERE expires_at > NOW()
   -- expires_at: 17:30:00 (думаем это UTC, но timezone lost)
   -- NOW():      20:30:00 (Moscow time, UTC+3)
   -- Проверка: 17:30:00 > 20:30:00 → FALSE ❌
   -- Invoice считается expired!
   ```

### Пример сценария (до фикса):

```
JavaScript server time (UTC):     17:00:00
PostgreSQL server time (MSK):     20:00:00 (17:00 + 3 часа)

JavaScript создаёт invoice:
  expires_at = 17:00:00 + 30 минут = 17:30:00 UTC

PostgreSQL INSERT:
  expires_at сохраняется как "17:30:00" (timezone lost)

PostgreSQL SELECT (сразу же):
  WHERE expires_at > NOW()
  WHERE 17:30:00 > 20:00:00  ← FALSE!
  → Invoice not found (404 error)
```

## Решение

Изменить тип колонок на `TIMESTAMPTZ` (TIMESTAMP WITH TIME ZONE):

```sql
ALTER TABLE invoices
ALTER COLUMN expires_at TYPE TIMESTAMPTZ
USING expires_at AT TIME ZONE 'UTC';
```

### Почему это работает:

- `TIMESTAMPTZ` хранит значения в UTC
- PostgreSQL автоматически конвертирует в/из UTC при INSERT/SELECT
- JavaScript `new Date()` всегда работает в UTC
- `NOW()` с `TIMESTAMPTZ` возвращает UTC время
- **Гарантия:** `expires_at > NOW()` корректна независимо от timezone сервера

### Пример сценария (после фикса):

```
JavaScript server time (UTC):     17:00:00
PostgreSQL server time (MSK):     20:00:00 (17:00 + 3 часа)

JavaScript создаёт invoice:
  expires_at = 17:00:00 + 30 минут = 17:30:00 UTC

PostgreSQL INSERT (с TIMESTAMPTZ):
  expires_at сохраняется как "17:30:00+00" (UTC preserved!)

PostgreSQL SELECT (сразу же):
  WHERE expires_at > NOW()
  NOW() автоматически конвертируется в UTC: 17:00:00+00
  WHERE 17:30:00+00 > 17:00:00+00  ← TRUE! ✅
  → Invoice found
```

## Применение миграции

### Шаг 1: Backup (опционально)

```bash
pg_dump telegram_shop > backup_before_038.sql
```

### Шаг 2: Применить migration

```bash
cd backend
psql telegram_shop -f database/migrations/038_fix_invoice_timezone.sql
```

**Ожидаемый output:**

```
BEGIN
ALTER TABLE
ALTER TABLE
ALTER TABLE
COMMIT
 column_name |           data_type           | is_nullable 
-------------+-------------------------------+-------------
 created_at  | timestamp with time zone      | NO
 expires_at  | timestamp with time zone      | NO
 updated_at  | timestamp with time zone      | NO
(3 rows)
```

### Шаг 3: Проверка

```sql
-- 1. Проверить типы колонок
\d invoices

-- Должно показать:
-- expires_at  | timestamp with time zone | not null
-- created_at  | timestamp with time zone | not null default now()
-- updated_at  | timestamp with time zone | not null default now()

-- 2. Проверить existing invoices
SELECT id, subscription_id, expires_at, created_at, status
FROM invoices
WHERE subscription_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 3;

-- Timestamps теперь с timezone: "2025-11-15 17:30:00+00"
```

## Тестирование

### Test Case 1: Создать subscription invoice

```bash
# 1. Создать pending subscription
curl -X POST http://localhost:3000/api/subscriptions/pending \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "basic"}'

# Response: { "subscriptionId": 42 }

# 2. Сгенерировать invoice
curl -X POST http://localhost:3000/api/subscriptions/42/payment/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"chain": "BTC"}'

# Response: { "success": true, "invoice": { "invoiceId": 100, ... } }

# 3. СРАЗУ проверить статус (раньше возвращал 404)
curl -X GET http://localhost:3000/api/subscriptions/42/payment/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# ✅ ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
# { "success": true, "payment": { "status": "pending", ... } }
```

### Test Case 2: Проверить в PostgreSQL

```sql
-- Создать test invoice
INSERT INTO invoices (subscription_id, chain, address, address_index, expected_amount, currency, expires_at, status)
VALUES (999, 'BTC', 'test_address', 999, 25.0, 'BTC', 
        NOW() + INTERVAL '30 minutes', 'pending');

-- Сразу проверить (должен найтись)
SELECT id, expires_at, NOW() as current_time, (expires_at > NOW()) as is_active
FROM invoices
WHERE subscription_id = 999;

-- ✅ ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
-- is_active = true

-- Cleanup
DELETE FROM invoices WHERE subscription_id = 999;
```

## Влияние на existing data

### Безопасность миграции:

- ✅ **Backward compatible:** Все existing invoices конвертируются корректно
- ✅ **Data preservation:** `USING expires_at AT TIME ZONE 'UTC'` интерпретирует старые значения как UTC
- ✅ **Trigger compatibility:** `update_updated_at_column()` trigger автоматически работает с TIMESTAMPTZ
- ✅ **Application code:** НЕ требует изменений (JavaScript уже работает в UTC)

### Проверка existing invoices:

```sql
-- BEFORE migration (пример):
SELECT id, expires_at FROM invoices LIMIT 3;
-- id | expires_at
-- 25 | 2025-11-15 19:45:59.104

-- AFTER migration:
SELECT id, expires_at FROM invoices LIMIT 3;
-- id | expires_at
-- 25 | 2025-11-15 19:45:59.104+00
--                              ^^^ timezone added (UTC)
```

## Rollback (если нужно)

**НЕ РЕКОМЕНДУЕТСЯ**, но возможно:

```sql
BEGIN;

ALTER TABLE invoices
ALTER COLUMN expires_at TYPE TIMESTAMP
USING expires_at AT TIME ZONE 'UTC';

ALTER TABLE invoices
ALTER COLUMN created_at TYPE TIMESTAMP
USING created_at AT TIME ZONE 'UTC';

ALTER TABLE invoices
ALTER COLUMN updated_at TYPE TIMESTAMP
USING updated_at AT TIME ZONE 'UTC';

COMMIT;
```

**WARNING:** Rollback вернёт проблему timezone mismatch!

## Дополнительные улучшения

### Рекомендация: Исправить другие TIMESTAMP колонки

```sql
-- Проверить все TIMESTAMP WITHOUT TIME ZONE в схеме:
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'timestamp without time zone'
ORDER BY table_name, column_name;
```

**Кандидаты для миграции:**

- `orders.created_at`, `updated_at`, `paid_at`, `completed_at`
- `shop_subscriptions.period_start`, `period_end`, `created_at`, `verified_at`
- `payments.created_at`, `updated_at`, `verified_at`
- `users.created_at`, `updated_at`
- `shops.created_at`, `updated_at`, `next_payment_due`, `grace_period_until`
- `products.created_at`, `updated_at`, `discount_expires_at`

**TODO:** Создать migration 039 для конвертации всех TIMESTAMP → TIMESTAMPTZ.

## References

- [PostgreSQL: Don't use TIMESTAMP (without time zone)](https://wiki.postgresql.org/wiki/Don't_Do_This#Don.27t_use_timestamp_.28without_time_zone.29)
- [Best Practice: Always use TIMESTAMPTZ](https://tapoueh.org/blog/2018/04/postgresql-data-types-date-timestamp-and-time-zones/)
- Full audit: `backend/INVOICE_BUG_AUDIT.md`

---

**Migration Status:** Ready to apply  
**Risk Level:** Low (backward compatible)  
**Testing Required:** Yes (see Test Cases above)
