# Internal API - Bot to Backend Communication

Internal API для отправки real-time updates из бота во frontend через WebSocket.

## Endpoint

```
POST /api/internal/broadcast
```

## Authentication

Требуется заголовок `x-internal-secret` со значением из `.env` переменной `INTERNAL_SECRET`.

## Request Body

```json
{
  "type": "string (required)",
  ...additionalData
}
```

## WebSocket Message Types

### 1. Product Added
```javascript
{
  "type": "product_added",
  "shopId": 123,
  "productId": 456
}
```

### 2. Product Updated
```javascript
{
  "type": "product_updated",
  "shopId": 123,
  "productId": 456
}
```

### 3. Product Deleted
```javascript
{
  "type": "product_deleted",
  "shopId": 123,
  "productId": 456
}
```

### 4. Order Status Update
```javascript
{
  "type": "order_status",
  "orderId": 789,
  "status": "confirmed"
}
```

### 5. New Subscriber
```javascript
{
  "type": "new_subscriber",
  "shopId": 123
}
```

### 6. Shop Updated
```javascript
{
  "type": "shop_updated",
  "shopId": 123
}
```

## Example Usage in Bot

```javascript
import axios from 'axios';

async function notifyWebApp(type, data) {
  try {
    await axios.post(
      'http://localhost:3000/api/internal/broadcast',
      { type, ...data },
      {
        headers: {
          'x-internal-secret': process.env.INTERNAL_SECRET
        }
      }
    );
    console.log(`✅ WebSocket broadcast sent: ${type}`);
  } catch (error) {
    console.error('❌ Broadcast failed:', error.message);
  }
}

// Usage examples:
await notifyWebApp('product_added', { shopId: 123, productId: 456 });
await notifyWebApp('order_status', { orderId: 789, status: 'confirmed' });
await notifyWebApp('new_subscriber', { shopId: 123 });
```

## Security

- `INTERNAL_SECRET` должен быть длинным случайным строкой
- Endpoint доступен только с валидным secret
- НЕ делать endpoint публичным
- В production использовать HTTPS

## Setup

1. Добавить в `backend/.env`:
```bash
INTERNAL_SECRET=your-strong-random-secret-here
```

2. Добавить в `bot/.env`:
```bash
INTERNAL_SECRET=same-secret-as-backend
BACKEND_URL=http://localhost:3000
```

3. Использовать в bot handlers при изменениях данных
