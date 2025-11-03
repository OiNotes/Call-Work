# 🛠️ ПЛАН ИСПРАВЛЕНИЯ AI БОТА

## Приоритет P0 - КРИТИЧНО (исправить сейчас)

### Fix 1: operationText is not defined ❌
**Проблема:** Переменная используется до определения  
**Файл:** `bot/src/services/productAI.js`  
**Строка:** ~1730 (начало функции handleBulkUpdatePrices)

**Действие:**
```javascript
async function handleBulkUpdatePrices(args, shopId, token, products, ctx) {
  const { percentage, operation, duration, excludedProducts = [] } = args;
  
  // ✅ ДОБАВИТЬ ЭТУ СТРОКУ
  const operationText = operation === 'decrease' ? 'Скидка' : 'Наценка';
  const operationSymbol = operation === 'decrease' ? '-' : '+';
  
  logger.info('handleBulkUpdatePrices called', {...});
  // ... остальной код
}
```

**Время:** 2 минуты  
**Риск:** Низкий

---

### Fix 2: Товары не обновляются после скидки 🔄
**Проблема:** AI видит устаревшие данные после применения скидок  
**Файл:** `bot/src/handlers/seller/aiProducts.js`  
**Строка:** ~185 (после processProductCommand)

**Действие:**
```javascript
// После processProductCommand
const result = await processProductCommand(userMessage, {
  shopId: ctx.session.shopId,
  shopName: ctx.session.shopName,
  token: ctx.session.token,
  products,
  ctx
});

// ✅ ДОБАВИТЬ: Перезагрузка товаров после мутаций
if (result.success && result.operation) {
  logger.debug('Reloading products after mutation', {
    userId: ctx.from.id,
    operation: result.operation
  });
  
  // Invalidate cache
  delete ctx.session.cachedProducts;
  delete ctx.session.productsCacheTime;
}
```

**Время:** 10 минут  
**Риск:** Средний (немного увеличит latency)

---

## Приоритет P1 - ВАЖНО (исправить эту неделю)

### Fix 3: Вынести operationText в helper
**Файл:** `bot/src/services/productAI.js`  
**Действие:** Создать helper function

```javascript
// В начале файла после imports
/**
 * Get operation text for display
 * @param {string} operation - 'increase' or 'decrease'
 * @returns {string} Display text
 */
function getOperationText(operation) {
  return operation === 'decrease' ? 'Скидка' : 'Наценка';
}

function getOperationSymbol(operation) {
  return operation === 'decrease' ? '-' : '+';
}

// Использовать в handleBulkUpdatePrices и executeBulkPriceUpdate
const operationText = getOperationText(operation);
const operationSymbol = getOperationSymbol(operation);
```

**Время:** 5 минут

---

### Fix 4: Валидация excludedProductIds
**Файл:** `bot/src/tools/productTools.js`  
**Строка:** ~350 (bulkUpdatePrices tool definition)

**Действие:**
```javascript
excludedProducts: {
  type: 'array',
  items: { 
    type: 'string'  // ✅ Добавить строгую валидацию типа
  },
  description: 'Product names to EXCLUDE from discount...'
}
```

**Время:** 2 минуты

---

### Fix 5: Увеличить max_tokens
**Файл:** `bot/src/services/deepseek.js`  
**Строка:** 66, 166

**Действие:**
```javascript
// В chat() и chatStreaming()
max_tokens: tools.length > 0 ? 1000 : 500  // ✅ 1000 для tool calls, 500 для text
```

**Время:** 2 минуты

---

### Fix 6: Session cleanup для pending operations
**Файл:** `bot/src/handlers/seller/aiProducts.js`  
**Строка:** ~35 (в handleAIProductCommand)

**Действие:**
```javascript
// Auto-cleanup expired pending operations
if (ctx.session.pendingBulkUpdate) {
  const operationAge = Date.now() - ctx.session.pendingBulkUpdate.timestamp;
  const TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  if (operationAge > TIMEOUT) {
    logger.info('Auto-cleanup expired pendingBulkUpdate', {
      userId: ctx.from.id,
      age: operationAge
    });
    delete ctx.session.pendingBulkUpdate;
  }
}
```

**Время:** 15 минут

---

## ТЕСТИРОВАНИЕ

### Automated Tests
```bash
# Run existing tests
cd bot && npm test

# Check for new regressions
npm run test:integration
```

### Manual Tests
1. **Test operationText fix:**
   - User: "скидка 20%"
   - Expected: Должна показаться клавиатура выбора типа
   - User: "наценка 10%"
   - Expected: Должна показаться клавиатура выбора типа

2. **Test product refresh:**
   - User: "скидка 15%"
   - Bot: [применяет скидку]
   - User: "покажи товары"
   - Expected: Товары должны показаться СО скидками

3. **Test excluded products:**
   - User: "скидка 20% кроме iPhone"
   - Expected: Должна примениться скидка ко всем кроме iPhone

### Database Verification
```sql
-- Check discount fields after applying
SELECT 
  name, 
  price, 
  original_price, 
  discount_percentage,
  discount_expires_at
FROM products 
WHERE shop_id = YOUR_SHOP_ID;
```

---

## ROLLBACK PLAN

Если что-то пойдёт не так:

```bash
# 1. Revert changes
git checkout -- bot/src/services/productAI.js
git checkout -- bot/src/handlers/seller/aiProducts.js
git checkout -- bot/src/tools/productTools.js
git checkout -- bot/src/services/deepseek.js

# 2. Restart bot
pm2 restart bot

# 3. Check logs
tail -f bot/logs/bot.log
```

---

## DEPLOYMENT

```bash
# 1. Apply changes (after approval)
# Files will be edited via MCP File System

# 2. Test locally first
cd bot && npm test

# 3. Restart bot
pm2 restart bot

# 4. Monitor logs for 5 minutes
pm2 logs bot --lines 100

# 5. Test manually with real user
# Use your test shop to verify all fixes
```

---

## SUCCESS CRITERIA

✅ Скидки создаются без ошибок  
✅ AI видит товары со скидками после применения  
✅ Исключённые товары не получают скидки  
✅ Логи без errors  
✅ Все тесты проходят  

---

Время выполнения: ~40 минут (фиксы) + 30 минут (тесты) = **~1.5 часа**
