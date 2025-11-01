-- ============================================
-- Migration 018: Add LTC to payments + shop_subscriptions currency constraints
-- ============================================
-- Date: 2025-11-01
-- Description: Add Litecoin (LTC) support to payments and shop_subscriptions currency constraints
-- Reason: System supports LTC payments but constraints don't allow them

-- ============================================
-- UP Migration
-- ============================================

BEGIN;

-- 1. Fix payments table constraint
ALTER TABLE payments
DROP CONSTRAINT IF EXISTS payments_currency_check;

ALTER TABLE payments
ADD CONSTRAINT payments_currency_check
CHECK (currency IN ('BTC', 'ETH', 'USDT', 'LTC'));

-- 2. Fix shop_subscriptions table constraint
ALTER TABLE shop_subscriptions
DROP CONSTRAINT IF EXISTS shop_subscriptions_currency_check;

ALTER TABLE shop_subscriptions
ADD CONSTRAINT shop_subscriptions_currency_check
CHECK (currency IN ('BTC', 'ETH', 'USDT', 'LTC'));

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify the constraints:

-- 1. Check payments constraint:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'payments'::regclass
-- AND conname = 'payments_currency_check';

-- 2. Check shop_subscriptions constraint:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'shop_subscriptions'::regclass
-- AND conname = 'shop_subscriptions_currency_check';

-- Test inserts (should work):
-- INSERT INTO payments (order_id, tx_hash, amount, currency, status)
-- VALUES (1, 'ltc_test_hash_12345', 100.00, 'LTC', 'pending');

-- INSERT INTO shop_subscriptions (user_id, tier, amount, tx_hash, currency, period_start, period_end)
-- VALUES (1, 'basic', 25.00, 'ltc_sub_test_12345', 'LTC', NOW(), NOW() + INTERVAL '30 days');

-- ============================================
-- DOWN Migration (Rollback)
-- ============================================
-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE payments DROP CONSTRAINT payments_currency_check;
-- ALTER TABLE payments ADD CONSTRAINT payments_currency_check CHECK (currency IN ('BTC', 'ETH', 'USDT'));
-- ALTER TABLE shop_subscriptions DROP CONSTRAINT shop_subscriptions_currency_check;
-- ALTER TABLE shop_subscriptions ADD CONSTRAINT shop_subscriptions_currency_check CHECK (currency IN ('BTC', 'ETH', 'USDT'));
-- COMMIT;
