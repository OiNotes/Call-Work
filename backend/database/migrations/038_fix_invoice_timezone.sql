-- ============================================
-- Migration 038: Fix invoice timezone issues
-- ============================================
-- Problem: TIMESTAMP (without timezone) causes mismatch between JavaScript UTC and PostgreSQL local time
--          - JavaScript generates expires_at in UTC: new Date(Date.now() + 30*60*1000)
--          - PostgreSQL server timezone = Europe/Moscow (UTC+3)
--          - TIMESTAMP columns lose timezone info on INSERT
--          - NOW() in PostgreSQL returns Moscow time (UTC+3)
--          - Result: expires_at > NOW() fails immediately after INSERT (invoice appears expired)
--
-- Solution: Change to TIMESTAMPTZ (with timezone) to ensure consistent UTC handling
-- ============================================

BEGIN;

-- Backup existing data (for safety)
-- Migration log will show before/after state

-- 1. Change expires_at to TIMESTAMPTZ
-- USING clause converts existing TIMESTAMP values assuming they are UTC
ALTER TABLE invoices
ALTER COLUMN expires_at TYPE TIMESTAMPTZ
USING expires_at AT TIME ZONE 'UTC';

-- 2. Change created_at to TIMESTAMPTZ for consistency
ALTER TABLE invoices
ALTER COLUMN created_at TYPE TIMESTAMPTZ
USING created_at AT TIME ZONE 'UTC';

-- 3. Change updated_at to TIMESTAMPTZ for consistency
ALTER TABLE invoices
ALTER COLUMN updated_at TYPE TIMESTAMPTZ
USING updated_at AT TIME ZONE 'UTC';

COMMIT;

-- Verify changes
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
  AND column_name IN ('expires_at', 'created_at', 'updated_at')
ORDER BY column_name;

-- Test query (should work correctly after migration)
-- Example: SELECT * FROM invoices WHERE subscription_id = X AND status = 'pending' AND expires_at > NOW();
