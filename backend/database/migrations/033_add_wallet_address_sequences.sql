-- ============================================
-- Migration 033: Add PostgreSQL Sequences for Wallet Address Index Generation
-- ============================================
-- Date: 2025-11-07
-- Purpose: Fix race condition in getNextIndex() by using atomic SEQUENCE
--
-- Problem:
--   Current implementation uses SELECT MAX(address_index) + 1 which allows
--   race conditions where two concurrent requests can get the same index.
--
-- Solution:
--   Use PostgreSQL SEQUENCE for atomic, guaranteed-unique index generation.
--
-- Impact:
--   - Eliminates race conditions in wallet address generation
--   - Prevents duplicate address assignment
--   - Protects payment integrity
-- ============================================

-- Create sequences for each blockchain
-- Starting value will be set from current MAX(address_index) + 1

-- BTC sequence
CREATE SEQUENCE IF NOT EXISTS wallet_address_index_btc
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- ETH sequence (also used for USDT_ERC20)
CREATE SEQUENCE IF NOT EXISTS wallet_address_index_eth
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- USDT_ERC20 sequence (shares ETH derivation path)
CREATE SEQUENCE IF NOT EXISTS wallet_address_index_usdt_erc20
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- USDT_TRC20 sequence (TRON-based)
CREATE SEQUENCE IF NOT EXISTS wallet_address_index_usdt_trc20
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- LTC sequence
CREATE SEQUENCE IF NOT EXISTS wallet_address_index_ltc
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- Set starting values based on existing data
-- This ensures no index conflicts with existing invoices

DO $$
DECLARE
  max_btc INT;
  max_eth INT;
  max_usdt_erc20 INT;
  max_usdt_trc20 INT;
  max_ltc INT;
BEGIN
  -- Get max indices for each chain
  SELECT COALESCE(MAX(address_index), 0) INTO max_btc 
  FROM invoices WHERE chain = 'BTC';
  
  SELECT COALESCE(MAX(address_index), 0) INTO max_eth 
  FROM invoices WHERE chain = 'ETH';
  
  SELECT COALESCE(MAX(address_index), 0) INTO max_usdt_erc20 
  FROM invoices WHERE chain = 'USDT_ERC20';
  
  SELECT COALESCE(MAX(address_index), 0) INTO max_usdt_trc20 
  FROM invoices WHERE chain = 'USDT_TRC20';
  
  SELECT COALESCE(MAX(address_index), 0) INTO max_ltc 
  FROM invoices WHERE chain = 'LTC';
  
  -- Set sequence starting values to max + 1
  PERFORM setval('wallet_address_index_btc', max_btc + 1, false);
  PERFORM setval('wallet_address_index_eth', max_eth + 1, false);
  PERFORM setval('wallet_address_index_usdt_erc20', max_usdt_erc20 + 1, false);
  PERFORM setval('wallet_address_index_usdt_trc20', max_usdt_trc20 + 1, false);
  PERFORM setval('wallet_address_index_ltc', max_ltc + 1, false);
  
  -- Log the initial values
  RAISE NOTICE 'Wallet address sequences initialized:';
  RAISE NOTICE '  BTC: starting at %', max_btc + 1;
  RAISE NOTICE '  ETH: starting at %', max_eth + 1;
  RAISE NOTICE '  USDT_ERC20: starting at %', max_usdt_erc20 + 1;
  RAISE NOTICE '  USDT_TRC20: starting at %', max_usdt_trc20 + 1;
  RAISE NOTICE '  LTC: starting at %', max_ltc + 1;
END $$;

-- Add comments for documentation
COMMENT ON SEQUENCE wallet_address_index_btc IS 'Atomic counter for BTC wallet address derivation index';
COMMENT ON SEQUENCE wallet_address_index_eth IS 'Atomic counter for ETH wallet address derivation index';
COMMENT ON SEQUENCE wallet_address_index_usdt_erc20 IS 'Atomic counter for USDT (ERC-20) wallet address derivation index';
COMMENT ON SEQUENCE wallet_address_index_usdt_trc20 IS 'Atomic counter for USDT (TRC-20) wallet address derivation index';
COMMENT ON SEQUENCE wallet_address_index_ltc IS 'Atomic counter for LTC wallet address derivation index';

-- Verify sequences created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename LIKE 'wallet_address_index_%') THEN
    RAISE NOTICE '✅ Migration 033 completed successfully - wallet address sequences created';
  ELSE
    RAISE EXCEPTION '❌ Migration 033 failed - sequences not found';
  END IF;
END $$;
