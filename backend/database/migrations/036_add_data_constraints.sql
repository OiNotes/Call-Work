-- Migration: Add data integrity constraints
-- Description: Add missing CHECK constraints
-- Date: 2025-11-08

-- 1. Shop subscriptions: period_end must be after period_start
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_subscription_period'
  ) THEN
    ALTER TABLE shop_subscriptions 
    ADD CONSTRAINT check_subscription_period
    CHECK (period_end > period_start);
  END IF;
END $$;

-- 2. Invoices: crypto_amount must be positive when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_crypto_amount_positive'
  ) THEN
    ALTER TABLE invoices 
    ADD CONSTRAINT check_crypto_amount_positive
    CHECK (crypto_amount IS NULL OR crypto_amount > 0);
  END IF;
END $$;

-- 3. Products: reserved_quantity validation (may already exist)
-- Ensure reserved quantity doesn't exceed stock
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_reserved_quantity'
  ) THEN
    ALTER TABLE products 
    ADD CONSTRAINT check_reserved_quantity
    CHECK (stock_quantity >= reserved_quantity);
  END IF;
END $$;
