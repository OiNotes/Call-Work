-- ============================================
-- Test Data - Full Testing Environment
-- ============================================
BEGIN;

-- ============================================
-- 1. Обновить Fashion Store на PRO подписку
-- ============================================

UPDATE shops
SET tier = 'pro',
    subscription_status = 'active',
    next_payment_due = NOW() + INTERVAL '30 days',
    registration_paid = true,
    is_active = true,
    updated_at = NOW()
WHERE id = 2;

INSERT INTO shop_subscriptions (shop_id, tier, amount, tx_hash, currency, period_start, period_end, status, verified_at)
VALUES (2, 'pro', 35.00, 'promo-fashion-upgrade-' || extract(epoch from NOW()), 'USDT', NOW(), NOW() + INTERVAL '30 days', 'active', NOW());

-- ============================================
-- 2. Создать buyer пользователей
-- ============================================

INSERT INTO users (telegram_id, username, first_name, last_name, selected_role) VALUES
  (777777, 'buyer_test1', 'Alice', 'Cooper', 'buyer'),
  (888888, 'buyer_test2', 'Bob', 'Marley', 'buyer'),
  (999999, 'buyer_test3', 'Charlie', 'Brown', 'buyer');

-- ============================================
-- 3. Добавить товары в Fashion Store (id=2)
-- ============================================

INSERT INTO products (shop_id, name, description, price, stock_quantity, is_active) VALUES
  (2, 'Nike Air Force 1', 'Классические белые кроссовки Nike', 120.00, 50, true),
  (2, 'Adidas Hoodie', 'Теплая толстовка с капюшоном', 80.00, 30, true),
  (2, 'Ray-Ban Wayfarer', 'Солнцезащитные очки в классическом стиле', 150.00, 20, true),
  (2, 'Levi''s 511 Jeans', 'Зауженные джинсы темно-синего цвета', 90.00, 40, true),
  (2, 'Casio G-Shock', 'Ударопрочные спортивные часы', 200.00, 15, true),
  (2, 'Tommy Hilfiger Polo', 'Классическое поло с логотипом', 75.00, 35, true),
  (2, 'Vans Old Skool', 'Культовые скейтерские кеды', 65.00, 60, true),
  (2, 'North Face Backpack', 'Рюкзак для города и походов', 110.00, 25, true);

-- ============================================
-- 4. Создать дополнительные shop_follows
-- ============================================

-- Fashion Store (2) следит за Lobik (4) в режиме monitor
-- Это не создаст цикл: уже есть 2→3, добавим 2→4
INSERT INTO shop_follows (follower_shop_id, source_shop_id, mode, markup_percentage, status)
VALUES (2, 4, 'monitor', 0, 'active')
ON CONFLICT (follower_shop_id, source_shop_id) DO NOTHING;

-- ============================================
-- 5. Создать синхронизированные товары
-- ============================================

-- Fashion Store скопировал игру из Game Store с наценкой 15%
-- Используем существующую связь: Fashion Store (2) → Game Store (3)
INSERT INTO products (shop_id, name, description, price, stock_quantity, is_active) VALUES
  (2, 'Cyberpunk 2077 Resell', 'Цифровой ключ игры с наценкой', 68.99, 50, true);

-- Создаем связь синхронизированного товара
INSERT INTO synced_products (follow_id, synced_product_id, source_product_id, conflict_status)
SELECT
  (SELECT id FROM shop_follows WHERE follower_shop_id = 2 AND source_shop_id = 3 LIMIT 1),
  (SELECT id FROM products WHERE shop_id = 2 AND name = 'Cyberpunk 2077 Resell' ORDER BY id DESC LIMIT 1),
  (SELECT id FROM products WHERE shop_id = 3 ORDER BY id LIMIT 1),
  'synced'
WHERE EXISTS (SELECT 1 FROM shop_follows WHERE follower_shop_id = 2 AND source_shop_id = 3)
ON CONFLICT (follow_id, source_product_id) DO NOTHING;

-- ============================================
-- 6. Создать подписки buyers на магазины
-- ============================================

INSERT INTO subscriptions (user_id, shop_id, telegram_id)
SELECT u.id, s.shop_id, u.telegram_id
FROM (VALUES
  (777777, 2),  -- Alice подписана на Fashion Store
  (777777, 3),  -- Alice подписана на Game Store
  (888888, 2),  -- Bob подписан на Fashion Store
  (999999, 4)   -- Charlie подписан на Lobik
) AS s(telegram_id, shop_id)
JOIN users u ON u.telegram_id = s.telegram_id
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- ============================================
-- 7. Создать тестовые заказы
-- ============================================

