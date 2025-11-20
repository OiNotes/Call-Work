# Order State Machine & Idempotency Documentation

## Overview

The order status update system now implements:

1. **State Machine Validation** - enforces valid status transitions
2. **Idempotent Operations** - safe retry semantics for duplicate requests
3. **Atomic Bulk Updates** - transaction-safe multi-order updates with state validation

---

## State Machine Definition

### Valid Status Transitions

```
pending ──────┬──→ confirmed
              ├──→ cancelled
              └──→ expired

confirmed ────┬──→ shipped
              └──→ cancelled

shipped ──────→ delivered

delivered ────→ (terminal)
cancelled ────→ (terminal)
expired ──────→ (terminal)
```

### Implementation

Located in: `/backend/src/utils/orderStateValidator.js`

```javascript
const ORDER_STATE_MACHINE = {
  pending: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  expired: [],
};
```

---

## API Responses

### Single Order Status Update

**Endpoint:** `PATCH /api/orders/:id/status`

#### Success - Normal Update

```json
{
  "success": true,
  "data": {
    "id": 123,
    "status": "confirmed",
    "product_id": 456,
    "buyer_id": 789,
    "quantity": 1,
    "total_price": "199.00",
    "currency": "USD",
    "updated_at": "2025-11-06T10:30:00Z"
  }
}
```

#### Success - Idempotent Update

When the same status is requested (already in target status):

```json
{
  "success": true,
  "idempotent": true,
  "message": "Order is already in status confirmed",
  "data": {
    "id": 123,
    "status": "confirmed",
    "product_id": 456,
    "buyer_id": 789,
    "quantity": 1,
    "total_price": "199.00",
    "currency": "USD",
    "updated_at": "2025-11-05T08:15:00Z"
  }
}
```

**Key differences:**

- HTTP 200 (same as normal update)
- Response includes `"idempotent": true` flag
- Original data is returned (timestamps unchanged)
- No database update occurs

#### Error - Invalid Status Transition

```json
{
  "success": false,
  "error": "Cannot transition from delivered to pending",
  "code": "INVALID_STATUS_TRANSITION"
}
```

**HTTP Status:** 422 Unprocessable Entity

---

### Bulk Order Status Update

**Endpoint:** `POST /api/orders/bulk/status`

```json
{
  "order_ids": [123, 124, 125],
  "status": "shipped"
}
```

#### Success Response

```json
{
  "success": true,
  "data": {
    "updated_count": 2,
    "idempotent_count": 1,
    "total_processed": 3,
    "orders": [
      {
        "id": 123,
        "status": "shipped",
        "product_name": "Premium Keyboard",
        "buyer_username": "john_doe",
        "quantity": 1,
        "total_price": "199.00",
        "currency": "USD",
        "updated_at": "2025-11-06T10:30:00Z"
      },
      {
        "id": 124,
        "status": "shipped",
        "product_name": "Mechanical Mouse",
        "buyer_username": "jane_smith",
        "quantity": 2,
        "total_price": "89.98",
        "currency": "USD",
        "updated_at": "2025-11-06T10:30:00Z"
      },
      {
        "id": 125,
        "status": "shipped",
        "product_name": "USB Hub",
        "buyer_username": "bob_wilson",
        "quantity": 1,
        "total_price": "29.99",
        "currency": "USD",
        "updated_at": "2025-11-05T14:20:00Z"
      }
    ]
  }
}
```

**Key points:**

- `updated_count`: Orders actually updated in database
- `idempotent_count`: Orders already in target status (not updated)
- `total_processed`: Total orders processed
- All orders returned regardless of update status

#### Error - Invalid Transitions

If any order has an invalid transition, the entire bulk operation is rejected:

```json
{
  "success": false,
  "error": "One or more orders cannot transition to the requested status",
  "code": "INVALID_STATUS_TRANSITIONS",
  "details": [
    {
      "order_id": 125,
      "current_status": "delivered",
      "requested_status": "shipped",
      "error": "Cannot transition from delivered to shipped"
    }
  ]
}
```

**HTTP Status:** 422 Unprocessable Entity

