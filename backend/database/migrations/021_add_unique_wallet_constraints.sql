-- ============================================
-- Migration: Add UNIQUE constraints on wallet addresses
-- Purpose: Prevent duplicate wallet addresses across different shops
-- Security: Ensures payment routing integrity and prevents wallet theft
-- Date: 2025-01-04
-- ============================================

BEGIN;

-- Create unique partial indexes (only for non-NULL values)
-- This allows NULL wallets but ensures uniqueness for actual addresses

CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_wallet_btc_unique 
  ON shops(wallet_btc) 
  WHERE wallet_btc IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_wallet_eth_unique 
  ON shops(wallet_eth) 
  WHERE wallet_eth IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_wallet_usdt_unique 
  ON shops(wallet_usdt) 
  WHERE wallet_usdt IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_wallet_ltc_unique 
  ON shops(wallet_ltc) 
  WHERE wallet_ltc IS NOT NULL;

-- Add descriptive comments
COMMENT ON INDEX idx_shops_wallet_btc_unique IS 
  'Ensures Bitcoin wallet addresses are unique across all shops (prevents payment routing conflicts)';

COMMENT ON INDEX idx_shops_wallet_eth_unique IS 
  'Ensures Ethereum wallet addresses are unique across all shops (prevents payment routing conflicts)';

COMMENT ON INDEX idx_shops_wallet_usdt_unique IS 
  'Ensures USDT wallet addresses are unique across all shops (prevents payment routing conflicts)';

COMMENT ON INDEX idx_shops_wallet_ltc_unique IS 
  'Ensures Litecoin wallet addresses are unique across all shops (prevents payment routing conflicts)';

COMMIT;
