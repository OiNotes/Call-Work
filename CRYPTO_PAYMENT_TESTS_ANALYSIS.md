# Crypto Payment Tests Analysis

## Executive Summary

The backend has a **comprehensive test suite for crypto payments**, but with **critical gaps**:

### What EXISTS (Well-Covered)
- Unit tests for crypto verification logic (BTC, ETH, LTC, USDT)
- Integration tests for order payments (validation, race conditions)
- Payment verification logic with amount tolerance bounds
- Database helpers and test fixtures
- HD wallet invoice generation tests

### What's SKIPPED (NOT Running)
- All webhook integration tests (13 tests in `webhooks.test.js`)
- All subscription payment tests (6 tests in `subscription-payments.test.js`)
- **Reason:** BlockCypher API mocks are missing

### Missing for E2E Testing
- No tests simulating blockchain polling (ETH, USDT TRC-20)
- No tests for subscription tier payment flows
- No tests for multi-currency payment scenarios
- No tests for payment expiration and cleanup
- No mock data generators for blockchain responses

---

## 1. Integration Tests Found

### File: `backend/__tests__/integration/subscription-payments.test.js` (SKIPPED)
**Status:** `describe.skip()` - 6 tests disabled

**Test cases (would verify if enabled):**

```
A. Invoice Structure Tests (4 tests)
  - Should create invoice with subscription_id (not order_id)
  - Should create invoice with correct tier pricing
  - Should enforce mutually exclusive constraint (order_id XOR subscription_id)
  - Should allow invoice with only order_id

B. Invoice Lifecycle Tests (2 tests)
  - Should track invoice status from pending to paid
  - Should support expired status

C. Webhook Handling Tests - BlockCypher (6 tests)
  - Should activate subscription on confirmed BTC payment
  - Should update shop tier and subscription_status
  - Should set next_payment_due to +30 days
  - Should handle subscription payments separately from orders
  - Should update invoice status to paid
  - Should not activate if payment amount insufficient

D. Polling Service Simulation Tests - ETH/USDT (1 test)
  - Should activate subscription on ETH payment detection
```

**Payment simulation approach:**
- Creates test subscription with tier (basic=$25, pro=$35)
- Simulates BlockCypher webhook payload with transaction hash
- Manually updates database to simulate payment confirmation
- Verifies shop tier, subscription status, and next_payment_due date

**Test utilities used:**
- `createTestSubscription()` - creates shop_subscriptions record
- `createTestInvoice()` - creates invoices record
- `pool.query()` - direct database operations
- Manual webhook payload simulation

---

### File: `backend/__tests__/integration/webhooks.test.js` (SKIPPED)
**Status:** `describe.skip()` - 13 tests disabled

**Test cases (security verification):**

```
CVE-PS-001: Secret token verification (5 tests)
  - Should accept webhook with valid token in query parameter
  - Should accept webhook with valid token in header
  - Should reject webhook with invalid token
  - Should reject webhook with missing token
  - Should allow webhook if BLOCKCYPHER_WEBHOOK_SECRET not set

CVE-PS-002: Replay attack protection (4 tests)
  - Should process webhook first time
  - Should reject replay of same webhook (same confirmations)
  - Should allow same tx with different confirmations
  - Should store complete webhook payload for forensics

CVE-PS-003: Database transactions (5 tests)
  - Should commit transaction on success
  - Should rollback transaction on error
  - Should update order status when payment confirmed
  - Should keep order pending if confirmations insufficient
  - Should handle confirmation threshold from environment

Edge cases and validation (2 tests)
  - Should handle multiple outputs correctly
  - Should update existing payment confirmations
```

---

### File: `backend/__tests__/payment/hd-wallet-invoice.test.js` (ACTIVE)
**Status:** Running - 8 tests enabled

**Test cases:**

```
POST /api/orders/:id/invoice (8 tests)
  - Should generate BTC invoice with unique HD wallet address
  - Should generate ETH invoice with unique address
  - Should generate unique addresses for different orders
  - Should return existing pending invoice if already generated
  - Should reject invalid chain
  - Should reject unauthorized access
  - Should use real-time crypto prices
  - Should map USDT to USDT_TRC20 by default
```

