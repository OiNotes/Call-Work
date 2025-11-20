# Migration 039 Summary

## Files Created:
1. ✅ `backend/database/migrations/039_add_invoice_payment_details.sql`
2. ✅ `backend/database/migrations/README_039.md`

## Schema Changes:
- **invoices.paid_at** (TIMESTAMPTZ, NULL) - когда payment был подтверждён
- **invoices.tx_hash** (VARCHAR(255), NULL) - blockchain transaction hash
- **Index:** `idx_invoices_tx_hash` (partial, только для non-null)

## Current Invoice Schema (перед миграцией):
```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id),
  subscription_id INT REFERENCES shop_subscriptions(id),
  chain VARCHAR(20) NOT NULL,
  address VARCHAR(255) UNIQUE NOT NULL,
  address_index INT NOT NULL,
  expected_amount DECIMAL(18, 8) NOT NULL,
  crypto_amount DECIMAL(20, 8),
  usd_rate DECIMAL(20, 2),
  currency VARCHAR(10) NOT NULL,
  tatum_subscription_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'paid', 'expired', 'cancelled'
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## After Migration:
```sql
-- Added columns:
paid_at TIMESTAMPTZ DEFAULT NULL,      -- NEW
tx_hash VARCHAR(255) DEFAULT NULL       -- NEW
```

---

## Code Update Required:

### 🔍 Found 5 locations calling `invoiceQueries.updateStatus(invoice.id, 'paid')`

### 1. **pollingService.js** - Line 281
**Location:** `backend/src/services/pollingService.js:281`
**Function:** `checkPendingInvoices()` - existing payment update
**Current code:**
```javascript
if (payment.status === 'confirmed') {
  await invoiceQueries.updateStatus(invoice.id, 'paid');
}
```

**Change to:**
```javascript
if (payment.status === 'confirmed') {
  await invoiceQueries.updateStatus(invoice.id, 'paid', payment.txHash || payment.tx_hash);
}
```

**Context:** Обновление существующего payment после проверки подтверждений

---

### 2. **pollingService.js** - Line 306
**Location:** `backend/src/services/pollingService.js:306`
**Function:** `checkPendingInvoices()` - new payment creation
**Current code:**
```javascript
// Update invoice status
await invoiceQueries.updateStatus(invoice.id, 'paid');
```

**Change to:**
```javascript
// Update invoice status
await invoiceQueries.updateStatus(invoice.id, 'paid', payment.txHash || payment.tx_hash);
```

**Context:** Создание нового payment record после первой проверки

---

### 3. **webhooks.js** - Line 84
**Location:** `backend/src/routes/webhooks.js:84`
**Function:** `POST /api/webhooks/tatum` - TRON subscription payment
**Current code:**
```javascript
// Update invoice status
await invoiceQueries.updateStatus(invoice.id, 'paid');
```

**Change to:**
```javascript
// Update invoice status (tx_hash from webhook)
await invoiceQueries.updateStatus(invoice.id, 'paid', webhookData.txId);
```

**Context:** TRON webhook для subscription payments (TRC20 USDT)

---

### 4. **webhooks.js** - Line 374
**Location:** `backend/src/routes/webhooks.js:374`
**Function:** `POST /api/webhooks/blockcypher` - existing payment confirmed
**Current code:**
```javascript
await updateOrderStatus(invoice.order_id, 'confirmed');
await invoiceQueries.updateStatus(invoice.id, 'paid');
```

**Change to:**
```javascript
await updateOrderStatus(invoice.order_id, 'confirmed');
await invoiceQueries.updateStatus(invoice.id, 'paid', paymentData.hash);
```

**Context:** BlockCypher webhook (BTC/LTC) для order payments, existing payment обновление

---

### 5. **webhooks.js** - Line 435
**Location:** `backend/src/routes/webhooks.js:435`
**Function:** `POST /api/webhooks/blockcypher` - new payment confirmed
**Current code:**
```javascript
await updateOrderStatus(invoice.order_id, 'confirmed');
await invoiceQueries.updateStatus(invoice.id, 'paid');
```

**Change to:**
```javascript
await updateOrderStatus(invoice.order_id, 'confirmed');
await invoiceQueries.updateStatus(invoice.id, 'paid', paymentData.hash);
```

**Context:** BlockCypher webhook (BTC/LTC) для order payments, new payment creation

---

## 📝 **invoiceQueries.js** - Update method signature

**Location:** `backend/src/database/queries/invoiceQueries.js:74-80`
**Current:**
```javascript
updateStatus: async (id, status) => {
  const result = await query(
    `UPDATE invoices
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );
  return result.rows[0];
},
```

**Change to:**
```javascript
updateStatus: async (id, status, txHash = null) => {
  const result = await query(
    `UPDATE invoices
     SET status = $2,
         paid_at = CASE WHEN $2 = 'paid' THEN NOW() ELSE paid_at END,
         tx_hash = COALESCE($3, tx_hash),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status, txHash]
  );
  return result.rows[0];
},
```

**Логика:**
- `paid_at` - устанавливается только когда `status = 'paid'` (первый раз)
- `tx_hash` - обновляется если передан (COALESCE сохраняет существующее если null)
- Backward compatible - `txHash` опционален (default null)

---

## 📝 **db.js** (legacy) - Update method signature

**Location:** `backend/src/models/db.js:960-967`
**Same changes as invoiceQueries.js** (duplicate code, нужно обновить оба места)

---

## Summary of Changes:

| File | Lines | Changes |
|------|-------|---------|
| **pollingService.js** | 281, 306 | Add `txHash` parameter (2 calls) |
| **webhooks.js** | 84, 374, 435 | Add `txHash` from webhook (3 calls) |
| **invoiceQueries.js** | 74-80 | Update method signature + SQL |
| **db.js** | 960-967 | Update method signature + SQL |

**Total:** 7 files changes (5 call sites + 2 method definitions)

---

## Apply Migration:

```bash
cd backend
psql telegram_shop -f database/migrations/039_add_invoice_payment_details.sql
```

**Expected output:**
```
BEGIN
ALTER TABLE
ALTER TABLE
CREATE INDEX
COMMENT
COMMENT
COMMIT

 column_name | data_type | is_nullable | column_default
