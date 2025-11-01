-- ============================================
-- Sync ALL products for Fashion Store follow
-- ============================================
-- Синхронизирует все активные товары из Game Store
-- в Fashion Store с наценкой 25% (режим Перепродажа)
-- ============================================

BEGIN;

-- ============================================
-- Шаг 1: Проверка follow_id
-- ============================================
DO $$
DECLARE
  v_follow_id INT;
  v_follower_shop_id INT := 202;  -- Fashion Store
  v_source_shop_id INT := 203;     -- Game Store
  v_markup_percentage DECIMAL := 25.00;
  v_source_product RECORD;
  v_synced_product_id INT;
  v_unique_name TEXT;
  v_new_price DECIMAL;
  v_counter INT;
  v_synced_count INT := 0;
  v_skipped_count INT := 0;
BEGIN

  -- Получаем follow_id
  SELECT id INTO v_follow_id
  FROM shop_follows
  WHERE follower_shop_id = v_follower_shop_id
    AND source_shop_id = v_source_shop_id
    AND mode = 'resell'
    AND status = 'active';

  IF v_follow_id IS NULL THEN
    RAISE EXCEPTION 'Follow relationship not found for Fashion Store → Game Store (resell mode)';
  END IF;

  RAISE NOTICE '✓ Found follow_id: % (Fashion Store → Game Store)', v_follow_id;
  RAISE NOTICE '✓ Markup: % %%, Mode: resell', v_markup_percentage;
  RAISE NOTICE ' ';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Starting product synchronization...';
  RAISE NOTICE '============================================';

  -- ============================================
  -- Шаг 2: Синхронизация всех активных товаров
  -- ============================================

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
      RAISE NOTICE '[SKIP] Product % already synced', v_source_product.name;
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
      shop_id,
      name,
      description,
      price,
      currency,
      stock_quantity,
      reserved_quantity,
      is_active,
      created_at
    ) VALUES (
      v_follower_shop_id,
      v_unique_name,
      v_source_product.description,
      v_new_price,
      COALESCE(v_source_product.currency, 'USD'),
      v_source_product.stock_quantity,
      0,
      true,
      NOW()
    )
    RETURNING id INTO v_synced_product_id;

    -- Создаем запись в synced_products
    INSERT INTO synced_products (
      follow_id,
      synced_product_id,
      source_product_id,
      conflict_status,
      last_synced_at,
      created_at
    ) VALUES (
      v_follow_id,
      v_synced_product_id,
      v_source_product.id,
      'synced',
      NOW(),
      NOW()
    );

    RAISE NOTICE '[SYNC] % → % (price: % → %)',
      v_source_product.name,
      v_unique_name,
      v_source_product.price,
      v_new_price;

    v_synced_count := v_synced_count + 1;
  END LOOP;

  RAISE NOTICE ' ';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Synchronization complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total synced: %', v_synced_count;
  RAISE NOTICE 'Total skipped: %', v_skipped_count;
  RAISE NOTICE ' ';

END $$;

COMMIT;

-- ============================================
-- Verification: Check synced products
-- ============================================

SELECT
  '============================================' as divider
UNION ALL
SELECT 'Fashion Store Follow - Synced Products'
UNION ALL
SELECT '============================================';

SELECT
  sf.id as follow_id,
  sf.mode,
  sf.markup_percentage,
  COUNT(sp.id) as synced_products_count,
  fs.name as follower_shop,
  ss.name as source_shop
FROM shop_follows sf
JOIN shops fs ON sf.follower_shop_id = fs.id
JOIN shops ss ON sf.source_shop_id = ss.id
LEFT JOIN synced_products sp ON sp.follow_id = sf.id
WHERE sf.follower_shop_id = 2
  AND sf.source_shop_id = 3
GROUP BY sf.id, sf.mode, sf.markup_percentage, fs.name, ss.name;

SELECT '' as separator;

SELECT
  sp.id as sync_id,
  source_p.name as source_product,
  source_p.price as source_price,
  synced_p.name as synced_product,
  synced_p.price as synced_price,
  ROUND((synced_p.price - source_p.price) / source_p.price * 100, 2) as actual_markup,
  sp.conflict_status,
  sp.last_synced_at
FROM synced_products sp
JOIN shop_follows sf ON sp.follow_id = sf.id
JOIN products source_p ON sp.source_product_id = source_p.id
JOIN products synced_p ON sp.synced_product_id = synced_p.id
WHERE sf.follower_shop_id = 2
  AND sf.source_shop_id = 3
ORDER BY sp.id;
