-- Migration 034: Remove USDT ERC-20 Support
-- Date: 2025-11-09
-- Description: Remove USDT_ERC20 chain - only USDT_TRC20 (TRON) supported
--
-- Changes:
-- 1. Drop wallet_address_index_usdt_erc20 sequence
-- 2. Update invoices.chain CHECK constraint
-- 3. Verify no active invoices use USDT_ERC20

-- Safety check: Ensure no active USDT_ERC20 invoices
DO $$
DECLARE
  active_erc20_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_erc20_count
  FROM invoices
  WHERE chain = 'USDT_ERC20'
    AND status IN ('pending', 'confirmed');

  IF active_erc20_count > 0 THEN
    RAISE EXCEPTION 'Cannot remove USDT_ERC20: % active invoices still exist', active_erc20_count;
  END IF;

  RAISE NOTICE 'Safety check passed: No active USDT_ERC20 invoices found';
END $$;

-- 1. Drop USDT_ERC20 wallet address sequence
DROP SEQUENCE IF EXISTS wallet_address_index_usdt_erc20 CASCADE;

-- 2. Update invoices.chain CHECK constraint (remove USDT_ERC20)
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_chain_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_chain_check
  CHECK (chain IN ('BTC', 'ETH', 'LTC', 'USDT_TRC20'));

-- 3. Update comment to reflect new supported chains
COMMENT ON COLUMN invoices.chain IS 'Blockchain: BTC, ETH, LTC, USDT_TRC20 (TRON only)';

-- Summary
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 034 completed:';
  RAISE NOTICE '  - Dropped wallet_address_index_usdt_erc20 sequence';
  RAISE NOTICE '  - Updated invoices.chain constraint (removed USDT_ERC20)';
  RAISE NOTICE '  - USDT now only supports TRC-20 (TRON network)';
END $$;