-- Get buyer user IDs and product IDs first
DO $$
DECLARE
  alice_id INT;
  bob_id INT;
  charlie_id INT;
  nike_prod_id INT;
  casio_prod_id INT;
  game_prod_id INT;
  rayban_prod_id INT;
  cyber_prod_id INT;
BEGIN
  -- Get user IDs
  SELECT id INTO alice_id FROM users WHERE telegram_id = 777777;
  SELECT id INTO bob_id FROM users WHERE telegram_id = 888888;
  SELECT id INTO charlie_id FROM users WHERE telegram_id = 999999;

  -- Get product IDs
  SELECT id INTO nike_prod_id FROM products WHERE shop_id = 2 AND name = 'Nike Air Force 1' LIMIT 1;
  SELECT id INTO casio_prod_id FROM products WHERE shop_id = 2 AND name = 'Casio G-Shock' LIMIT 1;
  SELECT id INTO game_prod_id FROM products WHERE shop_id = 3 LIMIT 1;
  SELECT id INTO rayban_prod_id FROM products WHERE shop_id = 2 AND name = 'Ray-Ban Wayfarer' LIMIT 1;
  SELECT id INTO cyber_prod_id FROM products WHERE shop_id = 2 AND name = 'Cyberpunk 2077 Resell' LIMIT 1;

  -- Insert orders if all IDs are found
  IF alice_id IS NOT NULL AND nike_prod_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (alice_id, nike_prod_id, 1, 120.00, 'BTC', 'Москва, ул. Ленина 10, кв. 5', NULL, 'bc1qtest777777', 'pending', NOW() - INTERVAL '1 hour', NULL);
  END IF;

  IF bob_id IS NOT NULL AND casio_prod_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (bob_id, casio_prod_id, 1, 200.00, 'ETH', 'Санкт-Петербург, Невский 50', '0xconfirmed888888', '0xtest888888', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');
  END IF;

  IF charlie_id IS NOT NULL AND game_prod_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (charlie_id, game_prod_id, 1, 59.99, 'USDT', 'Казань, пр. Победы 20', '0xshipped999999', 'TTest999999', 'shipped', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');
  END IF;

  IF alice_id IS NOT NULL AND rayban_prod_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (alice_id, rayban_prod_id, 1, 150.00, 'BTC', 'Москва, ул. Ленина 10, кв. 5', '0xdelivered777777', 'bc1qtest777777-2', 'delivered', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');
  END IF;

  IF bob_id IS NOT NULL AND cyber_prod_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (bob_id, cyber_prod_id, 1, 65.99, 'USDT', 'Санкт-Петербург, Невский 50', '0xconfirmed888888-2', 'TTest888888-2', 'confirmed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');
  END IF;
END $$;

-- ============================================
-- 8. Создать order_items для заказов
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
WHERE o.id > (SELECT COALESCE(MAX(order_id), 0) FROM order_items);

COMMIT;

-- ============================================
-- Проверка созданных данных
-- ============================================
SELECT
  'Users' as table_name,
  COUNT(*) as total,
  SUM(CASE WHEN selected_role = 'buyer' THEN 1 ELSE 0 END) as buyers,
  SUM(CASE WHEN selected_role = 'seller' THEN 1 ELSE 0 END) as sellers
FROM users
UNION ALL
SELECT
  'Shops',
  COUNT(*),
  SUM(CASE WHEN tier = 'pro' THEN 1 ELSE 0 END),
  SUM(CASE WHEN tier = 'basic' THEN 1 ELSE 0 END)
FROM shops
UNION ALL
SELECT 'Products', COUNT(*), NULL, NULL FROM products
UNION ALL
SELECT 'Shop Follows', COUNT(*), NULL, NULL FROM shop_follows
UNION ALL
SELECT 'Synced Products', COUNT(*), NULL, NULL FROM synced_products
UNION ALL
SELECT 'Orders', COUNT(*), NULL, NULL FROM orders
UNION ALL
SELECT 'Subscriptions', COUNT(*), NULL, NULL FROM subscriptions;

SELECT
  s.name as shop,
  s.tier,
  s.subscription_status,
  COUNT(p.id) as products_count
FROM shops s
LEFT JOIN products p ON s.id = p.shop_id
GROUP BY s.id, s.name, s.tier, s.subscription_status
ORDER BY s.id;
