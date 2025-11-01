-- ============================================
-- Migration: 016_add_crypto_amount_to_invoices
-- Description: Add crypto_amount and usd_rate columns for USD → Crypto conversion tracking
-- Author: Backend Architect
-- Date: 2025-11-01
-- Dependencies: 015_add_pending_to_shops_status
-- ============================================

-- UP
BEGIN;

-- ============================================
-- 1. Add crypto_amount column (exact crypto units to pay)
-- ============================================

ALTER TABLE invoices
ADD COLUMN crypto_amount DECIMAL(20, 8);

COMMENT ON COLUMN invoices.crypto_amount IS 'Exact crypto amount to pay (USD converted at creation time)';

-- ============================================
-- 2. Add usd_rate column (exchange rate at invoice creation)
-- ============================================

ALTER TABLE invoices
ADD COLUMN usd_rate DECIMAL(20, 2);

COMMENT ON COLUMN invoices.usd_rate IS 'USD exchange rate at invoice creation time (e.g., $100,000 for BTC)';

-- ============================================
-- 3. Migrate existing invoices (optional: set NULL for old invoices)
-- ============================================

-- Note: Existing invoices with only expected_amount (USD) will have NULL crypto_amount.
-- This is acceptable as old invoices are likely expired or paid already.
-- New invoices will always have crypto_amount populated.

-- ============================================
-- 4. Update schema version
-- ============================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO schema_migrations (version, name) VALUES (16, 'add_crypto_amount_to_invoices')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

COMMIT;

-- ============================================
-- DOWN (Rollback)
-- ============================================
-- BEGIN;
--
-- -- Remove columns
-- ALTER TABLE invoices DROP COLUMN IF EXISTS crypto_amount;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS usd_rate;
--
-- -- Remove from schema_migrations
-- DELETE FROM schema_migrations WHERE version = 16;
--
-- COMMIT;