**Note:** Transaction is rolled back if any validation fails (all-or-nothing).

---

## Idempotency Semantics

### What is Idempotency?

An operation is **idempotent** if performing it multiple times produces the same result as performing it once.

### Examples

#### Scenario 1: Network Retry (Duplicate Request)

**First Request:**

```bash
PATCH /api/orders/123/status
{ "status": "shipped" }
```

→ Order transitions from `confirmed` to `shipped`
→ Response: `{ "success": true, "data": { status: "shipped" } }`

**Network timeout - client retries...**

**Second Request (identical):**

```bash
PATCH /api/orders/123/status
{ "status": "shipped" }
```

→ Order is already `shipped`
→ Response: `{ "success": true, "idempotent": true, ... }`

**Result:** No duplicate transaction, safe to retry

#### Scenario 2: Webhook Retry

Telegram webhook fires twice with same order update → idempotency prevents double-processing

```javascript
// Both calls are safe
await updateOrderStatus(123, 'delivered');
await updateOrderStatus(123, 'delivered'); // No-op, safe to retry
```

---

## Implementation Details

### Single Update Flow

```
Request: PATCH /api/orders/123/status { status: 'shipped' }
    ↓
Get current order (confirmed)
    ↓
Check authorization (seller owns shop)
    ↓
Validate transition: confirmed → shipped
    ├─ Same status? → Idempotent response
    ├─ Invalid? → 422 error
    └─ Valid? → Proceed to update
    ↓
Database update (status changed, updated_at updated)
    ↓
Send Telegram notification (non-blocking)
    ↓
Return 200 with updated order
```

### Bulk Update Flow

```
Request: POST /api/orders/bulk/status
{ order_ids: [123, 124, 125], status: 'shipped' }
    ↓
BEGIN TRANSACTION
    ↓
Get all orders with ownership check
    ↓
Validate state transitions for ALL orders
    ├─ Any invalid (non-idempotent)? → ROLLBACK + 422
    └─ All valid or idempotent? → Continue
    ↓
UPDATE orders WHERE status != target_status
(Idempotent orders not updated)
    ↓
COMMIT TRANSACTION
    ↓
Send async Telegram notifications
    ↓
Return 200 with statistics
```

---

## Testing Examples

### Unit Tests for State Machine

```javascript
import { validateStatusTransition, isTerminalStatus } from '../src/utils/orderStateValidator.js';

describe('Order State Machine', () => {
  // Valid transitions
  test('allows pending → confirmed', () => {
    const result = validateStatusTransition('pending', 'confirmed');
    expect(result.valid).toBe(true);
    expect(result.idempotent).toBe(false);
  });

  // Idempotent (same status)
  test('detects idempotent update', () => {
    const result = validateStatusTransition('shipped', 'shipped');
    expect(result.valid).toBe(true);
    expect(result.idempotent).toBe(true);
  });

  // Invalid transitions
  test('rejects delivered → pending', () => {
    const result = validateStatusTransition('delivered', 'pending');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot transition');
  });

  // Terminal status
  test('recognizes terminal statuses', () => {
    expect(isTerminalStatus('delivered')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(isTerminalStatus('pending')).toBe(false);
  });
});
```

### Integration Tests

