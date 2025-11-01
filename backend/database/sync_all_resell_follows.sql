-- ============================================
-- Sync products for ALL resell follows
-- ============================================
-- Автоматически синхронизирует товары для всех
-- follows с режимом 'resell' которые имеют 0 товаров
-- ============================================

BEGIN;

-- ============================================
-- Синхронизация для bobi → Fashion Store
-- ============================================
DO $$
DECLARE
  v_follow_id INT := 7;
  v_follower_shop_id INT := 5;      -- bobi
  v_source_shop_id INT := 202;       -- Fashion Store
  v_markup_percentage DECIMAL;
  v_source_product RECORD;
  v_synced_product_id INT;
  v_unique_name TEXT;
  v_new_price DECIMAL;
  v_counter INT;
  v_synced_count INT := 0;
  v_skipped_count INT := 0;
BEGIN

  -- Получаем markup для этого follow
  SELECT markup_percentage INTO v_markup_percentage
  FROM shop_follows
  WHERE id = v_follow_id;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Syncing: bobi → Fashion Store';
  RAISE NOTICE 'Follow ID: %, Markup: % %%', v_follow_id, v_markup_percentage;
  RAISE NOTICE '============================================';

  FOR v_source_product IN
    SELECT id, name, description, price, currency, stock_quantity
    FROM products
    WHERE shop_id = v_source_shop_id
      AND is_active = true
    ORDER BY id
  LOOP
    -- Проверяем, уже синхронизирован ли товар
    IF EXISTS (
      SELECT 1 FROM synced_products
      WHERE follow_id = v_follow_id
        AND source_product_id = v_source_product.id
    ) THEN
      RAISE NOTICE '[SKIP] %', v_source_product.name;
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Генерируем уникальное имя
    v_unique_name := v_source_product.name;
    v_counter := 1;

    WHILE EXISTS (
      SELECT 1 FROM products
      WHERE shop_id = v_follower_shop_id
        AND LOWER(name) = LOWER(v_unique_name)
    ) LOOP
      v_unique_name := v_source_product.name || ' (копия ' || v_counter || ')';
      v_counter := v_counter + 1;
    END LOOP;

    -- Рассчитываем цену с наценкой
    v_new_price := ROUND(v_source_product.price * (1 + v_markup_percentage / 100), 2);

    -- Создаем синхронизированный товар
    INSERT INTO products (
      shop_id, name, description, price, currency,
      stock_quantity, reserved_quantity, is_active, created_at
    ) VALUES (
      v_follower_shop_id, v_unique_name, v_source_product.description,
      v_new_price, COALESCE(v_source_product.currency, 'USD'),
      v_source_product.stock_quantity, 0, true, NOW()
    )
    RETURNING id INTO v_synced_product_id;

    -- Создаем запись в synced_products
    INSERT INTO synced_products (
      follow_id, synced_product_id, source_product_id,
      conflict_status, last_synced_at, created_at
    ) VALUES (
      v_follow_id, v_synced_product_id, v_source_product.id,
      'synced', NOW(), NOW()
    );

    RAISE NOTICE '[SYNC] % → % ($ % → $ %)',
      v_source_product.name, v_unique_name,
      v_source_product.price, v_new_price;

    v_synced_count := v_synced_count + 1;
  END LOOP;

  RAISE NOTICE 'Total synced: %, skipped: %', v_synced_count, v_skipped_count;
  RAISE NOTICE ' ';

END $$;

-- ============================================
-- Синхронизация для bobi → Lobik Digital
-- ============================================
DO $$
DECLARE
  v_follow_id INT := 9;
  v_follower_shop_id INT := 5;      -- bobi
  v_source_shop_id INT := 204;       -- Lobik Digital
  v_markup_percentage DECIMAL;
  v_source_product RECORD;
  v_synced_product_id INT;
  v_unique_name TEXT;
  v_new_price DECIMAL;
  v_counter INT;
  v_synced_count INT := 0;
  v_skipped_count INT := 0;
BEGIN

  -- Получаем markup для этого follow
  SELECT markup_percentage INTO v_markup_percentage
  FROM shop_follows
  WHERE id = v_follow_id;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Syncing: bobi → Lobik Digital';
  RAISE NOTICE 'Follow ID: %, Markup: % %%', v_follow_id, v_markup_percentage;
  RAISE NOTICE '============================================';

  FOR v_source_product IN
    SELECT id, name, description, price, currency, stock_quantity
    FROM products
    WHERE shop_id = v_source_shop_id
      AND is_active = true
    ORDER BY id
  LOOP
    -- Проверяем, уже синхронизирован ли товар
    IF EXISTS (
      SELECT 1 FROM synced_products
      WHERE follow_id = v_follow_id
        AND source_product_id = v_source_product.id
    ) THEN
      RAISE NOTICE '[SKIP] %', v_source_product.name;
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Генерируем уникальное имя
    v_unique_name := v_source_product.name;
    v_counter := 1;

    WHILE EXISTS (
      SELECT 1 FROM products
      WHERE shop_id = v_follower_shop_id
        AND LOWER(name) = LOWER(v_unique_name)
    ) LOOP
      v_unique_name := v_source_product.name || ' (копия ' || v_counter || ')';
      v_counter := v_counter + 1;
    END LOOP;

    -- Рассчитываем цену с наценкой
    v_new_price := ROUND(v_source_product.price * (1 + v_markup_percentage / 100), 2);

    -- Создаем синхронизированный товар
    INSERT INTO products (
      shop_id, name, description, price, currency,
      stock_quantity, reserved_quantity, is_active, created_at
    ) VALUES (
      v_follower_shop_id, v_unique_name, v_source_product.description,
      v_new_price, COALESCE(v_source_product.currency, 'USD'),
      v_source_product.stock_quantity, 0, true, NOW()
    )
    RETURNING id INTO v_synced_product_id;

    -- Создаем запись в synced_products
    INSERT INTO synced_products (
      follow_id, synced_product_id, source_product_id,
      conflict_status, last_synced_at, created_at
    ) VALUES (
      v_follow_id, v_synced_product_id, v_source_product.id,
      'synced', NOW(), NOW()
    );

    RAISE NOTICE '[SYNC] % → % ($ % → $ %)',
      v_source_product.name, v_unique_name,
      v_source_product.price, v_new_price;

    v_synced_count := v_synced_count + 1;
  END LOOP;

  RAISE NOTICE 'Total synced: %, skipped: %', v_synced_count, v_skipped_count;
  RAISE NOTICE ' ';

END $$;

COMMIT;

-- ============================================
-- Verification
-- ============================================
SELECT 
  '============================================' as divider
UNION ALL
SELECT 'FINAL RESULTS - All Resell Follows'
UNION ALL
SELECT '============================================';

SELECT 
  sf.id as follow_id,
  fs.name as follower,
  ss.name as source,
  sf.markup_percentage,
  COUNT(sp.id) as synced_products
FROM shop_follows sf
JOIN shops fs ON sf.follower_shop_id = fs.id
JOIN shops ss ON sf.source_shop_id = ss.id
LEFT JOIN synced_products sp ON sp.follow_id = sf.id
WHERE sf.mode = 'resell'
GROUP BY sf.id, fs.name, ss.name, sf.markup_percentage
ORDER BY sf.id;