**What it tests:**
- HD wallet derivation (unique addresses per order)
- Cryptocurrency price fetching and conversion
- Invoice expiration (30 minutes)
- Database persistence
- Address format validation

---

### File: `backend/__tests__/payments.test.js` (ACTIVE)
**Status:** Running - 6 tests enabled

**Test cases:**

```
POST /api/payments/verify (6 tests)
  - Should reject payment verification with NULL payment_address
  - Should reject payment verification with empty payment_address
  - Should reject payment verification with invalid crypto type
  - Should reject payment verification without authentication
  - Should reject payment verification for non-existent order
  - Should reject payment verification with missing tx_hash
```

**What it tests:**
- Input validation (wallet config, auth, currency)
- Error handling (missing fields, invalid orders)
- Authorization (JWT token required)

---

### File: `backend/__tests__/orders.test.js` (ACTIVE)
**Status:** Running - 20+ tests enabled

**Key payment-related tests:**

```
Race Condition Prevention (1 test)
  - Should prevent race condition (overselling)
    Creates product with 5 stock, simulates 2 concurrent orders for 3 items each
    Verifies only 1 order succeeds via FOR UPDATE lock

Order Status Management (3 tests)
  - Should create order successfully with sufficient stock
  - Should reject order with insufficient stock
  - Should update order status and handle delivery

Order Analytics (3 tests)
  - Should return analytics for seller with orders
  - Should return zero statistics for seller with no orders
  - Should reject analytics request without dates
```

---

## 2. Test Helpers and Utilities

### Location: `backend/__tests__/helpers/testDb.js`

**Helper Functions:**

```javascript
// Connection management
getTestPool()                          // Returns test database pool
closeTestDb()                          // Closes connection
cleanupTestData()                      // Deletes all test data with CASCADE

// Data creation helpers
createTestUser(userData)               // Creates user with unique telegram_id
createTestShop(ownerId, shopData)      // Creates shop owned by user
createTestProduct(shopId, productData) // Creates product in shop
createTestOrder(buyerId, productId, shopId, orderData)
createTestInvoice(orderId, invoiceData)

// Read helpers
getUserByTelegramId(telegramId)
getShopById(shopId)
getProductById(productId)
```

**Test User ID Convention:**
- Range: `9000000000` to `9000999999`
- Pattern: `9000000000 + testUserCounter + timestamp`
- Auto-cleanup: CASCADE delete for all `telegram_id >= 9000000000`

---

### Location: `backend/__tests__/helpers/testApp.js`

**Test Express App Factory:**

```javascript
createTestApp()
  // Creates minimal Express app with:
  // - Auth routes (JWT-based)
  // - Shop/Product/Order routes
  // - Payment routes
  // - Subscription routes
  // - Error handler middleware
```

---

## 3. Existing Test Fixtures

### Invoice Fixtures (Created Dynamically)

```javascript
// From subscription-payments.test.js
createTestInvoice(subscriptionId, {
  chain: 'BTC',              // or 'LTC', 'ETH', 'USDT_TRC20'
  address: 'bc1test...',     // Blockchain address
  expected_amount: 0.001,    // Expected crypto amount
  status: 'pending',         // or 'paid', 'expired'
  currency: 'BTC'            // or 'ETH', 'LTC', 'USDT'
})
```

### BlockCypher Webhook Payload

```javascript
// From subscription-payments.test.js
{
  hash: 'test_tx_hash_<timestamp>',
  confirmations: 3,
  block_height: 700000,
  total: 100000,                       // satoshis
  outputs: [{
    addresses: ['bc1test_address'],
    value: 100000
  }]
}
```

### Subscription Payment Fixtures

```javascript
{
  tier: 'basic',                        // or 'pro'
  amount: 25.0,                         // USD for basic, 35 for pro
  tx_hash: 'test_subscription_<id>_<timestamp>',
  currency: 'USDT',
  period_start: NOW(),
  period_end: NOW() + 30 days,
  status: 'active',
  verified_at: NOW()
}
```

---

## 4. Service Unit Tests

### File: `backend/__tests__/services/crypto.test.js` (ACTIVE)
**Status:** Running - 40+ unit tests enabled

