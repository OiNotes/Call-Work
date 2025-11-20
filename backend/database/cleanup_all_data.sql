-- ============================================
-- Safe Database Cleanup Script
-- Telegram E-Commerce Platform (telegram_shop)
-- ============================================
-- This script removes ALL data from tables while preserving:
-- - Table structure
-- - Indexes
-- - Constraints
-- - Triggers
-- - Sequences (reset to 1)
-- ============================================

BEGIN;

-- Disable triggers temporarily for faster cleanup
SET session_replication_role = replica;

-- ============================================
-- Clean data in correct order (respecting FK constraints)
-- ============================================

-- 1. Clean most dependent tables first
TRUNCATE TABLE processed_webhooks RESTART IDENTITY CASCADE;
TRUNCATE TABLE synced_products RESTART IDENTITY CASCADE;
TRUNCATE TABLE shop_follows RESTART IDENTITY CASCADE;
TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE invoices RESTART IDENTITY CASCADE;

-- 2. Clean intermediate tables
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;
TRUNCATE TABLE subscriptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE promo_activations RESTART IDENTITY CASCADE;
TRUNCATE TABLE shop_workers RESTART IDENTITY CASCADE;
TRUNCATE TABLE shop_subscriptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE shop_payments RESTART IDENTITY CASCADE;

-- 3. Clean promo_codes table if exists
TRUNCATE TABLE promo_codes RESTART IDENTITY CASCADE;

-- 4. Clean shops table
TRUNCATE TABLE shops RESTART IDENTITY CASCADE;

-- 5. Clean users table (least dependencies)
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- ============================================
-- Verification: Count all rows
-- ============================================
SELECT 
  'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'shops', COUNT(*) FROM shops
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'shop_subscriptions', COUNT(*) FROM shop_subscriptions
UNION ALL
SELECT 'shop_payments', COUNT(*) FROM shop_payments
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'shop_follows', COUNT(*) FROM shop_follows
UNION ALL
SELECT 'synced_products', COUNT(*) FROM synced_products
UNION ALL
SELECT 'shop_workers', COUNT(*) FROM shop_workers
UNION ALL
SELECT 'promo_activations', COUNT(*) FROM promo_activations
UNION ALL
SELECT 'promo_codes', COUNT(*) FROM promo_codes
UNION ALL
SELECT 'processed_webhooks', COUNT(*) FROM processed_webhooks
ORDER BY table_name;

COMMIT;

-- ============================================
-- Verify sequences are reset (next value = 1)
-- ============================================
SELECT 
  schemaname || '.' || sequencename as sequence_full_name,
  CASE 
    WHEN NOT is_called THEN 'Ready (next: 1)'
    ELSE 'Last value: ' || last_value::text
  END as status
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;
