-- ============================================
-- Migration 039: Add payment details to invoices
-- ============================================
-- Add paid_at and tx_hash columns for better payment tracking
-- ============================================

BEGIN;

-- 1. Add paid_at column (timestamp when payment was confirmed)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add tx_hash column (blockchain transaction hash)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(255) DEFAULT NULL;

-- 3. Add index for quick lookup by tx_hash
CREATE INDEX IF NOT EXISTS idx_invoices_tx_hash
ON invoices(tx_hash)
WHERE tx_hash IS NOT NULL;

-- 4. Add comments
COMMENT ON COLUMN invoices.paid_at IS 'Timestamp when payment was confirmed (blockchain)';
COMMENT ON COLUMN invoices.tx_hash IS 'Blockchain transaction hash';

COMMIT;

-- Verify
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN ('paid_at', 'tx_hash')
ORDER BY column_name;
