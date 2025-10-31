-- ============================================
-- SEED SCRIPT - Create comprehensive test data
-- ============================================
-- Создает полноценную тестовую среду с 3 магазинами,
-- товарами, заказами, follows, synced products, workers
-- ============================================

BEGIN;

-- ============================================
-- 1. Create test buyer users
-- ============================================
INSERT INTO users (telegram_id, username, first_name, last_name, selected_role, created_at) VALUES
  (777777, 'alice_buyer', 'Alice', 'Cooper', 'buyer', NOW() - INTERVAL '30 days'),
  (888888, 'bob_buyer', 'Bob', 'Marley', 'buyer', NOW() - INTERVAL '25 days'),
  (999999, 'charlie_buyer', 'Charlie', 'Brown', 'buyer', NOW() - INTERVAL '20 days')
ON CONFLICT (telegram_id) DO NOTHING;

-- ============================================
-- 2. Create test seller users and shops
-- ============================================
INSERT INTO users (telegram_id, username, first_name, last_name, selected_role, created_at) VALUES
  (111111, 'fashion_store_owner', 'Elena', 'Fashion', 'seller', NOW() - INTERVAL '60 days'),
  (222222, 'game_store_owner', 'Ivan', 'Gamer', 'seller', NOW() - INTERVAL '50 days'),
  (333333, 'lobik_store_owner', 'Maria', 'Digital', 'seller', NOW() - INTERVAL '45 days')
ON CONFLICT (telegram_id) DO NOTHING;

-- Get user IDs for shop creation
DO $$
DECLARE
  elena_id INT;
  ivan_id INT;
  maria_id INT;
BEGIN
  SELECT id INTO elena_id FROM users WHERE telegram_id = 111111;
  SELECT id INTO ivan_id FROM users WHERE telegram_id = 222222;
  SELECT id INTO maria_id FROM users WHERE telegram_id = 333333;

  -- Create shops
  INSERT INTO shops (owner_id, name, description, tier, registration_paid, is_active, subscription_status, next_payment_due, created_at) VALUES
    (elena_id, 'Fashion Store', 'Premium fashion and accessories', 'pro', true, true, 'active', NOW() + INTERVAL '30 days', NOW() - INTERVAL '60 days'),
    (ivan_id, 'Game Store', 'Digital game keys and gaming gear', 'pro', true, true, 'active', NOW() + INTERVAL '30 days', NOW() - INTERVAL '50 days'),
    (maria_id, 'Lobik Digital', 'Digital products and creative assets', 'basic', true, true, 'active', NOW() + INTERVAL '30 days', NOW() - INTERVAL '45 days')
  ON CONFLICT DO NOTHING;
END $$;

-- ============================================
-- 3. Add products to shops
-- ============================================

-- Fashion Store products (shop_id will be fetched dynamically)
INSERT INTO products (shop_id, name, description, price, stock_quantity, reserved_quantity, is_active, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1),
  name, description, price, stock_quantity, 0, true, created_at
FROM (VALUES
  ('Nike Air Max 90', 'Classic running shoes - White/Black colorway', 120.00, 50, NOW() - INTERVAL '55 days'),
  ('Adidas Hoodie Pro', 'Premium cotton hoodie with logo', 75.00, 80, NOW() - INTERVAL '54 days'),
  ('Ray-Ban Aviator', 'Iconic sunglasses - Gold frame', 150.00, 30, NOW() - INTERVAL '53 days'),
  ('Levi''s 501 Jeans', 'Original fit denim jeans - Dark blue', 85.00, 100, NOW() - INTERVAL '52 days'),
  ('Casio G-Shock DW-5600', 'Digital watch - Shock resistant', 90.00, 40, NOW() - INTERVAL '51 days'),
  ('Tommy Hilfiger Polo', 'Classic fit polo shirt - Navy', 65.00, 70, NOW() - INTERVAL '50 days'),
  ('Vans Old Skool Black', 'Skate shoes - Black/White', 60.00, 90, NOW() - INTERVAL '49 days'),
  ('The North Face Backpack', 'Borealis backpack 28L - Black', 95.00, 35, NOW() - INTERVAL '48 days'),
  ('New Balance 574', 'Lifestyle sneakers - Grey/White', 80.00, 60, NOW() - INTERVAL '47 days'),
  ('Champion Crewneck', 'Reverse weave sweatshirt - Red', 70.00, 55, NOW() - INTERVAL '46 days')
) AS t(name, description, price, stock_quantity, created_at)
WHERE EXISTS (SELECT 1 FROM shops WHERE name = 'Fashion Store');