**Test Structure:**

```
Bitcoin Verification (10 tests)
├── Success Cases (4)
│   ├── Exact amount
│   ├── Overpayment
│   ├── Tolerance bounds (0.5%)
│   └── Pending transaction
└── Failure Cases - CRITICAL Security (6)
    ├── Insufficient amount
    ├── Wrong address
    ├── Transaction not found
    ├── API errors with retry
    ├── Amount outside tolerance
    └── Retry logic

Ethereum Verification (10 tests)
├── Success Cases (2)
│   ├── Valid ETH payment
│   └── Case-insensitive address matching
└── Failure Cases - CRITICAL Security (8)
    ├── Insufficient amount
    ├── Reverted transaction (status = 0x0)
    ├── Transaction not found
    └── Wrong address

USDT TRC-20 Verification (4 tests)
├── Success Cases (1)
└── Failure Cases (3)
    ├── Transaction not found
    ├── Failed transaction
    └── Non-USDT contract

Litecoin Verification (6 tests)
├── Success Cases (1)
└── Failure Cases (5)
    ├── Insufficient amount
    ├── Transaction not found
    └── Wrong address

Universal Router (3 tests)
├── BTC routing
├── ETH routing
└── Unsupported currency rejection
```

**Mocking Strategy:**

```javascript
jest.unstable_mockModule('axios', () => ({
  default: { get: jest.fn(), post: jest.fn() }
}));

axios.get.mockImplementation((url) => {
  if (url.includes('latestblock')) {
    return Promise.resolve({ data: { height: 800003 } });
  }
  return Promise.resolve({ data: mockTx });
});
```

---

## 5. Mock Strategies

### Current Approach

**Libraries:**
- `jest.unstable_mockModule()` - ESM mocking (axios, logger)
- Manual mock responses in test handlers
- `supertest` - HTTP testing
- `JWT` - Token generation

### Missing Mocking Infrastructure

**Not Implemented:**
- No `nock` for HTTP mocking
- No `msw` (Mock Service Worker)
- No fixture files for blockchain responses
- No mock data generators
- No webhook replay testing

---

## 6. Gap Analysis

### What WORKS Well ✅
- Unit tests for crypto verification (BTC, ETH, LTC, USDT)
- Order creation with stock validation
- Race condition prevention (FOR UPDATE locks)
- HD wallet invoice generation
- Input validation (auth, fields, types)
- Payment tolerance bounds
- Database transaction atomicity

### What's TESTED But SKIPPED ⏸
- Webhook integration tests (BlockCypher)
- Subscription payment flows
- Replay attack protection
- Webhook token authentication

**Reason:** BlockCypher API mocks are missing

### What's MISSING (NO Tests) ❌

#### 1. End-to-End Payment Flows
- Complete order payment → confirmation → delivery
- Complete subscription payment → activation → renewal
- ETH polling detection and activation
- USDT TRC-20 polling detection and activation

#### 2. Webhook Handling
- BlockCypher webhook parsing
- Webhook token validation in real scenario
- Replay attack simulation
- Payment confirmation with confirmations escalation

#### 3. Subscription Scenarios
- Tier upgrade (basic→pro)
- Payment renewal (next_payment_due + 30 days)
- Auto-create shop on subscription payment
- Grace period handling

#### 4. Edge Cases
- Invoice expiration handling
- Payment after invoice expired
- Multiple invoices for same order
- Partial payments (insufficient amount)
- Double payments (same tx_hash twice)
- Overpayment handling

#### 5. Polling Service Tests
- ETH transaction discovery by address
- USDT transfer event parsing
- Tron transaction confirmation tracking
- Expired invoice cleanup
- User notification delivery

#### 6. Integration with Orders
- Order status transitions on payment
- Stock deduction after confirmation
- Product deletion while invoice pending

#### 7. Error Scenarios
- Blockchain API unavailable
- Network timeout during polling
- Database connection lost
- Notification service failure

---

## 7. Blockchain Service Functions

### BlockCypher Service (BTC, LTC)

