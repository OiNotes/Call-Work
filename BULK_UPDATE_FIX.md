# Bulk Update Transaction Fix

## Проблема

`POST /api/products/bulk-update` обновлял товары независимо друг от друга без транзакции, что приводило к:

- ✗ Частичным обновлениям (часть успешно, часть нет)
- ✗ Race conditions при одновременных запросах
- ✗ Неинформативным ошибкам "Internal server error"

## Решение

Обёрнут метод `bulkUpdateProducts` в PostgreSQL транзакцию (`BEGIN...COMMIT/ROLLBACK`):

### Что изменилось

**До:**
```javascript
// Каждый товар обновлялся независимо
for (const item of updates) {
  const updated = await productQueries.update(productId, updates);
  // Если ошибка - просто пропускаем товар
}
```

**После:**
```javascript
const client = await getClient();
try {
  await client.query('BEGIN');
  
  for (const item of updates) {
    const result = await client.query('UPDATE products...', params);
    // Если ошибка - rollback ВСЕЙ операции
  }
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  // Возвращаем детальную ошибку
} finally {
  client.release();
}
```

### Преимущества

✅ **Атомарность** - либо все товары обновляются, либо ни один  
✅ **Детальные ошибки** - "Product not found: 123" вместо "Database error"  
✅ **Логирование** - каждая стадия транзакции логируется  
✅ **Обратная совместимость** - API контракт не изменился

### Формат ответа

**Success (все товары обновлены):**
```json
{
  "success": true,
  "data": {
    "updated": 5,
    "failed": 0,
    "results": [
      { "productId": 1, "success": true },
      { "productId": 2, "success": true }
    ]
  }
}
```

**Error (rollback на первой ошибке):**
```json
{
  "success": false,
  "error": "Bulk update failed: Product not found: 999",
  "details": {
    "failedProductId": 999,
    "processedCount": 2
  }
}
```

## Тестирование

Создан ручной тест для проверки транзакционности:

```bash
# Запустить backend
cd backend && npm run dev

# В другом терминале
cd bot/tests/manual
node test_bulk_transaction.js
```

**Тест проверяет:**
1. ✅ Success case - все товары обновлены атомарно
2. ✅ Failure case - rollback при невалидном productId (нет частичных обновлений)
3. ✅ Error messages - детальные и понятные

## Изменённые файлы

- `backend/src/controllers/productController.js` - добавлена транзакция в `bulkUpdateProducts()`
- `bot/tests/manual/test_bulk_transaction.js` - ручной тест транзакционности

## Логирование

Теперь логируются все этапы:

```
[info] bulkUpdateProducts: Transaction started
[debug] bulkUpdateProducts: product updated (productId: 123)
[info] bulkUpdateProducts: Transaction committed
```

При ошибке:
```
[warn] bulkUpdateProducts: product not found (productId: 999)
[warn] bulkUpdateProducts: Transaction rolled back
[error] bulkUpdateProducts: error for product (productId: 999)
```
