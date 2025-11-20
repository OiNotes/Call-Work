# Инструкция по применению Migration 009

## Быстрый старт

### Вариант 1: Через migrations.cjs (Рекомендуется)

```bash
cd /Users/sile/Documents/Status\ Stock\ 4.0
node backend/database/migrations.cjs --add-channel-url
```

### Вариант 2: Через dedicated runner

```bash
cd /Users/sile/Documents/Status\ Stock\ 4.0
node backend/database/migrations/run-migration-009.js
```

### Вариант 3: Прямой SQL

```bash
psql telegram_shop -f backend/database/migrations/009_add_channel_url.sql
```

## Проверка после применения

```sql
-- Проверить колонку
\d shops

-- Должно появиться:
-- channel_url | character varying(255) |

-- Проверить индекс
\di idx_shops_channel_url

-- Проверить данные
SELECT id, name, channel_url, tier FROM shops LIMIT 5;
```

## Rollback (если нужно откатить)

```bash
# Через migrations.cjs
node backend/database/migrations.cjs --rollback-channel-url

# Или вручную через SQL
psql telegram_shop -c "DROP INDEX IF EXISTS idx_shops_channel_url; ALTER TABLE shops DROP COLUMN IF EXISTS channel_url;"
```

## Что изменится после миграции?

### Backend API

**Migration Controller** (`POST /shops/:shopId/migration`):

- ✅ Теперь сохраняет `newChannelUrl` в `shops.channel_url` после broadcast
- ✅ Response включает `oldChannelUrl` из БД (если есть)
- ✅ Следующая миграция видит предыдущий канал

### Database

**shops table:**

```sql
-- Новая колонка
channel_url VARCHAR(255) NULL

-- Новый индекс
idx_shops_channel_url ON shops(channel_url)
```

### Backward Compatibility

✅ **Полностью совместимо:**

- Старые shops имеют `channel_url = NULL`
- API работает с fallback: `shop.channel_url || oldChannelUrl || null`
- Если миграция не применена - код всё равно работает

## Зависимости

**Должны быть применены ДО этой миграции:**

- `schema.sql` (base schema)
- `007_add_shop_tier_and_subscription_status.sql` (tier column)

**НЕ требуется:**

- Existing data migration
- Service restart (hot reload работает)

## Troubleshooting

### Ошибка: "column already exists"

Migration идемпотентна, можно запускать повторно:

```sql
ALTER TABLE shops ADD COLUMN IF NOT EXISTS channel_url VARCHAR(255);
```

### Ошибка: "relation shops does not exist"

Сначала примените base schema:

```bash
node backend/database/migrations.cjs
```

### После миграции API возвращает NULL в oldChannelUrl

Это ОК! Значит:

1. Это первая миграция канала для этого shop
2. ИЛИ миграция была до добавления `channel_url` колонки

На следующей миграции `oldChannelUrl` будет из БД.

## Полезные команды

```bash
# Проверить статус миграции
psql telegram_shop -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='channel_url');"

# Посмотреть все shops с каналами
psql telegram_shop -c "SELECT id, name, channel_url FROM shops WHERE channel_url IS NOT NULL;"

# Статистика
psql telegram_shop -c "SELECT COUNT(*) as total_shops, COUNT(channel_url) as shops_with_channels FROM shops;"
```

## Production Checklist

- [ ] Backup БД перед миграцией
- [ ] Применить миграцию в staging
- [ ] Проверить что API работает
- [ ] Проверить что UI показывает канал
- [ ] Применить миграцию в production
- [ ] Обновить `schema.sql` (добавить `channel_url` вручную)
- [ ] Коммит changes в git

---

**Автор:** Claude Code (database-designer)  
**Дата:** 2025-11-05  
**Версия:** 1.0
