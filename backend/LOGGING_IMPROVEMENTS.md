# Enhanced Invoice Logging

> Детальное логирование для диагностики проблем с subscription invoices

## Что добавлено

### 1. `findActiveInvoiceForSubscription()`

**До:**
```javascript
// Молча возвращает NULL при отсутствии invoice
if (result.rows.length === 0) {
  return null;
}
```

**После:**
```javascript
// Детальная диагностика с анализом причин
1. Логирует search conditions перед запросом
2. При отсутствии - выполняет diagnostic query
3. Показывает ВСЕ invoices для subscription (до 5 последних)
4. Анализирует причину для каждого invoice:
   - status != 'pending'
   - expires_at < NOW()
   - Сколько секунд назад истек
5. Детальные logs с timestamps и validation results
```

**Добавленные поля в логах:**
- `searchConditions` - условия поиска (status, expires_at)
- `diagnosticResult` - результаты diagnostic query
- `reasons` - почему invoice не прошел условия
- `secondsUntilExpiry` - точное время до/после истечения
- `isValid` - boolean результат expires_at > NOW()
- `currentTime` - серверное время из PostgreSQL

---

### 2. `generateSubscriptionInvoice()`

**До:**
```javascript
logger.info('Invoice created successfully', {
  invoiceId: invoice.id,
  expiresAt: expiresAt.toISOString(),
  // ...
});
```

**После:**
```javascript
logger.info('[SubscriptionInvoice] Invoice created successfully', {
  // Все предыдущие поля +
  expiresAtUnix: expiresAt.getTime(),           // Unix timestamp
  currentTimeUnix: Date.now(),                  // Current Unix timestamp
  validityPeriodSeconds: Math.floor(...),       // Сколько секунд invoice valid
});
```

**Добавленные поля:**
- `expiresAtUnix` - Unix timestamp истечения (для timezone debugging)
- `currentTimeUnix` - текущее время Unix (сравнение)
- `validityPeriodSeconds` - период действия invoice в секундах (должно быть ~1800 = 30 min)

---

## Примеры логов

### ✅ Успешный поиск

```json
{
  "level": "debug",
  "message": "[SubscriptionInvoice] Searching for active invoice",
  "subscriptionId": 123,
  "searchConditions": {
    "status": "pending",
    "expires_at": "must be > NOW()"
  }
}

{
  "level": "info",
  "message": "[SubscriptionInvoice] Found active invoice",
  "subscriptionId": 123,
  "invoiceId": 456,
  "address": "bc1q...",
  "expiresAt": "2025-11-15T12:30:00.000Z",
  "status": "pending"
}
```

---

### ❌ Invoice не найден (expired)

```json
{
  "level": "warn",
  "message": "[SubscriptionInvoice] No active invoice found - running diagnostics",
  "subscriptionId": 123
}

{
  "level": "warn",
  "message": "[SubscriptionInvoice] Invoice found but not active",
  "subscriptionId": 123,
  "invoiceId": 456,
  "index": 0,
  "status": "pending",
  "expiresAt": "2025-11-15T10:00:00.000Z",
  "currentTime": "2025-11-15T10:45:00.000Z",
  "isValid": false,
  "secondsUntilExpiry": "-2700.00",  // ← Expired 45 minutes ago!
  "createdAt": "2025-11-15T09:30:00.000Z",
  "reasons": "expired 2700s ago"
}
```

**Диагноз:** Invoice создан в 09:30, expires в 10:00 (30 min). Сейчас 10:45 → истек 45 минут назад.

---

### ❌ Invoice не найден (wrong status)

```json
{
  "level": "warn",
  "message": "[SubscriptionInvoice] Invoice found but not active",
  "subscriptionId": 123,
  "invoiceId": 789,
  "index": 0,
  "status": "paid",  // ← Already paid!
  "expiresAt": "2025-11-15T12:00:00.000Z",
  "currentTime": "2025-11-15T11:30:00.000Z",
  "isValid": true,
  "secondsUntilExpiry": "1800.00",  // Still valid for 30 min
  "createdAt": "2025-11-15T11:00:00.000Z",
  "reasons": "status=paid (not 'pending')"
}
```

**Диагноз:** Invoice уже оплачен (status = 'paid'), хотя еще не истек. Нужно создать новый.

---

### ❌ Invoice не существует

```json
{
  "level": "warn",
  "message": "[SubscriptionInvoice] No invoices exist for this subscription",
  "subscriptionId": 123,
  "reason": "No invoices created yet"
}
```

**Диагноз:** Subscription существует, но invoice еще не создавались. Нужно создать первый.

---

### ✅ Создание invoice с timestamp debugging

