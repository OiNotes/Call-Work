# Database Cleanup Scripts

## Файлы

### cleanup_all_data.sql
**Назначение:** Безопасная очистка всех данных из базы telegram_shop

**Что делает:**
- Удаляет ВСЕ данные из всех таблиц
- Сохраняет структуру таблиц (не DROP TABLE)
- Сохраняет indexes, constraints, triggers
- Сбрасывает sequences (следующий ID = 1)
- Использует TRUNCATE CASCADE для автоматического удаления связанных записей

**Использование:**
```bash
psql telegram_shop -f cleanup_all_data.sql
```

**Результат:**
```
✅ 16 таблиц очищены
✅ Sequences сброшены
✅ Структура базы сохранена
```

### backup_before_cleanup.sh
**Назначение:** Создание backup перед очисткой

**Использование:**
```bash
./backup_before_cleanup.sh
```

**Восстановление из backup:**
```bash
psql telegram_shop < backups/telegram_shop_backup_YYYYMMDD_HHMMSS.sql
```

---

## Порядок очистки таблиц

Скрипт удаляет данные в правильном порядке с учётом foreign key constraints:

1. **Зависимые таблицы** (первыми):
   - `processed_webhooks`
   - `synced_products`
   - `shop_follows`
   - `order_items`
   - `payments`
   - `invoices`

2. **Промежуточные таблицы**:
   - `orders`
   - `products`
   - `subscriptions`
   - `promo_activations`
   - `shop_workers`
   - `shop_subscriptions`
   - `shop_payments`
   - `promo_codes`

3. **Основные таблицы**:
   - `shops`
   - `users` (последней)

---

## Безопасность

**Что НЕ удаляется:**
- ✅ Структура таблиц (CREATE TABLE)
- ✅ Indexes (CREATE INDEX)
- ✅ Constraints (FOREIGN KEY, CHECK, UNIQUE)
- ✅ Triggers (update_updated_at_column)
- ✅ Views (products_with_availability)
- ✅ Functions (check_circular_follow, cleanup_old_webhooks)

**Что удаляется:**
- ❌ Все данные из всех таблиц
- ❌ Текущие значения sequences (сбрасываются в 1)

---

## Проверка результата

После выполнения cleanup_all_data.sql:

```sql
-- Проверить что все таблицы пустые
SELECT 
  'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'shops', COUNT(*) FROM shops
UNION ALL
SELECT 'products', COUNT(*) FROM products;
-- Результат: все счётчики = 0

-- Проверить что sequences сброшены
INSERT INTO users (telegram_id, username) VALUES (12345, 'test') RETURNING id;
-- Результат: id = 1
DELETE FROM users WHERE telegram_id = 12345;
```

---

## Use Cases

### Fresh Testing Environment
Идеально для тестирования:
- Регистрации новых пользователей
- Payment flow с чистыми wallet sequences
- E2E тестов с нуля

### Before Production Migration
Перед деплоем production data:
1. `./backup_before_cleanup.sh` - создать backup
2. `psql telegram_shop -f cleanup_all_data.sql` - очистить
3. Import production data
4. Verify with tests

---

## Важные заметки

1. **Транзакционная безопасность**: Скрипт использует `BEGIN/COMMIT` для атомарности
2. **CASCADE удаление**: TRUNCATE CASCADE автоматически удаляет связанные записи
3. **Triggers отключены**: Во время очистки для скорости (потом включаются)
4. **Sequences reset**: RESTART IDENTITY сбрасывает auto-increment счётчики

---

**Created:** 2025-11-10  
**Database:** telegram_shop (PostgreSQL)  
**Tables cleaned:** 16  
**Sequences reset:** 20
