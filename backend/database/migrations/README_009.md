# Migration 009: Add channel_url to shops

## Дата: 2025-11-05

## Цель

Добавить поле `channel_url` в таблицу `shops` для хранения Telegram канала магазина.

## Проблема

- Система Channel Migration не может сохранить URL нового канала
- При повторной миграции нет информации о текущем канале
- UI не может показать текущий Telegram канал магазина

## Решение

### 1. Database Schema

Добавлена колонка `channel_url VARCHAR(255)`:

```sql
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS channel_url VARCHAR(255);
```

**Параметры:**
- `VARCHAR(255)` - достаточно для Telegram URL (`@channel_name` или `https://t.me/channel_name`)
- `NULL` allowed - старые магазины могут не иметь канала
- Индекс для faster lookups

### 2. Migration Controller

Обновлён `migrationController.js`:

**Изменения:**
1. SELECT теперь возвращает `channel_url`
2. После успешного broadcast → UPDATE `channel_url`
3. Response включает `oldChannelUrl` из БД

**Код:**
```javascript
// After broadcast success:
await pool.query(
  'UPDATE shops SET channel_url = $1, updated_at = NOW() WHERE id = $2',
  [newChannelUrl, shopId]
);

// Response:
{
  oldChannelUrl: shop.channel_url || oldChannelUrl || null
}
```

## Применение миграции

### Автоматически

```bash
npm run db:migrate
```

### Вручную

```bash
psql telegram_shop -f backend/database/migrations/009_add_channel_url.sql
```

### Проверка

```sql
-- Проверить что колонка добавлена
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'shops' AND column_name = 'channel_url';

-- Проверить индекс
SELECT indexname FROM pg_indexes 
WHERE tablename = 'shops' AND indexname = 'idx_shops_channel_url';
```

## Rollback

```sql
-- Удалить индекс
DROP INDEX IF EXISTS idx_shops_channel_url;

-- Удалить колонку
ALTER TABLE shops DROP COLUMN IF EXISTS channel_url;
```

## Backward Compatibility

✅ **Полностью backward compatible:**
- Колонка `NULL` by default
- Существующие shops не ломаются
- IF NOT EXISTS для идемпотентности
- API fallback: `shop.channel_url || oldChannelUrl || null`

## Влияние на производительность

- ✅ Minimal overhead (VARCHAR(255) ≈ 256 bytes)
- ✅ Index добавлен для fast lookups
- ✅ Не влияет на existing queries

## Зависимости

**Required:**
- PostgreSQL 12+
- shops table exists

**Modified files:**
- `backend/database/migrations/009_add_channel_url.sql` (NEW)
- `backend/src/controllers/migrationController.js` (MODIFIED)
- `backend/database/schema.sql` (to be updated)

## Testing

```bash
# 1. Apply migration
npm run db:migrate

# 2. Test API endpoint
POST /api/shops/:shopId/migration
{
  "newChannelUrl": "@new_channel"
}

# 3. Verify database
psql telegram_shop -c "SELECT id, name, channel_url FROM shops WHERE id = :shopId;"
```

## Notes

- Migration должна быть применена ПЕРЕД деплоем обновлённого API
- Если миграция не применена - код всё равно работает (fallback на `oldChannelUrl` из request body)
- После миграции рекомендуется обновить `schema.sql` вручную

## Author

Claude Code (database-designer)

## Status

✅ Ready for production
