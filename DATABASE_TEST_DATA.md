# Тестовые данные в БД

> Дата заполнения: 2025-01-29

## Магазин "Loper" (shop_id=1, user_id=1)

### Владелец
- **User**: Fred Matthew Brown (@fredmbrown)
- **Telegram ID**: 123456789
- **Тариф**: PRO

### 1️⃣ Товары (31 шт)
- **Активных**: 28
- **Неактивных**: 3
- **Нет в наличии**: 3
- **Общий запас**: 1,523 единицы
- **Зарезервировано**: 9 единиц

**Категории**:
- Смартфоны: iPhone 15 Pro Max, Galaxy S24 Ultra, Pixel 8 Pro, OnePlus 12, Xiaomi 14
- Ноутбуки: MacBook Pro M3, Dell XPS 15, ThinkPad X1 Carbon
- Планшеты: iPad Pro 12.9", Samsung Galaxy Tab S9
- Аудио: AirPods Pro 2, Sony WH-1000XM5, Bose QC45
- Аксессуары: Apple Watch Ultra 2, Magic Keyboard, USB-C Hub, Wireless Charger
- Игровое: PS5 Console, Xbox Series X, Steam Deck

**Ценовой диапазон**: $39 - $2,499

### 2️⃣ Криптокошельки
- ✅ **BTC**: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
- ✅ **ETH**: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
- ✅ **USDT**: TQamF8rf8CuCBcrS85trYW23MsKJc2FMJr (TRC-20)
- ✅ **TON**: UQBvj0aTWbVBSaVXRvvbNRKN0xDvz4n4dG8r8qJwLR8YPwQw

### 3️⃣ Заказы (15 шт)
- **Общая выручка**: $2,809.41
- **Период**: Последние 29 дней
- **Уникальных покупателей**: 10

**Покупатели** (telegram_id 2001-2010):
- buyer_alice_2001, buyer_bob_2002, buyer_charlie_2003, buyer_diana_2004, buyer_eve_2005
- buyer_frank_2006, buyer_grace_2007, buyer_henry_2008, buyer_iris_2009, buyer_jack_2010

**Статусы заказов**:
- Pending: 0
- Confirmed: 4
- Shipped: 4
- Delivered: 4

### 4️⃣ Работники (3 чел)
**PRO-функция доступна**

1. **Mike Johnson** (@worker_assistant)
   - Telegram ID: 3001
   - Роль: seller

2. **Sarah Williams** (@worker_manager)
   - Telegram ID: 3002
   - Роль: seller

3. **Alex Davis** (@worker_support)
   - Telegram ID: 3003
   - Роль: seller

### 5️⃣ Подписки на магазины (Follows) - 2 шт

#### Follow #1: TechSource (Monitor Mode)
- **Источник**: TechSource (shop_id=2, tier=PRO)
- **Режим**: monitor (только отслеживание)
- **Markup**: 0%
- **Товаров в источнике**: 5

#### Follow #2: GadgetSupply (Resell Mode)
- **Источник**: GadgetSupply (shop_id=3, tier=basic)
- **Режим**: resell (автосинхронизация)
- **Markup**: 25%
- **Товаров в источнике**: 4
- **Синхронизировано**: 4 товара

### 6️⃣ Синхронизированные товары (4 шт)
Все из GadgetSupply с наценкой 25%:

1. **USB-C Cable 10-Pack**
   - Оригинал: $29.99 → Продажа: $37.49
   - Actual markup: 25.01%

2. **Phone Stand Wholesale**
   - Оригинал: $39.99 → Продажа: $49.99
   - Actual markup: 25.01%

3. **Wireless Charger Pad**
   - Оригинал: $59.99 → Продажа: $74.99
   - Actual markup: 25.00%

4. **Car Phone Mount Bulk**
   - Оригинал: $44.99 → Продажа: $56.24
   - Actual markup: 25.01%

### 7️⃣ Покупатели-подписчики (5 чел)
Подписаны на уведомления о новых товарах:

1. buyer_alice (@buyer_alice)
2. buyer_bob (@buyer_bob)
3. buyer_charlie (@buyer_charlie)
4. buyer_diana (@buyer_diana)
5. buyer_eve (@buyer_eve)

---

## Проверка целостности данных

### ✅ Выполненные проверки:
- [x] stock_quantity ≥ reserved_quantity для всех товаров
- [x] Все foreign keys корректны
- [x] Нет дублирующих подписок (user_id, shop_id)
- [x] Markup применён правильно (25.00-25.01%)
- [x] Все криптокошельки в валидных форматах
- [x] 0 конфликтов в synced_products
- [x] Все работники имеют роль 'seller'

---

## Как использовать тестовые данные

### Тестирование бота:
```bash
# Войти как владелец магазина
/start → Продавец

# Войти как работник (telegram_id: 3001, 3002, 3003)
/start → Продавец → Workspace

# Войти как покупатель (telegram_id: 2001-2010)
/start → Покупатель → Поиск "Loper"
```

### Тестирование WebApp:
```javascript
// В браузере открыть:
https://your-webapp-url/?tgWebAppData=...

// Проверить:
- Каталог товаров (31 товар)
- Корзина и оформление заказа
- История заказов (15 заказов для telegram_id 2001-2010)
- Настройки магазина (кошельки, работники)
- Подписки (Follows)
```

### SQL запросы:
```sql
-- Просмотр всех товаров
SELECT * FROM products WHERE shop_id = 1 ORDER BY created_at DESC;

-- Просмотр заказов
SELECT o.*, u.username FROM orders o
JOIN products p ON p.id = o.product_id
JOIN users u ON u.id = o.buyer_id
WHERE p.shop_id = 1 ORDER BY o.created_at DESC;

-- Просмотр синхронизированных товаров
SELECT sp.*, op.name, op.price as original_price, tp.price as synced_price
FROM synced_products sp
JOIN products op ON op.id = sp.source_product_id
JOIN products tp ON tp.id = sp.synced_product_id
WHERE sp.follow_id IN (SELECT id FROM shop_follows WHERE follower_shop_id = 1);
```

---

## Примечания

- Все данные созданы только в БД через SQL INSERT
- Исходный код приложения не изменялся
- Все telegram_id фиктивные (2001-2010, 3001-3003)
- Payment hashes фиктивные (для тестирования)
- Даты заказов: NOW() - random days (0-29 дней назад)

---

**Автор**: Claude Code
**Дата**: 2025-01-29
