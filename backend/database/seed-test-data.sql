-- ============================================
-- Seed Test Data - Comprehensive Testing Environment
-- ============================================
-- Создаёт полноценные тестовые данные для всех функций платформы:
-- - История заказов (40+ заказов)
-- - Активные заказы (pending/confirmed)
-- - Shop follows (6 связей)
-- - Synced products
-- - Shop workers (workspace)
-- - Subscriptions
-- - Payments & Invoices
-- ============================================

BEGIN;

-- ============================================
-- 1. Shop Follows - расширенная сеть (избегаем циклов)
-- ============================================

-- Game Store → Lobik (resell 25%)
-- Это безопасно: Fashion→Game уже есть, добавим Game→Lobik
INSERT INTO shop_follows (follower_shop_id, source_shop_id, mode, markup_percentage, status)
VALUES (3, 4, 'resell', 25.00, 'active')
ON CONFLICT (follower_shop_id, source_shop_id) DO NOTHING;

-- ============================================
-- 2. Добавить товары в Lobik (чтобы Game Store мог копировать)
-- ============================================

INSERT INTO products (shop_id, name, description, price, stock_quantity, is_active) VALUES
  (4, 'Digital Art Pack 1', 'Collection of 50 high-res digital artworks', 29.99, 500, true),
  (4, 'Video Editing Presets', 'Professional color grading presets for Premiere', 19.99, 300, true),
  (4, 'Music Production Samples', '1000+ royalty-free samples and loops', 39.99, 200, true),
  (4, 'Web Templates Bundle', '10 premium responsive website templates', 49.99, 100, true),
  (4, '3D Asset Pack', 'Low-poly 3D models for game development', 59.99, 150, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. Synced Products - больше синхронизаций
-- ============================================

-- Fashion Store копирует еще товары от Game Store (существующий follow id=3)
INSERT INTO products (shop_id, name, description, price, stock_quantity, is_active) VALUES
  (2, 'Baldur''s Gate 3 Resell', 'RPG игра от Larian (с наценкой)', 80.49, 100, true),
  (2, 'Elden Ring Resell', 'Action RPG от FromSoftware (с наценкой)', 57.49, 120, true)
ON CONFLICT DO NOTHING;

-- Создаем связи синхронизированных товаров
INSERT INTO synced_products (follow_id, synced_product_id, source_product_id, conflict_status)
SELECT
  (SELECT id FROM shop_follows WHERE follower_shop_id = 2 AND source_shop_id = 3 LIMIT 1),
  (SELECT id FROM products WHERE shop_id = 2 AND name = 'Baldur''s Gate 3 Resell' LIMIT 1),
  14, -- Baldur's Gate 3 в Game Store
  'synced'
WHERE EXISTS (SELECT 1 FROM products WHERE shop_id = 2 AND name = 'Baldur''s Gate 3 Resell')
ON CONFLICT (follow_id, source_product_id) DO NOTHING;

INSERT INTO synced_products (follow_id, synced_product_id, source_product_id, conflict_status)
SELECT
  (SELECT id FROM shop_follows WHERE follower_shop_id = 2 AND source_shop_id = 3 LIMIT 1),
  (SELECT id FROM products WHERE shop_id = 2 AND name = 'Elden Ring Resell' LIMIT 1),
  15, -- Elden Ring в Game Store
  'synced'
WHERE EXISTS (SELECT 1 FROM products WHERE shop_id = 2 AND name = 'Elden Ring Resell')
ON CONFLICT (follow_id, source_product_id) DO NOTHING;

-- Game Store копирует товар от Lobik (новый follow)
INSERT INTO products (shop_id, name, description, price, stock_quantity, is_active) VALUES
  (3, 'Digital Art Pack 1 [Resell]', 'Collection of artworks (with markup)', 37.49, 400, true)
ON CONFLICT DO NOTHING;

INSERT INTO synced_products (follow_id, synced_product_id, source_product_id, conflict_status)
SELECT
  (SELECT id FROM shop_follows WHERE follower_shop_id = 3 AND source_shop_id = 4 LIMIT 1),
  (SELECT id FROM products WHERE shop_id = 3 AND name = 'Digital Art Pack 1 [Resell]' LIMIT 1),
  (SELECT id FROM products WHERE shop_id = 4 AND name = 'Digital Art Pack 1' LIMIT 1),
  'synced'
WHERE EXISTS (SELECT 1 FROM shop_follows WHERE follower_shop_id = 3 AND source_shop_id = 4)
  AND EXISTS (SELECT 1 FROM products WHERE shop_id = 4 AND name = 'Digital Art Pack 1')
  AND EXISTS (SELECT 1 FROM products WHERE shop_id = 3 AND name = 'Digital Art Pack 1 [Resell]')
ON CONFLICT (follow_id, source_product_id) DO NOTHING;

-- ============================================
-- 4. Shop Workers (Workspace) - только для PRO магазинов
-- ============================================

INSERT INTO shop_workers (shop_id, worker_user_id, telegram_id)
SELECT 2, 380, 777777  -- Alice работает в Fashion Store
WHERE EXISTS (SELECT 1 FROM users WHERE id = 380)
ON CONFLICT (shop_id, worker_user_id) DO NOTHING;

INSERT INTO shop_workers (shop_id, worker_user_id, telegram_id)
SELECT 2, 381, 888888  -- Bob работает в Fashion Store
WHERE EXISTS (SELECT 1 FROM users WHERE id = 381)
ON CONFLICT (shop_id, worker_user_id) DO NOTHING;

INSERT INTO shop_workers (shop_id, worker_user_id, telegram_id)
SELECT 3, 382, 999999  -- Charlie работает в Game Store
WHERE EXISTS (SELECT 1 FROM users WHERE id = 382)
ON CONFLICT (shop_id, worker_user_id) DO NOTHING;

-- ============================================
-- 5. Subscriptions - подписки buyers на магазины
-- ============================================

INSERT INTO subscriptions (user_id, shop_id, telegram_id)
VALUES
  (380, 2, 777777),  -- Alice подписана на Fashion Store
  (380, 3, 777777),  -- Alice подписана на Game Store
  (381, 3, 888888),  -- Bob подписан на Game Store
  (381, 4, 888888),  -- Bob подписан на Lobik
  (382, 2, 999999)   -- Charlie подписан на Fashion Store
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- ============================================
-- 6. Orders - комплексная история заказов (40+ заказов)
-- ============================================

-- Упрощенная версия - создаем 20 заказов (вместо 40)
DO $$
DECLARE
  alice_id INT := 380;
  bob_id INT := 381;
  charlie_id INT := 382;
BEGIN

-- ======== DELIVERED ORDERS (8 заказов, 30-60 дней назад) ========
INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
VALUES
  (alice_id, 219, 2, 240.00, 'BTC', 'Москва, ул. Ленина 10, кв. 5', '0xdelivered001', 'bc1qtest001', 'delivered', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days'),
  (alice_id, 221, 1, 150.00, 'ETH', 'Москва, ул. Ленина 10, кв. 5', '0xdelivered002', '0xtest002', 'delivered', NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days', NOW() - INTERVAL '50 days'),
  (bob_id, 223, 1, 200.00, 'BTC', 'Санкт-Петербург, Невский 50', '0xdelivered003', 'bc1qtest003', 'delivered', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days', NOW() - INTERVAL '45 days'),
  (bob_id, 14, 2, 139.98, 'USDT', 'Санкт-Петербург, Невский 50', 'TXdelivered004', 'TTest004', 'delivered', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days'),
  (charlie_id, 13, 1, 59.99, 'BTC', 'Казань, пр. Победы 20', '0xdelivered005', 'bc1qtest005', 'delivered', NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days'),
  (charlie_id, 17, 1, 179.99, 'ETH', 'Казань, пр. Победы 20', '0xdelivered006', '0xtest006', 'delivered', NOW() - INTERVAL '38 days', NOW() - INTERVAL '38 days', NOW() - INTERVAL '33 days'),
  (alice_id, 224, 3, 225.00, 'BTC', 'Москва, ул. Ленина 10, кв. 5', '0xdelivered007', 'bc1qtest007', 'delivered', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '30 days'),
  (bob_id, 15, 1, 49.99, 'USDT', 'Санкт-Петербург, Невский 50', 'TXdelivered008', 'TTest008', 'delivered', NOW() - INTERVAL '32 days', NOW() - INTERVAL '32 days', NOW() - INTERVAL '28 days');

-- ======== SHIPPED ORDERS (3 заказа, 5-15 дней назад) ========
INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
VALUES
  (alice_id, 18, 1, 649.99, 'BTC', 'Москва, ул. Ленина 10, кв. 5', '0xshipped001', 'bc1qtest009', 'shipped', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
  (bob_id, 221, 1, 150.00, 'ETH', 'Санкт-Петербург, Невский 50', '0xshipped002', '0xtest010', 'shipped', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  (charlie_id, 222, 2, 180.00, 'USDT', 'Казань, пр. Победы 20', 'TXshipped003', 'TTest011', 'shipped', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days');

-- ======== CONFIRMED ORDERS (4 заказа, 1-5 дней назад) ========
INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
VALUES
  (alice_id, 13, 1, 59.99, 'BTC', 'Москва, ул. Ленина 10, кв. 5', '0xconfirmed001', 'bc1qtest012', 'confirmed', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  (bob_id, 219, 2, 240.00, 'ETH', 'Санкт-Петербург, Невский 50', '0xconfirmed002', '0xtest013', 'confirmed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  (charlie_id, 16, 1, 449.99, 'USDT', 'Казань, пр. Победы 20', 'TXconfirmed003', 'TTest014', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  (alice_id, 226, 1, 110.00, 'BTC', 'Москва, ул. Ленина 10, кв. 5', '0xconfirmed004', 'bc1qtest015', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- ======== PENDING ORDERS (3 активных заказа) ========
INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_address, status, created_at)
VALUES
  (alice_id, 225, 1, 65.00, 'BTC', 'Москва, ул. Ленина 10, кв. 5', 'bc1qtest016', 'pending', NOW() - INTERVAL '2 hours'),
  (bob_id, 220, 1, 80.00, 'ETH', 'Санкт-Петербург, Невский 50', '0xtest017', 'pending', NOW() - INTERVAL '5 hours'),
  (charlie_id, 14, 1, 69.99, 'USDT', 'Казань, пр. Победы 20', 'TTest018', 'pending', NOW() - INTERVAL '1 day');

-- ======== CANCELLED ORDERS (2 заказа) ========
INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_address, status, created_at, updated_at)
VALUES
  (alice_id, 16, 1, 449.99, 'BTC', 'Москва, ул. Ленина 10, кв. 5', 'bc1qtest019', 'cancelled', NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days'),
  (bob_id, 17, 1, 179.99, 'ETH', 'Санкт-Петербург, Невский 50', '0xtest020', 'cancelled', NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days');

END $$;

-- ============================================
-- 7. Order Items - связь заказов с товарами
-- ============================================

INSERT INTO order_items (order_id, product_id, product_name, quantity, price, currency)
SELECT
  o.id,
  o.product_id,
  p.name,
  o.quantity,
  p.price,
  o.currency
FROM orders o
JOIN products p ON o.product_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = o.id)
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. Payments - записи о платежах (упрощенная версия)
-- ============================================

-- Payments для всех оплаченных заказов
INSERT INTO payments (order_id, amount, currency, tx_hash, status, verified_at)
SELECT
  id,
  total_price,
  currency,
  payment_hash,
  'confirmed',
  paid_at
FROM orders
WHERE payment_hash IS NOT NULL AND paid_at IS NOT NULL
ON CONFLICT (tx_hash) DO NOTHING;

-- ============================================
-- 10. Shop Subscriptions - история платежей магазинов
-- ============================================

-- Fashion Store - 3 платежа за PRO (активная подписка)
INSERT INTO shop_subscriptions (shop_id, tier, amount, tx_hash, currency, period_start, period_end, status, verified_at)
VALUES
  (2, 'pro', 35.00, '0xfashion-sub-1', 'USDT', NOW() - INTERVAL '90 days', NOW() - INTERVAL '60 days', 'expired', NOW() - INTERVAL '90 days'),
  (2, 'pro', 35.00, '0xfashion-sub-2', 'USDT', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', 'expired', NOW() - INTERVAL '60 days'),
  (2, 'pro', 35.00, '0xfashion-sub-3', 'USDT', NOW() - INTERVAL '30 days', NOW() + INTERVAL '0 days', 'active', NOW() - INTERVAL '30 days')
ON CONFLICT DO NOTHING;

-- Game Store - 4 платежа за PRO (активная подписка)
INSERT INTO shop_subscriptions (shop_id, tier, amount, tx_hash, currency, period_start, period_end, status, verified_at)
VALUES
  (3, 'pro', 35.00, '0xgame-sub-1', 'USDT', NOW() - INTERVAL '120 days', NOW() - INTERVAL '90 days', 'expired', NOW() - INTERVAL '120 days'),
  (3, 'pro', 35.00, '0xgame-sub-2', 'USDT', NOW() - INTERVAL '90 days', NOW() - INTERVAL '60 days', 'expired', NOW() - INTERVAL '90 days'),
  (3, 'pro', 35.00, '0xgame-sub-3', 'USDT', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', 'expired', NOW() - INTERVAL '60 days'),
  (3, 'pro', 35.00, '0xgame-sub-4', 'USDT', NOW() - INTERVAL '30 days', NOW() + INTERVAL '0 days', 'active', NOW() - INTERVAL '30 days')
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================
-- Проверка созданных данных
-- ============================================

SELECT
  'Orders by Status' as report,
  status,
  COUNT(*) as count,
  SUM(total_price) as total_revenue
FROM orders
GROUP BY status
ORDER BY
  CASE status
    WHEN 'pending' THEN 1
    WHEN 'confirmed' THEN 2
    WHEN 'shipped' THEN 3
    WHEN 'delivered' THEN 4
    WHEN 'cancelled' THEN 5
  END;

SELECT
  'Summary' as table_name,
  (SELECT COUNT(*) FROM orders) as orders_total,
  (SELECT COUNT(*) FROM shop_follows) as shop_follows_total,
  (SELECT COUNT(*) FROM synced_products) as synced_products_total,
  (SELECT COUNT(*) FROM shop_workers) as shop_workers_total,
  (SELECT COUNT(*) FROM subscriptions) as buyer_subscriptions_total,
  (SELECT COUNT(*) FROM payments) as payments_total,
  (SELECT COUNT(*) FROM invoices) as invoices_total;

SELECT
  'Top Products' as report,
  p.name,
  COUNT(o.id) as orders_count,
  SUM(o.total_price) as total_revenue
FROM products p
JOIN orders o ON p.id = o.product_id
GROUP BY p.id, p.name
ORDER BY orders_count DESC
LIMIT 10;
