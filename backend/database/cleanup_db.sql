-- ============================================
-- CLEANUP SCRIPT - Remove ALL test data
-- ============================================
-- Удаляет все тестовые данные, кроме реального пользователя
-- User ID 8 (telegram_id: 1997815787, Sithil15) останется
-- ============================================

BEGIN;

-- ============================================
-- 1. Delete all shop_follows (will cascade to synced_products)
-- ============================================
DELETE FROM shop_follows;

-- ============================================
-- 2. Delete all subscriptions
-- ============================================
DELETE FROM subscriptions;

-- ============================================
-- 3. Delete all shop_workers
-- ============================================
DELETE FROM shop_workers;

-- ============================================
-- 4. Delete all order_items (no FK cascade)
-- ============================================
DELETE FROM order_items;

-- ============================================
-- 5. Delete all orders
-- ============================================
DELETE FROM orders;

-- ============================================
-- 6. Delete all payments
-- ============================================
DELETE FROM payments;

-- ============================================
-- 7. Delete all invoices
-- ============================================
DELETE FROM invoices;

-- ============================================
-- 8. Delete all shop_subscriptions
-- ============================================
DELETE FROM shop_subscriptions;

-- ============================================
-- 9. Delete all products (will be removed when shops are deleted anyway)
-- ============================================
DELETE FROM products;

-- ============================================
-- 10. Delete all test shops (NOT user's shop "bobi")
-- ============================================
-- Удаляем только магазины тестовых пользователей
DELETE FROM shops WHERE owner_id IN (
  SELECT id FROM users WHERE telegram_id IN (444444444, 555555555, 666666666, 777777777)
);

-- ============================================
-- 11. Delete all test users (NOT the real user)
-- ============================================
-- Удаляем только тестовых пользователей
DELETE FROM users WHERE telegram_id IN (444444444, 555555555, 666666666, 777777777);

-- ============================================
-- 12. Reset sequences (optional, for clean IDs)
-- ============================================
-- Не сбрасываем users и shops, так как у вас уже есть реальные данные
-- Сбрасываем только таблицы, которые были полностью очищены
SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 0) FROM products) + 1, false);
SELECT setval('orders_id_seq', (SELECT COALESCE(MAX(id), 0) FROM orders) + 1, false);
SELECT setval('shop_follows_id_seq', (SELECT COALESCE(MAX(id), 0) FROM shop_follows) + 1, false);
SELECT setval('synced_products_id_seq', (SELECT COALESCE(MAX(id), 0) FROM synced_products) + 1, false);
SELECT setval('subscriptions_id_seq', (SELECT COALESCE(MAX(id), 0) FROM subscriptions) + 1, false);
SELECT setval('payments_id_seq', (SELECT COALESCE(MAX(id), 0) FROM payments) + 1, false);
SELECT setval('order_items_id_seq', (SELECT COALESCE(MAX(id), 0) FROM order_items) + 1, false);
SELECT setval('shop_subscriptions_id_seq', (SELECT COALESCE(MAX(id), 0) FROM shop_subscriptions) + 1, false);
SELECT setval('shop_workers_id_seq', (SELECT COALESCE(MAX(id), 0) FROM shop_workers) + 1, false);

COMMIT;

-- ============================================
-- Verification - Check cleanup results
-- ============================================
SELECT 
  'CLEANUP COMPLETE' as status,
  (SELECT COUNT(*) FROM users) as remaining_users,
  (SELECT COUNT(*) FROM shops) as remaining_shops,
  (SELECT COUNT(*) FROM products) as remaining_products,
  (SELECT COUNT(*) FROM orders) as remaining_orders,
  (SELECT COUNT(*) FROM shop_follows) as remaining_follows,
  (SELECT COUNT(*) FROM synced_products) as remaining_synced;

-- Should show: 1 user (Sithil15), 1 shop (bobi), 0 everything else
SELECT 'Remaining User:' as info, id, telegram_id, username, selected_role FROM users;
SELECT 'Remaining Shop:' as info, id, name, owner_id FROM shops;
