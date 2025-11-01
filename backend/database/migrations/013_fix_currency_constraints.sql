-- ============================================
-- Migration: 013_fix_currency_constraints
-- Description: Add missing LTC and USDT_TRC20 support (removed USDT_ERC20)
-- Author: Database Designer
-- Date: 2025-11-01
-- Dependencies: 012_fix_subscription_payment_schema
-- ============================================

-- UP
BEGIN;

-- ============================================
-- 1. Fix payments.currency CHECK constraint
-- ============================================

-- Drop existing constraint
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_currency_check;

-- Add new constraint with all supported currencies
ALTER TABLE payments
ADD CONSTRAINT payments_currency_check CHECK (
  currency IN ('BTC', 'ETH', 'USDT', 'USDT_TRC20', 'LTC')
);

COMMENT ON COLUMN payments.currency IS 'Payment currency: BTC, ETH, USDT (legacy/TRC20), LTC';

-- ============================================
-- 2. Fix shop_subscriptions.currency CHECK constraint
-- ============================================

-- Drop existing constraint
ALTER TABLE shop_subscriptions
DROP CONSTRAINT IF EXISTS shop_subscriptions_currency_check;

-- Add new constraint with all supported currencies
ALTER TABLE shop_subscriptions
ADD CONSTRAINT shop_subscriptions_currency_check CHECK (
  currency IN ('BTC', 'ETH', 'USDT', 'USDT_TRC20', 'LTC')
);

COMMENT ON COLUMN shop_subscriptions.currency IS 'Payment currency: BTC, ETH, USDT (legacy/TRC20), LTC';

-- ============================================
-- 3. Update schema version
-- ============================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO schema_migrations (version, name) VALUES (13, 'fix_currency_constraints')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

COMMIT;

-- ============================================
-- DOWN (Rollback)
-- ============================================
-- BEGIN;
-- 
-- -- Restore old payments.currency constraint (without LTC and USDT_TRC20)
-- ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_currency_check;
-- ALTER TABLE payments ADD CONSTRAINT payments_currency_check CHECK (
--   currency IN ('BTC', 'ETH', 'USDT')
-- );
-- 
-- -- Restore old shop_subscriptions.currency constraint (without LTC and USDT_TRC20)
-- ALTER TABLE shop_subscriptions DROP CONSTRAINT IF EXISTS shop_subscriptions_currency_check;
-- ALTER TABLE shop_subscriptions ADD CONSTRAINT shop_subscriptions_currency_check CHECK (
--   currency IN ('BTC', 'ETH', 'USDT')
-- );
-- 
-- -- Remove from schema_migrations
-- DELETE FROM schema_migrations WHERE version = 13;
-- 
-- COMMIT;