-- Game Store products
INSERT INTO products (shop_id, name, description, price, stock_quantity, reserved_quantity, is_active, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1),
  name, description, price, stock_quantity, 0, true, created_at
FROM (VALUES
  ('Cyberpunk 2077', 'Digital game key - Steam/GOG', 59.99, 200, NOW() - INTERVAL '48 days'),
  ('Baldur''s Gate 3', 'RPG masterpiece - Steam key', 69.99, 150, NOW() - INTERVAL '47 days'),
  ('Elden Ring', 'FromSoftware action RPG - Steam', 49.99, 180, NOW() - INTERVAL '46 days'),
  ('Red Dead Redemption 2', 'Rockstar epic western - Steam', 39.99, 220, NOW() - INTERVAL '45 days'),
  ('Hogwarts Legacy', 'Harry Potter RPG - Steam key', 54.99, 170, NOW() - INTERVAL '44 days'),
  ('FIFA 24', 'Sports simulation - Origin key', 59.99, 130, NOW() - INTERVAL '43 days'),
  ('Call of Duty MW3', 'FPS shooter - Battle.net key', 69.99, 140, NOW() - INTERVAL '42 days'),
  ('Starfield', 'Bethesda space RPG - Steam', 64.99, 160, NOW() - INTERVAL '41 days'),
  ('Spider-Man Remastered', 'Marvel action game - Steam', 49.99, 190, NOW() - INTERVAL '40 days'),
  ('Resident Evil 4 Remake', 'Horror survival - Steam key', 44.99, 200, NOW() - INTERVAL '39 days')
) AS t(name, description, price, stock_quantity, created_at)
WHERE EXISTS (SELECT 1 FROM shops WHERE name = 'Game Store');

