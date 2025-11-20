-- Migration: Cleanup unused schema
-- Description: Remove unused table and columns
-- Date: 2025-11-08

-- ОСТОРОЖНО: Эта миграция удаляет данные!
-- Проверь production usage перед запуском!

-- 1. Drop unused table (NOT used in codebase)
DROP TABLE IF EXISTS channel_migrations CASCADE;

-- 2. Drop unused columns from orders table
-- payment_hash - replaced by invoices.address + payments.tx_hash
-- payment_address - replaced by invoices.address
ALTER TABLE orders DROP COLUMN IF EXISTS payment_hash;
ALTER TABLE orders DROP COLUMN IF EXISTS payment_address;
