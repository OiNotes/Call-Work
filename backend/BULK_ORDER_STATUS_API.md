# Bulk Order Status Update API

## Endpoint

```
POST /api/orders/bulk-status
```

## Description

Updates the status of multiple orders at once. Useful for sellers who need to update many orders simultaneously (e.g., marking multiple orders as "shipped" when processing a batch).

## Authentication

Requires JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Request Body

```json
{
  "order_ids": [1, 3, 5, 7],
  "status": "shipped"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| order_ids | array | Yes | Array of positive integers (order IDs) |
| status | string | Yes | Valid order status: `pending`, `confirmed`, `shipped`, `delivered`, `cancelled` |

## Response

### Success (200)

```json
{
  "success": true,
  "data": {
    "updated_count": 4,
    "orders": [
      {
        "id": 1,
        "status": "shipped",
        "product_name": "iPhone 15 Pro",
        "buyer_username": "john_doe",
        "quantity": 1,
        "total_price": 999.99,
        "currency": "USD",
        "updated_at": "2025-10-28T12:00:00.000Z"
      },
      {
        "id": 3,
        "status": "shipped",
        "product_name": "MacBook Pro",
        "buyer_username": "jane_smith",
        "quantity": 1,
        "total_price": 2499.99,
        "currency": "USD",
        "updated_at": "2025-10-28T12:00:00.000Z"
      }
      // ... more orders
    ]
  }
}
```

## Error Responses

### 400 - Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "order_ids",
      "message": "order_ids must be a non-empty array"
    }
  ]
}
```

**Common validation errors:**
- Empty `order_ids` array
- Invalid order ID format (non-integer, negative, zero)
- Invalid status value
- Missing required fields

### 401 - Unauthorized

```json
{
  "success": false,
  "error": "No token provided. Authorization header must be in format: Bearer <token>"
}
```

**Causes:**
- Missing Authorization header
- Invalid token format
- Expired token

### 403 - Forbidden

```json
{
  "success": false,
  "error": "You do not have permission to update these orders"
}
```

**Causes:**
- User does not own the shop(s) that the orders belong to
- Trying to update orders from another seller

### 404 - Not Found

```json
{
  "success": false,
  "error": "One or more orders not found"
}
```

**Causes:**
- Non-existent order IDs
- Mix of valid and invalid order IDs

### 500 - Internal Server Error

```json
{
  "success": false,
  "error": "Failed to update order statuses"
}
```

**Causes:**
- Database error
- Transaction failure

## Features

### Authorization Check
- Verifies that all orders belong to shops owned by the authenticated user
- Prevents unauthorized status updates

### Transaction Safety
- All updates are executed in a single database transaction
- If any update fails, all changes are rolled back
- Ensures data consistency

### Telegram Notifications
- Automatically sends notifications to buyers about status changes
- Non-blocking (doesn't fail if notification delivery fails)

### Idempotency
- Updating orders to their current status is allowed
- Multiple calls with same parameters are safe

## Usage Examples

### Update multiple orders to shipped

```bash
curl -X POST "http://localhost:3000/api/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "order_ids": [1, 2, 3, 4],
    "status": "shipped"
  }'
```

### Cancel multiple orders

```bash
curl -X POST "http://localhost:3000/api/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "order_ids": [5, 6],
    "status": "cancelled"
  }'
```

### Mark orders as delivered

```bash
curl -X POST "http://localhost:3000/api/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "order_ids": [7, 8, 9],
    "status": "delivered"
  }'
```

## Status Workflow

Valid status transitions:
```
pending → confirmed → shipped → delivered
           ↓
       cancelled
```

**Note:** While the API allows any status change, it's recommended to follow the natural workflow above for consistency.

## Testing

Run manual tests:
```bash
./test_bulk_manual.sh    # Full integration test
./test_bulk_errors.sh    # Error scenarios
```

Run automated tests:
```bash
npm test -- __tests__/integration/bulkOrderStatus.test.js
```

## Performance Considerations

- Optimized for batch updates (1-100 orders)
- Single database query for updates
- Transaction ensures atomicity
- Notifications sent asynchronously

## Security Notes

1. **Authorization:** Only shop owners can update orders
2. **Validation:** All inputs are validated before processing
3. **SQL Injection:** Uses parameterized queries
4. **Rate Limiting:** Protected by global rate limiter

## Implementation Details

**Database Query:**
```sql
UPDATE orders
SET status = $1, updated_at = NOW()
WHERE id = ANY($2::int[])
AND shop_id IN (
  SELECT id FROM shops WHERE owner_id = $3
)
RETURNING *
```

**Files Modified:**
- `backend/src/routes/orders.js` - Route definition
- `backend/src/controllers/orderController.js` - Controller logic
- `backend/src/middleware/validation.js` - Validation rules

## Related Endpoints

- `PUT /api/orders/:id/status` - Update single order status
- `GET /api/orders/sales` - Get all seller orders
- `GET /api/orders/:id` - Get single order details