-- Lobik Digital products
INSERT INTO products (shop_id, name, description, price, stock_quantity, reserved_quantity, is_active, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Lobik Digital' LIMIT 1),
  name, description, price, stock_quantity, 0, true, created_at
FROM (VALUES
  ('Digital Art Pack Vol 1', '100 high-res illustrations', 29.99, 500, NOW() - INTERVAL '43 days'),
  ('Video Editing Presets', 'LUTs for Premiere & Final Cut', 19.99, 400, NOW() - INTERVAL '42 days'),
  ('Music Production Kit', '2000+ samples and loops', 39.99, 300, NOW() - INTERVAL '41 days'),
  ('Web Template Bundle', '15 responsive HTML templates', 49.99, 200, NOW() - INTERVAL '40 days'),
  ('3D Model Pack', 'Low-poly assets for games', 59.99, 250, NOW() - INTERVAL '39 days'),
  ('Photoshop Actions Pro', '50 professional actions', 24.99, 600, NOW() - INTERVAL '38 days'),
  ('Motion Graphics Pack', 'After Effects templates', 34.99, 350, NOW() - INTERVAL '37 days'),
  ('Icon Set Ultimate', '5000+ vector icons', 29.99, 450, NOW() - INTERVAL '36 days')
) AS t(name, description, price, stock_quantity, created_at)
WHERE EXISTS (SELECT 1 FROM shops WHERE name = 'Lobik Digital');

-- ============================================
-- 4. Create shop_follows (dropshipping network)
-- ============================================

-- Fashion Store follows Game Store (resell mode, 20% markup)
INSERT INTO shop_follows (follower_shop_id, source_shop_id, mode, markup_percentage, status, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1),
  (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1),
  'resell', 20.00, 'active', NOW() - INTERVAL '30 days'
WHERE EXISTS (SELECT 1 FROM shops WHERE name = 'Fashion Store')
  AND EXISTS (SELECT 1 FROM shops WHERE name = 'Game Store')
ON CONFLICT (follower_shop_id, source_shop_id) DO NOTHING;

-- Fashion Store follows Lobik Digital (monitor mode)
INSERT INTO shop_follows (follower_shop_id, source_shop_id, mode, markup_percentage, status, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1),
  (SELECT id FROM shops WHERE name = 'Lobik Digital' LIMIT 1),
  'monitor', 0.00, 'active', NOW() - INTERVAL '25 days'
WHERE EXISTS (SELECT 1 FROM shops WHERE name = 'Fashion Store')
  AND EXISTS (SELECT 1 FROM shops WHERE name = 'Lobik Digital')
ON CONFLICT (follower_shop_id, source_shop_id) DO NOTHING;

-- Game Store follows Lobik Digital (resell mode, 15% markup)
INSERT INTO shop_follows (follower_shop_id, source_shop_id, mode, markup_percentage, status, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1),
  (SELECT id FROM shops WHERE name = 'Lobik Digital' LIMIT 1),
  'resell', 15.00, 'active', NOW() - INTERVAL '20 days'
WHERE EXISTS (SELECT 1 FROM shops WHERE name = 'Game Store')
  AND EXISTS (SELECT 1 FROM shops WHERE name = 'Lobik Digital')
ON CONFLICT (follower_shop_id, source_shop_id) DO NOTHING;

-- ============================================
-- 5. Create synced products (resell products)
-- ============================================

-- Fashion Store resells games from Game Store
INSERT INTO products (shop_id, name, description, price, stock_quantity, reserved_quantity, is_active, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1),
  name || ' [Resell]', description || ' (with markup)', price * 1.20, stock_quantity, 0, true, created_at
FROM products
WHERE shop_id = (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1)
  AND name IN ('Cyberpunk 2077', 'Baldur''s Gate 3')
ON CONFLICT DO NOTHING;

-- Create synced_products records
INSERT INTO synced_products (follow_id, synced_product_id, source_product_id, conflict_status, created_at)
SELECT 
  (SELECT id FROM shop_follows WHERE follower_shop_id = (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1) 
    AND source_shop_id = (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1) LIMIT 1),
  resell.id,
  source.id,
  'synced',
  NOW() - INTERVAL '28 days'
FROM products source
JOIN products resell ON resell.name = source.name || ' [Resell]'
WHERE source.shop_id = (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1)
  AND source.name IN ('Cyberpunk 2077', 'Baldur''s Gate 3')
  AND resell.shop_id = (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1)
ON CONFLICT (follow_id, source_product_id) DO NOTHING;

-- Game Store resells digital products from Lobik Digital
INSERT INTO products (shop_id, name, description, price, stock_quantity, reserved_quantity, is_active, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1),
  name || ' [Resell]', description || ' (with markup)', price * 1.15, stock_quantity, 0, true, created_at
FROM products
WHERE shop_id = (SELECT id FROM shops WHERE name = 'Lobik Digital' LIMIT 1)
  AND name IN ('Digital Art Pack Vol 1', 'Video Editing Presets')
ON CONFLICT DO NOTHING;

-- Create synced_products records for Game Store
INSERT INTO synced_products (follow_id, synced_product_id, source_product_id, conflict_status, created_at)
SELECT 
  (SELECT id FROM shop_follows WHERE follower_shop_id = (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1) 
    AND source_shop_id = (SELECT id FROM shops WHERE name = 'Lobik Digital' LIMIT 1) LIMIT 1),
  resell.id,
  source.id,
  'synced',
  NOW() - INTERVAL '18 days'
FROM products source
JOIN products resell ON resell.name = source.name || ' [Resell]'
WHERE source.shop_id = (SELECT id FROM shops WHERE name = 'Lobik Digital' LIMIT 1)
  AND source.name IN ('Digital Art Pack Vol 1', 'Video Editing Presets')
  AND resell.shop_id = (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1)
ON CONFLICT (follow_id, source_product_id) DO NOTHING;

-- ============================================
-- 6. Add shop workers (PRO feature)
-- ============================================

-- Add Bob as worker in Fashion Store (PRO shop)
INSERT INTO shop_workers (shop_id, worker_user_id, telegram_id, added_by, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1),
  (SELECT id FROM users WHERE telegram_id = 888888),
  888888,
  (SELECT owner_id FROM shops WHERE name = 'Fashion Store' LIMIT 1),
  NOW() - INTERVAL '15 days'
WHERE EXISTS (SELECT 1 FROM users WHERE telegram_id = 888888)
  AND EXISTS (SELECT 1 FROM shops WHERE name = 'Fashion Store')
ON CONFLICT (shop_id, worker_user_id) DO NOTHING;

-- Add Charlie as worker in Game Store (PRO shop)
INSERT INTO shop_workers (shop_id, worker_user_id, telegram_id, added_by, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1),
  (SELECT id FROM users WHERE telegram_id = 999999),
  999999,
  (SELECT owner_id FROM shops WHERE name = 'Game Store' LIMIT 1),
  NOW() - INTERVAL '10 days'
WHERE EXISTS (SELECT 1 FROM users WHERE telegram_id = 999999)
  AND EXISTS (SELECT 1 FROM shops WHERE name = 'Game Store')
ON CONFLICT (shop_id, worker_user_id) DO NOTHING;

-- ============================================
-- 7. Create buyer subscriptions to shops
-- ============================================

INSERT INTO subscriptions (user_id, shop_id, telegram_id, created_at)
SELECT u.id, s.id, u.telegram_id, t.sub_created_at
FROM (VALUES
  (777777, 'Fashion Store', NOW() - INTERVAL '20 days'),
  (777777, 'Game Store', NOW() - INTERVAL '18 days'),
  (888888, 'Fashion Store', NOW() - INTERVAL '15 days'),
  (888888, 'Lobik Digital', NOW() - INTERVAL '12 days'),
  (999999, 'Game Store', NOW() - INTERVAL '10 days'),
  (999999, 'Lobik Digital', NOW() - INTERVAL '8 days')
) AS t(telegram_id, shop_name, sub_created_at)
JOIN users u ON u.telegram_id = t.telegram_id
JOIN shops s ON s.name = t.shop_name
ON CONFLICT (user_id, shop_id) DO NOTHING;

-- ============================================
-- 8. Create comprehensive order history
-- ============================================

DO $$
DECLARE
  alice_id INT;
  bob_id INT;
  charlie_id INT;
  nike_id INT;
  rayban_id INT;
  casio_id INT;
  cyber_id INT;
  baldur_id INT;
  elden_id INT;
  art_pack_id INT;
  video_presets_id INT;
BEGIN
  -- Get user IDs
  SELECT id INTO alice_id FROM users WHERE telegram_id = 777777;
  SELECT id INTO bob_id FROM users WHERE telegram_id = 888888;
  SELECT id INTO charlie_id FROM users WHERE telegram_id = 999999;

  -- Get product IDs from Fashion Store
  SELECT id INTO nike_id FROM products WHERE shop_id = (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1) AND name = 'Nike Air Max 90' LIMIT 1;
  SELECT id INTO rayban_id FROM products WHERE shop_id = (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1) AND name = 'Ray-Ban Aviator' LIMIT 1;
  SELECT id INTO casio_id FROM products WHERE shop_id = (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1) AND name = 'Casio G-Shock DW-5600' LIMIT 1;

  -- Get product IDs from Game Store
  SELECT id INTO cyber_id FROM products WHERE shop_id = (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1) AND name = 'Cyberpunk 2077' LIMIT 1;
  SELECT id INTO baldur_id FROM products WHERE shop_id = (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1) AND name = 'Baldur''s Gate 3' LIMIT 1;
  SELECT id INTO elden_id FROM products WHERE shop_id = (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1) AND name = 'Elden Ring' LIMIT 1;

  -- Get product IDs from Lobik Digital
  SELECT id INTO art_pack_id FROM products WHERE shop_id = (SELECT id FROM shops WHERE name = 'Lobik Digital' LIMIT 1) AND name = 'Digital Art Pack Vol 1' LIMIT 1;
  SELECT id INTO video_presets_id FROM products WHERE shop_id = (SELECT id FROM shops WHERE name = 'Lobik Digital' LIMIT 1) AND name = 'Video Editing Presets' LIMIT 1;

  -- ===== DELIVERED ORDERS (10 orders, 30-60 days ago) =====
  IF alice_id IS NOT NULL AND nike_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (alice_id, nike_id, 2, 240.00, 'BTC', 'Москва, ул. Пушкина 5, кв. 10', '0xdelivered001', 'bc1qalice001', 'delivered', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '55 days');
  END IF;

  IF alice_id IS NOT NULL AND rayban_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (alice_id, rayban_id, 1, 150.00, 'ETH', 'Москва, ул. Пушкина 5, кв. 10', '0xdelivered002', '0xalice002', 'delivered', NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days', NOW() - INTERVAL '50 days');
  END IF;

  IF bob_id IS NOT NULL AND cyber_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (bob_id, cyber_id, 1, 59.99, 'USDT', 'СПб, Невский пр. 50', 'TXdelivered003', 'TBob003', 'delivered', NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days', NOW() - INTERVAL '45 days');
  END IF;

  IF bob_id IS NOT NULL AND baldur_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (bob_id, baldur_id, 2, 139.98, 'BTC', 'СПб, Невский пр. 50', '0xdelivered004', 'bc1qbob004', 'delivered', NOW() - INTERVAL '48 days', NOW() - INTERVAL '48 days', NOW() - INTERVAL '43 days');
  END IF;

  IF charlie_id IS NOT NULL AND art_pack_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (charlie_id, art_pack_id, 1, 29.99, 'ETH', 'Казань, ул. Баумана 10', '0xdelivered005', '0xcharlie005', 'delivered', NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days', NOW() - INTERVAL '40 days');
  END IF;

  IF charlie_id IS NOT NULL AND elden_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (charlie_id, elden_id, 1, 49.99, 'USDT', 'Казань, ул. Баумана 10', 'TXdelivered006', 'TCharlie006', 'delivered', NOW() - INTERVAL '42 days', NOW() - INTERVAL '42 days', NOW() - INTERVAL '37 days');
  END IF;

  IF alice_id IS NOT NULL AND casio_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (alice_id, casio_id, 1, 90.00, 'BTC', 'Москва, ул. Пушкина 5, кв. 10', '0xdelivered007', 'bc1qalice007', 'delivered', NOW() - INTERVAL '38 days', NOW() - INTERVAL '38 days', NOW() - INTERVAL '33 days');
  END IF;

  IF bob_id IS NOT NULL AND video_presets_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (bob_id, video_presets_id, 3, 59.97, 'ETH', 'СПб, Невский пр. 50', '0xdelivered008', '0xbob008', 'delivered', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '30 days');
  END IF;

  IF alice_id IS NOT NULL AND cyber_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (alice_id, cyber_id, 1, 59.99, 'USDT', 'Москва, ул. Пушкина 5, кв. 10', 'TXdelivered009', 'TAlice009', 'delivered', NOW() - INTERVAL '32 days', NOW() - INTERVAL '32 days', NOW() - INTERVAL '28 days');
  END IF;

  IF charlie_id IS NOT NULL AND nike_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at, completed_at)
    VALUES (charlie_id, nike_id, 1, 120.00, 'BTC', 'Казань, ул. Баумана 10', '0xdelivered010', 'bc1qcharlie010', 'delivered', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '26 days');
  END IF;

  -- ===== SHIPPED ORDERS (3 orders, 7-15 days ago) =====
  IF alice_id IS NOT NULL AND baldur_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (alice_id, baldur_id, 1, 69.99, 'BTC', 'Москва, ул. Пушкина 5, кв. 10', '0xshipped001', 'bc1qalice011', 'shipped', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days');
  END IF;

  IF bob_id IS NOT NULL AND rayban_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (bob_id, rayban_id, 1, 150.00, 'ETH', 'СПб, Невский пр. 50', '0xshipped002', '0xbob012', 'shipped', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');
  END IF;

  IF charlie_id IS NOT NULL AND art_pack_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (charlie_id, art_pack_id, 2, 59.98, 'USDT', 'Казань, ул. Баумана 10', 'TXshipped003', 'TCharlie013', 'shipped', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days');
  END IF;

  -- ===== CONFIRMED ORDERS (4 orders, 1-5 days ago) =====
  IF alice_id IS NOT NULL AND elden_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (alice_id, elden_id, 1, 49.99, 'BTC', 'Москва, ул. Пушкина 5, кв. 10', '0xconfirmed001', 'bc1qalice014', 'confirmed', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');
  END IF;

  IF bob_id IS NOT NULL AND casio_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (bob_id, casio_id, 1, 90.00, 'ETH', 'СПб, Невский пр. 50', '0xconfirmed002', '0xbob015', 'confirmed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');
  END IF;

  IF charlie_id IS NOT NULL AND video_presets_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (charlie_id, video_presets_id, 1, 19.99, 'USDT', 'Казань, ул. Баумана 10', 'TXconfirmed003', 'TCharlie016', 'confirmed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');
  END IF;

  IF alice_id IS NOT NULL AND art_pack_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_hash, payment_address, status, created_at, paid_at)
    VALUES (alice_id, art_pack_id, 1, 29.99, 'BTC', 'Москва, ул. Пушкина 5, кв. 10', '0xconfirmed004', 'bc1qalice017', 'confirmed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');
  END IF;

  -- ===== PENDING ORDERS (3 active orders, 2-12 hours ago) =====
  IF alice_id IS NOT NULL AND cyber_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_address, status, created_at)
    VALUES (alice_id, cyber_id, 1, 59.99, 'BTC', 'Москва, ул. Пушкина 5, кв. 10', 'bc1qalice018', 'pending', NOW() - INTERVAL '2 hours');
  END IF;

  IF bob_id IS NOT NULL AND nike_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_address, status, created_at)
    VALUES (bob_id, nike_id, 1, 120.00, 'ETH', 'СПб, Невский пр. 50', '0xbob019', 'pending', NOW() - INTERVAL '5 hours');
  END IF;

  IF charlie_id IS NOT NULL AND baldur_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_address, status, created_at)
    VALUES (charlie_id, baldur_id, 1, 69.99, 'USDT', 'Казань, ул. Баумана 10', 'TCharlie020', 'pending', NOW() - INTERVAL '12 hours');
  END IF;

  -- ===== CANCELLED ORDERS (2 orders) =====
  IF alice_id IS NOT NULL AND rayban_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_address, status, created_at, updated_at)
    VALUES (alice_id, rayban_id, 1, 150.00, 'BTC', 'Москва, ул. Пушкина 5, кв. 10', 'bc1qalice021', 'cancelled', NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days');
  END IF;

  IF bob_id IS NOT NULL AND elden_id IS NOT NULL THEN
    INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, delivery_address, payment_address, status, created_at, updated_at)
    VALUES (bob_id, elden_id, 1, 49.99, 'ETH', 'СПб, Невский пр. 50', '0xbob022', 'cancelled', NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days');
  END IF;

END $$;

-- ============================================
-- 9. Create order_items for all orders
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
-- 10. Create payments for paid orders
-- ============================================

INSERT INTO payments (order_id, tx_hash, amount, currency, status, confirmations, verified_at, created_at)
SELECT
  o.id,
  o.payment_hash,
  o.total_price,
  o.currency,
  'confirmed',
  CASE o.currency
    WHEN 'BTC' THEN 6
    WHEN 'ETH' THEN 12
    WHEN 'USDT' THEN 20
    ELSE 3
  END,
  o.paid_at,
  o.created_at
FROM orders o
WHERE o.payment_hash IS NOT NULL AND o.paid_at IS NOT NULL
ON CONFLICT (tx_hash) DO NOTHING;

-- ============================================
-- 11. Create shop_subscriptions (payment history)
-- ============================================

-- Fashion Store - 3 payments (PRO tier, active)
INSERT INTO shop_subscriptions (shop_id, tier, amount, tx_hash, currency, period_start, period_end, status, verified_at, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Fashion Store' LIMIT 1),
  'pro', 35.00, '0xfashion-sub-' || i, 'USDT',
  NOW() - INTERVAL '90 days' + (i * INTERVAL '30 days'),
  NOW() - INTERVAL '60 days' + (i * INTERVAL '30 days'),
  CASE WHEN i = 3 THEN 'active' ELSE 'expired' END,
  NOW() - INTERVAL '90 days' + (i * INTERVAL '30 days'),
  NOW() - INTERVAL '90 days' + (i * INTERVAL '30 days')
FROM generate_series(1, 3) AS i
WHERE EXISTS (SELECT 1 FROM shops WHERE name = 'Fashion Store')
ON CONFLICT (tx_hash) DO NOTHING;

-- Game Store - 4 payments (PRO tier, active)
INSERT INTO shop_subscriptions (shop_id, tier, amount, tx_hash, currency, period_start, period_end, status, verified_at, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Game Store' LIMIT 1),
  'pro', 35.00, '0xgame-sub-' || i, 'USDT',
  NOW() - INTERVAL '120 days' + (i * INTERVAL '30 days'),
  NOW() - INTERVAL '90 days' + (i * INTERVAL '30 days'),
  CASE WHEN i = 4 THEN 'active' ELSE 'expired' END,
  NOW() - INTERVAL '120 days' + (i * INTERVAL '30 days'),
  NOW() - INTERVAL '120 days' + (i * INTERVAL '30 days')
FROM generate_series(1, 4) AS i
WHERE EXISTS (SELECT 1 FROM shops WHERE name = 'Game Store')
ON CONFLICT (tx_hash) DO NOTHING;

-- Lobik Digital - 2 payments (BASIC tier, active)
INSERT INTO shop_subscriptions (shop_id, tier, amount, tx_hash, currency, period_start, period_end, status, verified_at, created_at)
SELECT 
  (SELECT id FROM shops WHERE name = 'Lobik Digital' LIMIT 1),
  'basic', 25.00, '0xlobik-sub-' || i, 'BTC',
  NOW() - INTERVAL '60 days' + (i * INTERVAL '30 days'),
  NOW() - INTERVAL '30 days' + (i * INTERVAL '30 days'),
  CASE WHEN i = 2 THEN 'active' ELSE 'expired' END,
  NOW() - INTERVAL '60 days' + (i * INTERVAL '30 days'),
  NOW() - INTERVAL '60 days' + (i * INTERVAL '30 days')
FROM generate_series(1, 2) AS i
WHERE EXISTS (SELECT 1 FROM shops WHERE name = 'Lobik Digital')
ON CONFLICT (tx_hash) DO NOTHING;

COMMIT;

-- ============================================
-- Verification - Summary of created data
-- ============================================

SELECT '============================================' as divider;
SELECT 'SEED COMPLETE - Test Data Summary' as status;
SELECT '============================================' as divider;

SELECT 
  'Users' as entity,
  COUNT(*) as total,
  SUM(CASE WHEN selected_role = 'buyer' THEN 1 ELSE 0 END) as buyers,
  SUM(CASE WHEN selected_role = 'seller' THEN 1 ELSE 0 END) as sellers
FROM users
UNION ALL
SELECT 
  'Shops',
  COUNT(*),
  SUM(CASE WHEN tier = 'pro' THEN 1 ELSE 0 END) as pro_tier,
  SUM(CASE WHEN tier = 'basic' THEN 1 ELSE 0 END) as basic_tier
FROM shops
UNION ALL
SELECT 'Products', COUNT(*), NULL, NULL FROM products
UNION ALL
SELECT 'Shop Follows', COUNT(*), NULL, NULL FROM shop_follows
UNION ALL
SELECT 'Synced Products', COUNT(*), NULL, NULL FROM synced_products
UNION ALL
SELECT 'Shop Workers', COUNT(*), NULL, NULL FROM shop_workers
UNION ALL
SELECT 'Subscriptions', COUNT(*), NULL, NULL FROM subscriptions
UNION ALL
SELECT 'Orders', COUNT(*), NULL, NULL FROM orders
UNION ALL
SELECT 'Order Items', COUNT(*), NULL, NULL FROM order_items
UNION ALL
SELECT 'Payments', COUNT(*), NULL, NULL FROM payments
UNION ALL
SELECT 'Shop Subscriptions', COUNT(*), NULL, NULL FROM shop_subscriptions;

SELECT '============================================' as divider;
SELECT 'Orders by Status' as report;
SELECT 
  status,
  COUNT(*) as count,
  ROUND(SUM(total_price)::numeric, 2) as total_revenue
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

SELECT '============================================' as divider;
SELECT 'Shops Overview' as report;
SELECT 
  s.name,
  s.tier,
  s.subscription_status,
  COUNT(DISTINCT p.id) as products,
  COUNT(DISTINCT sf.id) as follows_as_follower,
  COUNT(DISTINCT sw.id) as workers
FROM shops s
LEFT JOIN products p ON s.id = p.shop_id
LEFT JOIN shop_follows sf ON s.id = sf.follower_shop_id
LEFT JOIN shop_workers sw ON s.id = sw.shop_id
GROUP BY s.id, s.name, s.tier, s.subscription_status
ORDER BY s.name;

SELECT '============================================' as divider;
SELECT 'Top Selling Products' as report;
SELECT 
  p.name,
  s.name as shop,
  COUNT(o.id) as orders_count,
  ROUND(SUM(o.total_price)::numeric, 2) as revenue
FROM products p
JOIN shops s ON p.shop_id = s.id
LEFT JOIN orders o ON p.id = o.product_id
WHERE o.status IN ('confirmed', 'shipped', 'delivered')
GROUP BY p.id, p.name, s.name
HAVING COUNT(o.id) > 0
ORDER BY orders_count DESC
LIMIT 10;

SELECT '============================================' as divider;
