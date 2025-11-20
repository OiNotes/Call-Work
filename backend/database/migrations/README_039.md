# Migration 039: Add Payment Details to Invoices

## Purpose
Add `paid_at` and `tx_hash` columns to invoices table for:
- Better payment tracking
- Blockchain transaction verification
- Audit trail
- Debugging payment issues

## Changes

### New Columns:
1. **paid_at** (TIMESTAMPTZ)
   - When: Set when invoice.status changes to 'paid'
   - Null: For pending/expired/cancelled invoices
   - Timezone: UTC (TIMESTAMPTZ)

2. **tx_hash** (VARCHAR(255))
   - Blockchain transaction hash
   - Examples:
     - BTC: 64 chars hex
     - ETH: 66 chars (0x + 64 hex)
     - TRC20: 64 chars hex
   - Indexed for fast lookup

### New Index:
- `idx_invoices_tx_hash` - partial index (only for non-null tx_hash)

## Apply Migration

```bash
cd backend
psql telegram_shop -f database/migrations/039_add_invoice_payment_details.sql
```

## Rollback (if needed)

```sql
BEGIN;
DROP INDEX IF EXISTS idx_invoices_tx_hash;
ALTER TABLE invoices DROP COLUMN IF EXISTS tx_hash;
ALTER TABLE invoices DROP COLUMN IF EXISTS paid_at;
COMMIT;
```

## Impact on Code

### Update locations:
1. **pollingService.js** (2 locations) - set paid_at and tx_hash when confirming payment
2. **webhooks.js** (3 locations) - set tx_hash from webhook payload
3. **invoiceQueries.js** - update `updateStatus` method signature

### Example:
```javascript
// Before:
await invoiceQueries.updateStatus(invoice.id, 'paid');

// After:
await invoiceQueries.updateStatus(invoice.id, 'paid', txHash);
```

## Testing

```sql
-- Create test invoice
INSERT INTO invoices (order_id, chain, address, address_index, expected_amount, currency, expires_at, created_at)
VALUES (1, 'BTC', 'test_address', 1, 0.001, 'BTC', NOW() + INTERVAL '1 hour', NOW());

-- Simulate payment
UPDATE invoices
SET status = 'paid',
    paid_at = NOW(),
    tx_hash = 'test_hash_123'
WHERE address = 'test_address';

-- Verify
SELECT id, status, paid_at, tx_hash FROM invoices WHERE address = 'test_address';
```

## Notes

- Migration is **idempotent** (uses `IF NOT EXISTS`)
- Does NOT break existing code (columns are nullable)
- Index is partial (only for non-null tx_hash) for better performance