-------------+-----------+-------------+----------------
 paid_at     | timestamptz | YES       | NULL
 tx_hash     | varchar(255) | YES     | NULL
```

---

## Next Steps:

### 1. Apply Migration
```bash
cd /Users/sile/Documents/Status\ Stock\ 4.0/backend
psql telegram_shop -f database/migrations/039_add_invoice_payment_details.sql
```

### 2. Update Code (7 locations)
- [ ] `pollingService.js:281` - add txHash parameter
- [ ] `pollingService.js:306` - add txHash parameter
- [ ] `webhooks.js:84` - add webhookData.txId
- [ ] `webhooks.js:374` - add paymentData.hash
- [ ] `webhooks.js:435` - add paymentData.hash
- [ ] `invoiceQueries.js:74-80` - update method
- [ ] `db.js:960-967` - update method

### 3. Test with E2E scenario
```bash
# Run payment integration test
npm run test:integration -- webhooks.test.js
npm run test:integration -- subscription-payments.test.js
```

### 4. Verify in production (SQL check)
```sql
-- Check structure
\d invoices

-- Test query
SELECT id, status, paid_at, tx_hash
FROM invoices
WHERE status = 'paid'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Rollback Plan (if needed):

```sql
BEGIN;
DROP INDEX IF EXISTS idx_invoices_tx_hash;
ALTER TABLE invoices DROP COLUMN IF EXISTS tx_hash;
ALTER TABLE invoices DROP COLUMN IF EXISTS paid_at;
COMMIT;
```

---

## Benefits:

1. **Audit trail** - можно точно узнать когда invoice был оплачен
2. **Blockchain verification** - tx_hash позволяет проверить payment в блокчейне
3. **Debugging** - упрощает диагностику payment issues
4. **Analytics** - статистика по времени оплаты
5. **Backward compatible** - не ломает существующий код (nullable columns)

---

**Created:** 2025-11-15
**Migration:** 039
**Status:** Ready for apply
