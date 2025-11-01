-- ============================================
-- Migration: 012_fix_subscription_payment_schema
-- Description: Fix payments table to support subscription payments + add missing updated_at to shop_subscriptions
-- Author: Database Designer
-- Date: 2025-11-01
-- Dependencies: 011_add_subscription_payment_automation
-- ============================================

-- UP
BEGIN;

-- ============================================
-- 1. Fix payments table: add subscription_id column
-- ============================================

-- Make order_id nullable (payments can now be for orders OR subscriptions)
ALTER TABLE payments
ALTER COLUMN order_id DROP NOT NULL;

-- Add subscription_id column (nullable, mutually exclusive with order_id)
ALTER TABLE payments
ADD COLUMN subscription_id INTEGER REFERENCES shop_subscriptions(id) ON DELETE CASCADE;

COMMENT ON COLUMN payments.subscription_id IS 'Reference to subscription payment (mutually exclusive with order_id)';

-- Add constraint to ensure either order_id OR subscription_id is set (but not both)
ALTER TABLE payments
ADD CONSTRAINT check_payment_reference CHECK (
  (order_id IS NOT NULL AND subscription_id IS NULL) OR
  (order_id IS NULL AND subscription_id IS NOT NULL)
);

-- Create index on subscription_id for fast subscription payment lookups
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);

-- ============================================
-- 2. Add updated_at to shop_subscriptions
-- ============================================

-- Add updated_at column (needed by pollingService)
ALTER TABLE shop_subscriptions
ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

COMMENT ON COLUMN shop_subscriptions.updated_at IS 'Last update timestamp (used by pollingService for payment verification)';

-- Create trigger to auto-update updated_at on row changes
CREATE TRIGGER update_shop_subscriptions_updated_at
BEFORE UPDATE ON shop_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Update schema version
-- ============================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO schema_migrations (version, name) VALUES (12, 'fix_subscription_payment_schema')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

COMMIT;

-- ============================================
-- DOWN (Rollback)
-- ============================================
-- BEGIN;
-- 
-- -- Remove trigger
-- DROP TRIGGER IF EXISTS update_shop_subscriptions_updated_at ON shop_subscriptions;
-- 
-- -- Remove updated_at column
-- ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS updated_at;
-- 
-- -- Remove payment constraints and columns
-- ALTER TABLE payments DROP CONSTRAINT IF EXISTS check_payment_reference;
-- DROP INDEX IF EXISTS idx_payments_subscription_id;
-- ALTER TABLE payments DROP COLUMN IF EXISTS subscription_id;
-- 
-- -- Restore order_id NOT NULL constraint
-- -- WARNING: This will fail if there are payments with NULL order_id
-- -- You must manually handle or delete subscription payments before rollback
-- ALTER TABLE payments ALTER COLUMN order_id SET NOT NULL;
-- 
-- -- Remove from schema_migrations
-- DELETE FROM schema_migrations WHERE version = 12;
-- 
-- COMMIT;
