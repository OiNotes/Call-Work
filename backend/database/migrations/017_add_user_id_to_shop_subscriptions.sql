-- ============================================
-- Migration: 017_add_user_id_to_shop_subscriptions
-- Description: Add user_id column and make shop_id nullable to support subscriptions before shop creation
-- Author: Database Designer
-- Date: 2025-11-01
-- Dependencies: 016_add_crypto_amount_to_invoices
-- ============================================

-- CONTEXT:
-- Critical bug fix: createPendingSubscription creates temporary shop BEFORE payment.
-- This is incorrect - shop should only exist AFTER confirmed payment.
-- Solution: Subscription can exist WITHOUT shop_id until payment is confirmed.

-- UP
BEGIN;

-- ============================================
-- 1. Add user_id column (initially nullable)
-- ============================================

ALTER TABLE shop_subscriptions
ADD COLUMN user_id INTEGER;

COMMENT ON COLUMN shop_subscriptions.user_id IS 'User who created subscription (before shop is created)';

-- ============================================
-- 2. Fill user_id for existing records
-- ============================================

UPDATE shop_subscriptions ss
SET user_id = s.owner_id
FROM shops s
WHERE ss.shop_id = s.id AND ss.user_id IS NULL;

-- ============================================
-- 3. Make user_id NOT NULL
-- ============================================

ALTER TABLE shop_subscriptions
ALTER COLUMN user_id SET NOT NULL;

-- ============================================
-- 4. Add foreign key constraint
-- ============================================

ALTER TABLE shop_subscriptions
ADD CONSTRAINT shop_subscriptions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================
-- 5. Make shop_id nullable
-- ============================================

ALTER TABLE shop_subscriptions
ALTER COLUMN shop_id DROP NOT NULL;

COMMENT ON COLUMN shop_subscriptions.shop_id IS 'Shop associated with subscription (NULL until payment confirmed)';

-- ============================================
-- 6. Create index for user_id lookups
-- ============================================

CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_user_id ON shop_subscriptions(user_id);

-- ============================================
-- 7. Update schema version
-- ============================================

INSERT INTO schema_migrations (version, name) VALUES (17, 'add_user_id_to_shop_subscriptions')
ON CONFLICT (version) DO UPDATE SET applied_at = NOW();

COMMIT;

-- ============================================
-- DOWN (Rollback)
-- ============================================
-- BEGIN;
--
-- -- Remove index
-- DROP INDEX IF EXISTS idx_shop_subscriptions_user_id;
--
-- -- Make shop_id NOT NULL again (will fail if NULL values exist)
-- ALTER TABLE shop_subscriptions ALTER COLUMN shop_id SET NOT NULL;
--
-- -- Remove foreign key constraint
-- ALTER TABLE shop_subscriptions DROP CONSTRAINT IF EXISTS shop_subscriptions_user_id_fkey;
--
-- -- Remove user_id column
-- ALTER TABLE shop_subscriptions DROP COLUMN IF EXISTS user_id;
--
-- -- Remove from schema_migrations
-- DELETE FROM schema_migrations WHERE version = 17;
--
-- COMMIT;
