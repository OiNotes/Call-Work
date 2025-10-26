# Bot Integration Guide - WebSocket Broadcasting

Инструкция по интеграции WebSocket real-time обновлений из бота в WebApp.

## 1. Настройка окружения

### Backend `.env`
```bash
INTERNAL_SECRET=your-strong-random-secret-here-min-32-chars
```

### Bot `.env`
```bash
INTERNAL_SECRET=same-secret-as-backend
BACKEND_URL=http://localhost:3000
```

## 2. Создание утилиты для broadcast в боте

Создайте файл `bot/src/utils/broadcast.js`:

```javascript
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

/**
 * Отправить real-time update в WebApp через WebSocket
 * @param {string} type - Тип события
 * @param {object} data - Данные события
 */
export async function broadcastUpdate(type, data = {}) {
  if (!INTERNAL_SECRET) {
    console.warn('⚠️ INTERNAL_SECRET not set - skipping broadcast');
    return;
  }

  try {
    await axios.post(
      `${BACKEND_URL}/api/internal/broadcast`,
      { type, ...data },
      {
        headers: {
          'x-internal-secret': INTERNAL_SECRET
        },
        timeout: 2000
      }
    );
    console.log(`✅ Broadcast sent: ${type}`, data);
  } catch (error) {
    console.error(`❌ Broadcast failed: ${type}`, error.message);
  }
}
```

## 3. Использование в bot handlers

### Пример: Product Added Handler

```javascript
import { broadcastUpdate } from '../utils/broadcast.js';

// После успешного создания продукта
ctx.scene.state.newProduct = await productService.create({
  shop_id: shopId,
  name: productName,
  price: productPrice,
  description: productDescription
});

// Broadcast update
await broadcastUpdate('product_added', {
  shopId: shopId,
  productId: ctx.scene.state.newProduct.id
});

await ctx.reply('✅ Product created successfully!');
```

### Пример: Product Updated Handler

```javascript
await productService.update(productId, updatedData);

await broadcastUpdate('product_updated', {
  shopId: shop.id,
  productId: productId
});
```

### Пример: Product Deleted Handler

```javascript
await productService.delete(productId);

await broadcastUpdate('product_deleted', {
  shopId: shop.id,
  productId: productId
});
```

### Пример: Order Status Update

```javascript
await orderService.updateStatus(orderId, 'confirmed');

await broadcastUpdate('order_status', {
  orderId: orderId,
  status: 'confirmed'
});
```

### Пример: New Subscriber

```javascript
await followService.subscribe(userId, shopId);

await broadcastUpdate('new_subscriber', {
  shopId: shopId
});
```

## 4. Интеграция в существующие handlers

### `bot/src/handlers/seller/product.js`

```javascript
import { broadcastUpdate } from '../../utils/broadcast.js';

// В scene.action('confirm_product_creation')
await broadcastUpdate('product_added', {
  shopId: ctx.scene.state.shopId,
  productId: newProduct.id
});

// В scene.action('delete_product')
await broadcastUpdate('product_deleted', {
  shopId: shop.id,
  productId: productId
});
```

### `bot/src/handlers/buyer/shop.js`

```javascript
import { broadcastUpdate } from '../../utils/broadcast.js';

// В callback 'subscribe_shop'
await broadcastUpdate('new_subscriber', {
  shopId: shopId
});
```

## 5. Тестирование

### Проверка endpoint

```bash
curl -X POST http://localhost:3000/api/internal/broadcast \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: your-secret-here" \
  -d '{"type":"product_added","shopId":123,"productId":456}'
```

### Ожидаемый ответ

```json
{
  "success": true,
  "message": "Broadcast sent",
  "type": "product_added"
}
```

### Проверка в browser console (WebApp)

Откройте WebApp и откройте DevTools Console. Вы должны увидеть:

```
✅ WebSocket connected
📨 WebSocket message: { type: 'product_added', shopId: 123, productId: 456 }
```

## 6. Типы событий

| Event Type | Data | Frontend Action |
|-----------|------|----------------|
| `product_added` | `{ shopId, productId }` | Refetch products for shop |
| `product_updated` | `{ shopId, productId }` | Refetch products for shop |
| `product_deleted` | `{ shopId, productId }` | Refetch products for shop |
| `order_status` | `{ orderId, status }` | Update order status in store |
| `new_subscriber` | `{ shopId }` | Increment subscriber count |
| `shop_updated` | `{ shopId }` | Refetch shop data |

## 7. Debugging

### Backend logs
```bash
tail -f backend/logs/combined.log | grep "Broadcast"
```

### WebSocket logs (browser)
Все WebSocket сообщения логируются в browser console с префиксом `📨`

### Connection status
В dev mode в правом верхнем углу WebApp отображается индикатор:
- 🟢 WS Connected - подключен
- 🔴 WS Disconnected - отключен

## Troubleshooting

### Broadcast не отправляется
- Проверьте `INTERNAL_SECRET` в обоих `.env`
- Убедитесь что backend запущен
- Проверьте логи backend

### WebSocket не подключается
- Проверьте `VITE_API_URL` в `webapp/.env`
- Убедитесь что нет CORS ошибок
- Проверьте browser console

### Обновления не применяются
- Откройте browser console и проверьте incoming messages
- Убедитесь что `shopId`/`orderId` корректные
- Проверьте что store actions вызываются
