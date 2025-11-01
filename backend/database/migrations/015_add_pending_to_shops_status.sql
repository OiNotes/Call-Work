-- Migration: Add 'pending' status to shops.subscription_status
-- Date: 2025-11-01
-- Description: Allow shops to have 'pending' subscription status before payment is confirmed

BEGIN;

-- Drop existing constraint
ALTER TABLE shops
DROP CONSTRAINT IF EXISTS shops_subscription_status_check;

-- Add new constraint with 'pending' status
ALTER TABLE shops
ADD CONSTRAINT shops_subscription_status_check
CHECK (subscription_status IN ('active', 'pending', 'grace_period', 'inactive'));

-- Update comment
COMMENT ON COLUMN shops.subscription_status IS 'Subscription status: active (paid), pending (awaiting payment), grace_period (overdue but still active), inactive (expired)';

COMMIT;