```
registerWebhook(chain, address, callbackUrl, confirmations)
unregisterWebhook(webhookId, chain)
getTransaction(chain, txHash)
verifyPayment(chain, txHash, expectedAddress, expectedAmount)
getAddressInfo(chain, address)
getBlockHeight(chain)

Supported: BTC, LTC
Rate Limit: 3 req/sec
Retry: Exponential backoff (max 3 attempts)
```

### Etherscan Service (ETH, USDT ERC-20)

```
getAddressTransactions(address)
getTokenTransfers(address, contractAddress)
getTransaction(txHash)
getTransactionReceipt(txHash)
getCurrentBlockNumber()
verifyEthPayment(txHash, expectedAddress, expectedAmount)
verifyUsdtPayment(txHash, expectedAddress, expectedAmount)

Supported: ETH, USDT (ERC-20)
Rate Limit: 5 req/sec
Caching: 60 second TTL
```

### Tron Service (USDT TRC-20)

```
getTrc20Transfers(address, contractAddress, limit, onlyConfirmed)
getTransaction(txId)
getTransactionInfo(txId)
getCurrentBlockNumber()
verifyPayment(txId, expectedAddress, expectedAmount)
hexToBase58(hexAddress)
base58ToHex(base58Address)

Supported: USDT (TRC-20)
Rate Limit: 10 req/sec
Contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
```

### Polling Service

```
startPolling()              # Every 60 seconds
stopPolling()
getStats()
resetStats()
manualPoll()

Checks:
  - Pending invoices for ETH and USDT TRC-20
  - Fallback polling for BTC/LTC
  - Confirms payments and updates status
  - Notifies users via Telegram
  - Handles expired invoices
  - Auto-creates shops for subscriptions
```

---

## 8. Test Data Summary

### Test User IDs
- Range: `9000000000` to `9000999999`
- Auto-cleanup via CASCADE delete

### Blockchain Test Addresses

**Bitcoin:**
- `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh`
- `bc1test123456789`

**Ethereum:**
- `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb`
- Case-insensitive matching

**Litecoin:**
- `LTC1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`

**Tron:**
- Contract: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` (USDT TRC-20)

### Confirmation Requirements

```
BTC: 3 confirmations
LTC: 6 confirmations
ETH: 12 confirmations
USDT_TRC20: 1 confirmation
```

### Subscription Tier Pricing

```
Basic: $25 USD (~0.001 BTC, ~0.02 ETH, ~25 USDT)
Pro: $35 USD (~0.0014 BTC, ~0.029 ETH, ~35 USDT)
```

---

## 9. Recommendations

### Priority 1: Enable Existing Tests
Install `nock` library and mock BlockCypher API to enable:
- `webhooks.test.js` (13 tests)
- `subscription-payments.test.js` (6 tests)

Estimated effort: 2-3 hours

### Priority 2: Add Missing Tests
1. Polling Service Tests (4-5 hours)
2. Subscription Flow Tests (3-4 hours)
3. Multi-Currency Tests (2-3 hours)
4. Edge Case Tests (2-3 hours)

### Priority 3: Test Fixtures Library
Create comprehensive fixtures for all blockchain APIs
Estimated effort: 2-3 hours

### Priority 4: Integration Testing Tools
Helper functions for complete E2E scenarios
Estimated effort: 2-3 hours

**Total effort for full E2E coverage: 11-15 hours**

---

## Summary

### Test Count by Status

| Category | Count | Status |
|----------|-------|--------|
| Unit Tests (crypto.test.js) | 40+ | ✅ Active |
| Invoice Generation Tests | 8 | ✅ Active |
| Order Tests | 20+ | ✅ Active |
| Webhook Tests | 13 | ⏸ Skipped |
| Subscription Tests | 6 | ⏸ Skipped |
| Polling Service Tests | 0 | ❌ Missing |
| Subscription Flow Tests | 0 | ❌ Missing |
| **TOTAL** | **87+** | **51 tests enabled, 19 skipped, 17+ missing** |

### Critical Path to Production

1. ✅ Crypto verification logic (complete)
2. ✅ Invoice generation (complete)
3. ⏸ Webhook handling (blocked on mocks)
4. ❌ Subscription flows (not implemented)
5. ❌ Polling service (not tested)
6. ❌ Complete E2E scenarios (not tested)
