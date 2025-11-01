-- ============================================
-- Migration: 011_add_subscription_payment_automation
-- Description: Enable invoices table to handle subscription payments (reuse existing HD wallet infrastructure)
-- Author: Database Designer
-- Date: 2025-11-01
-- Dependencies: 003_add_invoices, 007_add_shop_tier_and_subscription_status
-- ============================================

-- UP
BEGIN;

-- 1. Add subscription_id column to invoices (nullable, mutually exclusive with order_id)
ALTER TABLE invoices
ADD COLUMN subscription_id INTEGER REFERENCES shop_subscriptions(id) ON DELETE CASCADE;

COMMENT ON COLUMN invoices.subscription_id IS 'Reference to subscription payment (mutually exclusive with order_id)';

-- 2. Make order_id nullable (invoices can now be for orders OR subscriptions)
ALTER TABLE invoices
ALTER COLUMN order_id DROP NOT NULL;

-- 3. Add constraint to ensure either order_id OR subscription_id is set (but not both)
ALTER TABLE invoices
ADD CONSTRAINT check_invoice_reference CHECK (
  (order_id IS NOT NULL AND subscription_id IS NULL) OR
  (order_id IS NULL AND subscription_id IS NOT NULL)
);

-- 4. Create index on subscription_id for fast subscription payment lookups
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);

-- 5. Create index on order_id (previously relied on implicit index, now explicit)
-- Note: This index may already exist from migration 003, using IF NOT EXISTS for safety
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);

-- 6. Update schema version
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO schema_migrations (version, name) VALUES (11, 'add_subscription_payment_automation')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

COMMIT;

-- ============================================
-- DOWN (Rollback)
-- ============================================
-- BEGIN;
-- 
-- -- Remove constraint
-- ALTER TABLE invoices DROP CONSTRAINT IF EXISTS check_invoice_reference;
-- 
-- -- Restore order_id NOT NULL constraint
-- -- WARNING: This will fail if there are invoices with NULL order_id
-- -- You must manually handle or delete subscription invoices before rollback
-- ALTER TABLE invoices ALTER COLUMN order_id SET NOT NULL;
-- 
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_invoices_subscription_id;
-- DROP INDEX IF EXISTS idx_invoices_order_id;
-- 
-- -- Remove subscription_id column
-- ALTER TABLE invoices DROP COLUMN IF EXISTS subscription_id;
-- 
-- -- Remove from schema_migrations
-- DELETE FROM schema_migrations WHERE version = 11;
-- 
-- COMMIT;
