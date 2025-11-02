-- Migration 019: Rename wallet_ton to wallet_ltc
-- Replaces TON cryptocurrency support with LTC (Litecoin)

BEGIN;

-- Rename column in shops table
ALTER TABLE shops 
  RENAME COLUMN wallet_ton TO wallet_ltc;

-- Add comment for clarity
COMMENT ON COLUMN shops.wallet_ltc IS 'Litecoin wallet address for receiving payments';

COMMIT;