```json
{
  "level": "info",
  "message": "[SubscriptionInvoice] Invoice created successfully",
  "invoiceId": 999,
  "subscriptionId": 123,
  "shopName": "My Crypto Shop",
  "tier": "pro",
  "address": "bc1q...",
  "usdAmount": 1.0,
  "cryptoAmount": "0.000023",
  "currency": "BTC",
  "usdRate": "43478.26",
  "expiresAt": "2025-11-15T12:00:00.000Z",       // ISO format
  "expiresAtUnix": 1731672000000,                // Unix timestamp
  "currentTimeUnix": 1731670200000,              // Current time
  "validityPeriodSeconds": 1800                  // 30 minutes = 1800 seconds ✓
}
```

**Проверка:**
```
expiresAtUnix - currentTimeUnix = 1731672000000 - 1731670200000 = 1800000 ms = 1800 s = 30 min ✓
```

---

## Benefits

### 🎯 Мгновенная диагностика

**Старый лог:**
```
No active invoice found
```
→ Непонятно почему. Нужно лезть в БД вручную.

**Новый лог:**
```json
{
  "invoiceId": 456,
  "status": "pending",
  "isValid": false,
  "secondsUntilExpiry": "-2700.00",
  "reasons": "expired 2700s ago"
}
```
→ Сразу ясно: invoice истек 45 минут назад. Нужно создать новый.

---

### 🕐 Timezone Debugging

**Проблема:** Серверное время не совпадает с БД временем?

**Решение:**
```javascript
// Invoice creation log
expiresAt: "2025-11-15T12:00:00.000Z"    // ISO (UTC)
expiresAtUnix: 1731672000000              // Unix timestamp
currentTimeUnix: 1731670200000            // Current time
validityPeriodSeconds: 1800               // Should be ~1800 (30 min)

// If validityPeriodSeconds != 1800 → timezone issue detected!
```

---

### 🔍 Production Troubleshooting

**Сценарий:** User жалуется "не могу оплатить подписку, выдает ошибку 404"

**Старый процесс:**
1. SSH на сервер
2. `psql` → `SELECT * FROM invoices WHERE subscription_id = X`
3. Вручную смотреть status, expires_at, сравнивать с NOW()
4. 5-10 минут debugging

**Новый процесс:**
1. Смотрим логи
2. Видим diagnostic log с полным анализом
3. Понимаем причину за 10 секунд
4. Даём решение пользователю

---

### 📊 Аналитика проблем

**Можно собирать статистику:**
- Сколько invoices истекают до оплаты?
- Какой % users пытается повторно оплатить уже paid invoice?
- Как часто возникает timezone mismatch?

**Grep по логам:**
```bash
# Найти все expired invoices за сегодня
grep "expired.*ago" backend/logs/combined-$(date +%Y-%m-%d).log

# Найти timezone issues
grep "validityPeriodSeconds" backend/logs/combined-*.log | \
  awk -F'validityPeriodSeconds":' '{print $2}' | \
  awk '{if ($1 < 1700 || $1 > 1900) print}'
```

---

## Testing

### Тестовые сценарии

1. **No invoice exists:**
   ```sql
   DELETE FROM invoices WHERE subscription_id = 123;
   ```
   → Должен вывести: `"No invoices exist for this subscription"`

2. **Invoice expired:**
   ```sql
   UPDATE invoices 
   SET expires_at = NOW() - INTERVAL '1 hour'
   WHERE id = 456;
   ```
   → Должен вывести: `"expired 3600s ago"`

3. **Invoice paid:**
   ```sql
   UPDATE invoices 
   SET status = 'paid'
   WHERE id = 456;
   ```
   → Должен вывести: `"status=paid (not 'pending')"`

4. **Active invoice:**
   ```sql
   INSERT INTO invoices (..., expires_at, status)
   VALUES (..., NOW() + INTERVAL '30 minutes', 'pending');
   ```
   → Должен найти и вернуть invoice

---

## Файлы изменены

- ✅ `backend/src/services/subscriptionInvoiceService.js`
  - `findActiveInvoiceForSubscription()` - enhanced с diagnostic query
  - `generateSubscriptionInvoice()` - добавлены Unix timestamps

---

## Рекомендации для будущего

1. **Добавить metrics:**
   ```javascript
   metrics.increment('invoice.search.not_found', {
     reason: 'expired' | 'wrong_status' | 'not_exists'
   });
   ```

2. **Alert при частых expiration:**
   ```javascript
   if (expiredCount > 10 in last hour) {
     alert('Too many invoice expirations - investigate payment flow');
   }
   ```

3. **Dashboard для invoice health:**
   - Average validity period
   - Expiration rate
   - Payment completion time

---

**Created:** 2025-11-15  
**Author:** Claude Code (debug-master)  
**Version:** 1.0
