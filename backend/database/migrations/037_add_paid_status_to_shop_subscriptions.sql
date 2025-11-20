-- 037_add_paid_status_to_shop_subscriptions.sql
-- Adds explicit 'paid' state to shop_subscriptions.status constraint
-- so the backend can mark subscriptions as paid before activation.

BEGIN;

ALTER TABLE shop_subscriptions
  DROP CONSTRAINT IF EXISTS shop_subscriptions_status_check;

ALTER TABLE shop_subscriptions
  ADD CONSTRAINT shop_subscriptions_status_check
  CHECK (status IN ('active', 'pending', 'expired', 'cancelled', 'paid'));

COMMIT;