```javascript
import request from 'supertest';

describe('Order Status Update - Idempotency', () => {
  test('duplicate PATCH request returns idempotent response', async () => {
    // First update
    const res1 = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'shipped' });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.idempotent).toBeUndefined();

    // Retry with same request
    const res2 = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'shipped' });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.idempotent).toBe(true);
    expect(res2.body.message).toContain('already in status');
  });

  test('invalid transition returns 422', async () => {
    const res = await request(app)
      .patch(`/api/orders/${deliveredOrderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pending' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  test('bulk update handles mixed idempotent/new updates', async () => {
    const res = await request(app)
      .post('/api/orders/bulk/status')
      .set('Authorization', `Bearer ${token}`)
      .send({
        order_ids: [confirmedOrderId, alreadyShippedOrderId],
        status: 'shipped',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.updated_count).toBe(1);
    expect(res.body.data.idempotent_count).toBe(1);
    expect(res.body.data.total_processed).toBe(2);
  });
});
```

---

## Best Practices

### For API Clients

1. **Always implement retry logic with exponential backoff**

   ```javascript
   async function updateOrderStatus(orderId, status, maxRetries = 3) {
     for (let attempt = 0; attempt < maxRetries; attempt++) {
       try {
         const response = await fetch(`/api/orders/${orderId}/status`, {
           method: 'PATCH',
           body: JSON.stringify({ status }),
         });

         if (response.ok) {
           return response.json(); // Safe, even if retried
         }

         if (response.status !== 422) {
           // Network error, safe to retry
           await delay(Math.pow(2, attempt) * 100);
           continue;
         }

         // 422 = state machine error, don't retry
         throw new Error(`Cannot transition: ${response.statusText}`);
       } catch (err) {
         if (attempt === maxRetries - 1) throw err;
         await delay(Math.pow(2, attempt) * 100);
       }
     }
   }
   ```

2. **Check idempotent flag in webhook handlers**

   ```javascript
   app.post('/webhook/order-update', async (req, res) => {
     const { orderId, status } = req.body;
     const result = await updateOrderStatus(orderId, status);

     if (result.idempotent) {
       logger.info(`Idempotent webhook: order already ${status}`);
     } else {
       logger.info(`Updated order: ${orderId} → ${status}`);
     }
   });
   ```

3. **Don't retry on 422 errors** (state machine violation)
   ```javascript
   if (response.status === 422) {
     // This is a business logic error, not a temporary failure
     logger.error(`Invalid status transition: ${response.data.error}`);
     // Don't retry, fix the business logic
   }
   ```

### For Sellers (Telegram Bot)

1. **Safe bulk operations**

   ```javascript
   // Can safely call this multiple times (idempotent)
   const result = await ctx.api.orders.bulkUpdateStatus({
     order_ids: [123, 124, 125],
     status: 'shipped',
   });

   // Even if network fails and you retry, no duplicates
   ```

2. **Atomic updates**
   ```javascript
   // All orders updated together (transaction)
   // If any order can't transition, ALL are rolled back
   // Safe from partial updates
   ```

---

## Monitoring & Debugging

### Log Messages

**Successful transition:**

```
INFO: Updated order status: 123 (confirmed → shipped)
```

**Idempotent update:**

```
INFO: Idempotent status update for order 123: already in status shipped
```

**Invalid transition:**

```
WARN: Invalid state transition: delivered → pending for order 125
```

**Bulk validation failure:**

```
WARN: Bulk update rejected due to invalid transitions: [
  { order_id: 125, current_status: 'delivered', requested_status: 'pending', ... }
]
```

### Metrics to Track

1. **Idempotency rate** - percentage of requests that are idempotent
2. **Invalid transitions** - business logic errors (should be rare)
3. **Bulk update success rate** - transaction rollback frequency
4. **Notification delivery** - ensure Telegram notifications sent

---

## Migration Notes

### From Previous Implementation

**Before:**

```javascript
// No state machine validation
await updateStatus(orderId, 'invalid_status'); // Succeeds with bad data
await updateStatus(orderId, 'shipped'); // Duplicate succeeds twice
```

**After:**

```javascript
// State machine enforced
await updateStatus(orderId, 'invalid_status'); // 422 error
await updateStatus(orderId, 'shipped'); // First succeeds, second is idempotent
```

### Database Compatibility

No schema changes required. All logic is application-level.

Existing orders maintain their current statuses and continue to validate against the state machine for future transitions.

---

## Files Modified

1. **Created:** `/backend/src/utils/orderStateValidator.js`
   - State machine definition
   - Transition validation logic
   - Helper functions

2. **Updated:** `/backend/src/controllers/orderController.js`
   - `updateStatus()` - added state validation + idempotency
   - `bulkUpdateStatus()` - added state validation + idempotency tracking

3. **Documentation:** This file

---

## Related Issues Resolved

- State machine violations prevented (422 errors)
- Idempotent retries supported (safe duplicate requests)
- Atomic bulk updates (transaction-safe)
- Clear error messages (debugging easier)
