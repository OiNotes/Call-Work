-- ============================================
-- Migration 010: Wallet Address Unique Constraints
-- ============================================
-- Purpose: Prevent wallet address reuse across shops
-- Risk: Payment attribution ambiguity if multiple shops use same address
-- Fix: Add UNIQUE constraints with NULL support

BEGIN;

-- Check for existing duplicate wallets before migration
DO $$
DECLARE
  btc_duplicates INT;
  eth_duplicates INT;
  usdt_duplicates INT;
  ltc_duplicates INT;
BEGIN
  -- Count duplicates for each wallet type (excluding NULLs)
  SELECT COUNT(*) INTO btc_duplicates
  FROM (
    SELECT wallet_btc FROM shops
    WHERE wallet_btc IS NOT NULL
    GROUP BY wallet_btc HAVING COUNT(*) > 1
  ) AS dups;

  SELECT COUNT(*) INTO eth_duplicates
  FROM (
    SELECT wallet_eth FROM shops
    WHERE wallet_eth IS NOT NULL
    GROUP BY wallet_eth HAVING COUNT(*) > 1
  ) AS dups;

  SELECT COUNT(*) INTO usdt_duplicates
  FROM (
    SELECT wallet_usdt FROM shops
    WHERE wallet_usdt IS NOT NULL
    GROUP BY wallet_usdt HAVING COUNT(*) > 1
  ) AS dups;

  SELECT COUNT(*) INTO ltc_duplicates
  FROM (
    SELECT wallet_ltc FROM shops
    WHERE wallet_ltc IS NOT NULL
    GROUP BY wallet_ltc HAVING COUNT(*) > 1
  ) AS dups;

  -- Report findings
  IF btc_duplicates > 0 OR eth_duplicates > 0 OR usdt_duplicates > 0 OR ltc_duplicates > 0 THEN
    RAISE WARNING 'MIGRATION WARNING: Found duplicate wallets before constraint addition:';
    RAISE WARNING '  - BTC duplicates: %', btc_duplicates;
    RAISE WARNING '  - ETH duplicates: %', eth_duplicates;
    RAISE WARNING '  - USDT duplicates: %', usdt_duplicates;
    RAISE WARNING '  - LTC duplicates: %', ltc_duplicates;
    RAISE WARNING 'Manual cleanup required before migration can proceed!';
    RAISE EXCEPTION 'Cannot apply UNIQUE constraints with existing duplicates';
  ELSE
    RAISE NOTICE 'Pre-migration check: No duplicate wallets found. Safe to proceed.';
  END IF;
END $$;

-- Add UNIQUE constraints on wallet columns
-- PostgreSQL allows multiple NULLs with partial indexes
ALTER TABLE shops ADD CONSTRAINT shops_wallet_btc_unique 
  UNIQUE (wallet_btc);

ALTER TABLE shops ADD CONSTRAINT shops_wallet_eth_unique 
  UNIQUE (wallet_eth);

ALTER TABLE shops ADD CONSTRAINT shops_wallet_usdt_unique 
  UNIQUE (wallet_usdt);

ALTER TABLE shops ADD CONSTRAINT shops_wallet_ltc_unique 
  UNIQUE (wallet_ltc);

-- Add indexes for faster wallet lookups (used in payment verification)
CREATE INDEX IF NOT EXISTS idx_shops_wallet_btc ON shops(wallet_btc) WHERE wallet_btc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shops_wallet_eth ON shops(wallet_eth) WHERE wallet_eth IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shops_wallet_usdt ON shops(wallet_usdt) WHERE wallet_usdt IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shops_wallet_ltc ON shops(wallet_ltc) WHERE wallet_ltc IS NOT NULL;

COMMIT;

-- Verification query (run after migration)
-- SELECT 
--   'wallet_btc' as wallet_type,
--   COUNT(DISTINCT wallet_btc) as unique_count,
--   COUNT(wallet_btc) as total_count
-- FROM shops WHERE wallet_btc IS NOT NULL
-- UNION ALL
-- SELECT 'wallet_eth', COUNT(DISTINCT wallet_eth), COUNT(wallet_eth)
-- FROM shops WHERE wallet_eth IS NOT NULL
-- UNION ALL
-- SELECT 'wallet_usdt', COUNT(DISTINCT wallet_usdt), COUNT(wallet_usdt)
-- FROM shops WHERE wallet_usdt IS NOT NULL
-- UNION ALL
-- SELECT 'wallet_ltc', COUNT(DISTINCT wallet_ltc), COUNT(wallet_ltc)
-- FROM shops WHERE wallet_ltc IS NOT NULL;
-- Expected: unique_count = total_count for all wallet types
