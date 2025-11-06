-- Migration: Add 'expired' status for orders
-- Date: 2025-11-06
-- Description: Add support for auto-expiring orders after 7 days without fulfillment
-- Supports: pending and confirmed orders that exceed 7-day timeout

-- 1. Update orders status constraint to include 'expired'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'expired'));

-- 2. Create index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_orders_created_status ON orders(created_at, status)
WHERE status IN ('pending', 'confirmed');

-- 3. Add migration metadata
INSERT INTO schema_migrations (migration_name)
VALUES ('add_expired_status')
ON CONFLICT (migration_name) DO NOTHING;

-- Rollback SQL (save separately if needed):
/*
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'));
DROP INDEX IF EXISTS idx_orders_created_status;
DELETE FROM schema_migrations WHERE migration_name = 'add_expired_status';
*/
