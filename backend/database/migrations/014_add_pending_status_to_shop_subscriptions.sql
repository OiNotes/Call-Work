-- ============================================
-- Migration: Add 'pending' status to shop_subscriptions
-- ============================================
-- Purpose: Allow subscription payments to be in 'pending' state
-- before blockchain confirmation. This fixes the constraint violation
-- when creating new subscription records.
--
-- Changes:
-- - Drop old CHECK constraint on status column
-- - Add new CHECK constraint with 'pending' status included
-- ============================================

BEGIN;

-- Drop the old constraint
ALTER TABLE shop_subscriptions
  DROP CONSTRAINT IF EXISTS shop_subscriptions_status_check;

-- Add new constraint with 'pending' status
ALTER TABLE shop_subscriptions
  ADD CONSTRAINT shop_subscriptions_status_check
  CHECK (status IN ('active', 'pending', 'expired', 'cancelled'));

-- Update default value to 'pending'
ALTER TABLE shop_subscriptions
  ALTER COLUMN status SET DEFAULT 'pending';

-- Update column comment
COMMENT ON COLUMN shop_subscriptions.status IS 'pending: awaiting confirmation, active: valid, expired: period ended, cancelled: refunded';

COMMIT;

-- Verify the change
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'shop_subscriptions_status_check';
