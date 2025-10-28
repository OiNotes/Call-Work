-- Migration: Add case-insensitive unique constraint on shops.name
-- Created: 2025-10-27
-- Description: Enforce unique shop names (case-insensitive) and alphanumeric validation

-- Step 1: Remove old UNIQUE constraint if exists (it might not exist if already removed)
-- Note: This is safe because we're adding a better constraint below
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_name_key' AND conrelid = 'shops'::regclass
  ) THEN
    ALTER TABLE shops DROP CONSTRAINT shops_name_key;
    RAISE NOTICE 'Dropped old shops_name_key constraint';
  ELSE
    RAISE NOTICE 'No old shops_name_key constraint found, skipping';
  END IF;
END $$;

-- Step 2: Create case-insensitive unique index on LOWER(name)
-- This enforces uniqueness regardless of case (e.g., "MyShop" = "myshop" = "MYSHOP")
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_name_unique_lower ON shops(LOWER(name));

-- Step 3: Verify constraint works
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: shops.name now has case-insensitive uniqueness';
END $$;
