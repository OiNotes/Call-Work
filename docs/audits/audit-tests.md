# Test Coverage Audit Report

**Project:** Status Stock 4.0  
**Date:** 2025-11-05  
**Auditor:** Claude (Debug Master Mode)  
**Scope:** Comprehensive test coverage analysis across backend, bot, and webapp

---

## Executive Summary

### Coverage Overview

| Module | Test Files | Coverage Estimate | Status |
|--------|------------|------------------|--------|
| **Backend** | 13 files | ~45-55% | ⚠️ Medium |
| **Bot** | 14 files | ~50-60% | ⚠️ Medium |
| **WebApp** | 0 files | 0% | ❌ Critical |
| **Overall** | 27 files | ~35-40% | ❌ Below Target |

### Critical Findings

🔴 **P0 - CRITICAL:**
- ❌ **Payment verification blockchain logic untested** (security risk)
- ❌ **Subscription payment automation failing** (12/13 tests fail)
- ❌ **Frontend completely untested** (0% coverage)
- ❌ **Crypto service blockchain APIs untested** (BTC/ETH/TRON verification)

🟠 **P1 - HIGH:**
- ⚠️ **Wallet management untested** (duplicate prevention, validation)
- ⚠️ **AI product service untested** (DeepSeek integration)
- ⚠️ **Product sync service untested** (follow functionality)
- ⚠️ **Order cleanup cron job untested** (expired orders)

🟡 **P2 - MEDIUM:**
- ⚠️ **Rate limiting untested** (DDoS protection)
- ⚠️ **WebSocket broadcasts untested** (real-time updates)
- ⚠️ **Polling service untested** (payment detection)

---

## Detailed Analysis

### 1. Backend Test Coverage

#### ✅ **Well-Tested Modules**

**Controllers:**
- ✅ `authController.js` - **90%+ coverage**
  - Registration, login, profile, role switching
  - JWT token validation
  - Duplicate user handling
  - File: `__tests__/auth.test.js` (11 tests)

- ✅ `orderController.js` - **85%+ coverage**
  - Order creation, stock reservation
  - **Race condition prevention** (P0 fix tested!)
  - Order status updates
  - Analytics queries
  - File: `__tests__/orders.test.js` (14 tests)

- ✅ `productController.js` - **80%+ coverage**
  - CRUD operations with worker authorization
  - Bulk delete operations
  - Worker permission checks
  - File: `__tests__/integration/productController.test.js` (10+ tests)

- ✅ `shopController.js` - **75%+ coverage**
  - Shop creation with name validation
  - Case-insensitive uniqueness checks
  - Shop updates
  - File: `__tests__/integration/shopController.test.js` (8+ tests)

**Middleware:**
- ✅ `telegramAuth.js` - **Good coverage**
  - initData validation
  - Signature verification
  - Files: `__tests__/unit/telegramAuth.test.js`, `__tests__/integration/telegramAuth.integration.test.js`

**Partial Coverage:**
- ⚠️ `paymentController.js` - **40% coverage**
  - ✅ Input validation (NULL address, invalid crypto)
  - ✅ Order ownership checks
  - ❌ **Blockchain verification logic UNTESTED** (verifyTransaction calls)
  - ❌ Transaction amount validation untested
  - ❌ Confirmation thresholds untested
  - File: `__tests__/payments.test.js` (6 tests, validation only)

- ⚠️ `webhooks.js` - **60% coverage**
  - ✅ Security: Secret token verification (CVE-PS-001)
  - ✅ Security: Replay attack protection (CVE-PS-002)
  - ✅ Database transactions (CVE-PS-003)
  - ❌ Webhook retries untested
  - ❌ Webhook error handling incomplete
  - File: `__tests__/integration/webhooks.test.js`

#### ❌ **Completely Untested Modules**

**Controllers (0% coverage):**

1. **`subscriptionController.js`** - 0% ❌ CRITICAL
   - `paySubscription()` - Subscription payment processing
   - `upgradeShop()` - Basic → PRO upgrade
   - `getUpgradeCost()` - Prorated pricing calculation
   - `getSubscriptionStatus()` - Current subscription info
   - `getSubscriptionHistory()` - Payment history
   
   **Missing Tests (estimated 18 tests needed):**
   - Payment processing with valid tx_hash
   - Invalid tier handling
   - Already processed transaction (idempotency)
   - Shop ownership verification
   - Tier upgrade calculation
   - Grace period handling
   - Subscription expiry
   
   **Effort:** 8-10 hours

2. **`walletController.js`** - 0% ❌ HIGH RISK
   - `getWallets()` - Retrieve wallet addresses
   - `updateWallets()` - Update wallet addresses
   - **CRITICAL:** Duplicate wallet prevention untested!
   
   **Missing Tests (estimated 12 tests needed):**
   - Get wallets for own shop (success)
   - Get wallets for other's shop (403)
   - Update BTC wallet (valid address)
   - Update with invalid Bitcoin address
   - Update with duplicate address (CRITICAL!)
   - Update with NULL values
   - Multiple currency updates
   
   **Effort:** 4-6 hours

3. **`aiProductController.js`** - 0% ❌
   - `chat()` - AI product management via DeepSeek
   
   **Missing Tests (estimated 6 tests needed):**
   - Valid AI request with product creation
   - Invalid message format
   - Shop ownership validation
   - AI service error handling
   - History management
   
   **Effort:** 3-4 hours

4. **`migrationController.js`** - 0% (if exists)
   - Channel migration logic untested

**Services (0% coverage):**

1. **`crypto.js` - Blockchain Verification** - 0% ❌ CRITICAL P0!
   - `verifyBitcoinTransaction()` - **UNTESTED!**
   - `verifyEthereumTransaction()` - **UNTESTED!**
   - `verifyUSDTTransaction()` - **UNTESTED!**
   - `verifyLitecoinTransaction()` - **UNTESTED!**
   
   **Why Critical:**
   - Security: Wrong amount verification could allow underpayment
   - Security: Address validation bypass risk
   - Security: Confirmation threshold bypass
   - Financial: Direct financial loss risk
   
   **Missing Tests (estimated 25 tests needed):**
   
   **Bitcoin:**
   - Valid BTC transaction (correct amount, address, confirmations)
   - Transaction not found (404)
   - Wrong address in outputs
   - Insufficient amount (tolerance check)
   - Insufficient confirmations (<3)
   - Multiple outputs to same address
   - API timeout/retry logic
   
   **Ethereum:**
   - Valid ETH transaction
   - Wrong recipient address
   - Insufficient amount
   - Pending transaction (0 confirmations)
   - Internal transactions handling
   
   **USDT (Ethereum):**
   - Valid USDT transfer
   - Wrong token contract
   - Transfer event parsing
   
   **USDT (Tron):**
   - Valid TRC20 transfer
   - TronGrid API errors
   
   **Litecoin:**
   - Valid LTC transaction
   - BlockCypher API integration
   
   **Effort:** 12-15 hours

2. **`subscriptionService.js`** - 0% ❌ CRITICAL
   - `processSubscriptionPayment()` - Core subscription logic
   - `upgradeShopToPro()` - PRO upgrade with prorated pricing
   - `checkSubscriptionStatus()` - Expiry checks
   - `renewSubscription()` - Monthly renewal
   
   **Missing Tests (estimated 15 tests needed):**
   - Process new subscription (basic tier)
   - Process new subscription (PRO tier)
   - Duplicate tx_hash rejection
   - Blockchain verification failure
   - Subscription period calculation (30 days)
   - Upgrade with prorated amount
   - Grace period activation
   - Subscription expiry
   - Auto-deactivation after grace period
   
   **Effort:** 8-10 hours

3. **`cryptoPriceService.js`** - 0% ❌
   - `getPrice()` - Crypto price fetching
   - `convertToUSD()` - USD conversion
   - Rate limiting, cache logic
   
   **Missing Tests:** 8 tests  
   **Effort:** 3-4 hours

4. **`blockCypherService.js`** - 0% ❌
   - BlockCypher API integration (BTC, LTC)
   - Webhook subscriptions
   
   **Missing Tests:** 10 tests  
   **Effort:** 4-5 hours

5. **`etherscanService.js`** - 0% ❌
   - Etherscan API integration (ETH, USDT-ERC20)
   - Transaction queries
   
   **Missing Tests:** 10 tests  
   **Effort:** 4-5 hours

6. **`tronService.js`** - 0% ❌
   - TronGrid API integration (USDT-TRC20)
   - TRC20 transfer verification
   
   **Missing Tests:** 8 tests  
   **Effort:** 3-4 hours

7. **`walletService.js`** - 0% ❌ HIGH RISK
   - HD wallet address generation
   - Address derivation paths
   - **CRITICAL:** Wrong derivation could lose funds!
   
   **Missing Tests:** 12 tests  
   **Effort:** 6-8 hours

8. **`pollingService.js`** - 0% ❌
   - ETH/USDT payment detection polling
   - Invoice status updates
   
   **Missing Tests:** 8 tests  
   **Effort:** 4-5 hours

9. **`productSyncService.js`** - 0% ❌
   - Follow product synchronization
   - Markup application
   - Stock tracking
   
   **Missing Tests:** 10 tests  
   **Effort:** 5-6 hours

10. **`orderCleanupService.js`** - 0% ❌
    - Cron job: Expired order cleanup
    - Stock release logic
    
    **Missing Tests:** 6 tests  
    **Effort:** 3-4 hours

11. **`aiProductService.js`** - 0% ❌
    - DeepSeek API integration
    - Product creation via AI
    - Conversation history management
    
    **Missing Tests:** 8 tests  
    **Effort:** 4-5 hours

12. **`deepseekService.js`** - 0% ❌
    - DeepSeek client wrapper
    - Token management
    
    **Missing Tests:** 6 tests  
    **Effort:** 3 hours

13. **`broadcastService.js`** - 0% ❌
    - WebSocket broadcasts
    - Real-time updates
    
    **Missing Tests:** 6 tests  
    **Effort:** 3 hours

14. **`telegram.js`** - 0% ❌
    - Telegram Bot API client
    - Message sending
    - Notifications
    
    **Missing Tests:** 8 tests  
    **Effort:** 4 hours

**Middleware (partial/no coverage):**

1. **`validation.js`** - 0% direct tests ⚠️
   - Covered indirectly via controller tests
   - Should have dedicated unit tests
   
   **Missing Tests:** 15 tests  
   **Effort:** 4-5 hours

2. **`rateLimiter.js`** - 0% ❌
   - Rate limiting logic
   - DDoS protection
   
   **Missing Tests:** 8 tests  
   **Effort:** 3-4 hours

3. **`productLimits.js`** - 0% ❌
   - Product creation limits per tier
   - Limit enforcement
   
   **Missing Tests:** 6 tests  
   **Effort:** 2-3 hours

4. **`errorHandler.js`** - ~40% ⚠️
   - Partially tested via integration tests
   - Error formatting, logging
   
   **Missing Tests:** 8 tests  
   **Effort:** 3 hours

---

### 2. Bot Test Coverage

#### ✅ **Well-Tested Flows**

**Integration Tests:**
- ✅ `/start` flow - Role memory (P0 priority)
  - First start → role selection
  - User with shop → auto seller dashboard
  - Saved role → direct to dashboard
  - File: `tests/integration/start.flow.test.js`

- ✅ Follow shop flow
  - Subscribe/unsubscribe with button flip
  - Idempotency checks
  - File: `tests/integration/subscriptions.flow.test.js`

- ✅ Add product flow
  - Product wizard with price validation (comma→dot)
  - Stock quantity validation
  - File: `tests/integration/addProduct.flow.test.js`

- ✅ Follow management
  - Create/view/delete follows
  - Monitor vs Resell modes
  - Markup percentage updates
  - File: `tests/integration/followShop.flow.test.js`, `tests/integration/followManagement.test.js`

- ✅ Seller orders flow
  - Mark orders as shipped
  - Buyer notifications
  - File: `tests/integration/sellerOrders.flow.test.js`, `tests/integration/markOrdersShipped.scene.test.js`

- ✅ Buyer subscriptions
  - Shop subscription management
  - File: `tests/integration/buyerSubscriptions.flow.test.js`

- ✅ Search shop
  - Search by name
  - Search bug fixes
  - File: `tests/integration/searchShop.bug.test.js`

- ✅ Manage wallets
  - Wallet CRUD operations
  - File: `tests/integration/manageWallets.scene.test.js`

- ✅ AI products integration
  - AI product generation
  - File: `tests/integration/aiProducts.integration.test.js`

**Unit Tests:**
- ✅ API client tests
- ✅ Auth middleware
- ✅ Follow API formatters
- ✅ Format utilities
- ✅ Subscriptions
- ✅ Validation helpers

#### ❌ **Untested Bot Scenes**

1. **`paySubscription.js`** - 0% ❌ CRITICAL
   - Subscription payment scene
   - Tier selection (basic/pro)
   - Payment QR code generation
   - Payment verification
   
   **Missing Tests (estimated 10 tests):**
   - Enter scene → select tier
   - Generate payment QR code
   - Submit valid tx_hash
   - Submit invalid tx_hash
   - Duplicate tx_hash handling
   - Payment timeout
   - Navigation back to shop menu
   
   **Effort:** 5-6 hours

2. **`upgradeShop.js`** - 0% ❌
   - Shop upgrade scene (basic→PRO)
   - Prorated price display
   - Payment flow
   
   **Missing Tests:** 8 tests  
   **Effort:** 4-5 hours

3. **`chooseTier.js`** - 0% ❌
   - Initial tier selection during shop creation
   - Price display for each tier
   
   **Missing Tests:** 6 tests  
   **Effort:** 3 hours

4. **`migrateChannel.js`** - 0% ❌
   - Channel migration wizard
   - Old/new channel validation
   
   **Missing Tests:** 8 tests  
   **Effort:** 4 hours

5. **`manageWorkers.js`** - 0% ❌
   - PRO feature: Worker management
   - Add/remove workers
   - Worker permissions
   
   **Missing Tests:** 10 tests  
   **Effort:** 5-6 hours

#### ❌ **Untested Bot Handlers**

**Buyer Handlers (0% coverage):**
- `buyer/cart.js` - Cart operations
- `buyer/orders.js` - Order history
- `buyer/shops.js` - Shop browsing

**Seller Handlers (partial coverage):**
- Some covered via integration tests
- Missing dedicated unit tests

**Workspace Handlers (0% coverage):**
- `workspace/*.js` - Worker dashboard handlers

**Common Handlers (0% coverage):**
- `common.js` - Shared callback handlers

**Effort:** 15-20 hours for all handlers

---

### 3. Frontend Test Coverage

#### ❌ **CRITICAL: 0% Coverage**

**No test files found!**

Searched patterns:
- `*.test.jsx` - 0 results
- `*.spec.jsx` - 0 results
- `*.test.js` - 0 results

**WebApp Structure:**
- `src/components/` - ~50+ components
- `src/pages/` - ~10 pages
- `src/hooks/` - Custom hooks (useApi, useStore, etc.)
- `src/store/` - Zustand store

**Impact:**
- ❌ UI regressions undetected
- ❌ User flows untested
- ❌ Payment flow untested (CRITICAL!)
- ❌ State management untested
- ❌ API integration untested

**Recommended Tests (estimated 100+ tests):**

**Critical Components (P0):**
1. **`PaymentFlowManager.jsx`** - 15 tests
   - Payment method selection
   - QR code display
   - Transaction hash input
   - Payment verification
   - Success/failure states
   
2. **`CartSheet.jsx`** - 12 tests
   - Add to cart
   - Remove from cart
   - Quantity updates
   - Total calculation
   - Checkout flow

3. **`ProductCard.jsx`** - 8 tests
   - Product display
   - Add to cart button
   - Stock availability
   - Price formatting

**High Priority Components (P1):**
4. **`Settings.jsx`** - 10 tests
   - Wallet management
   - Subscription status
   - Role switching

5. **`SubscriptionModal.jsx`** - 8 tests
   - Tier selection
   - Payment initiation
   - Status display

6. **`WalletsModal.jsx`** - 10 tests
   - Wallet CRUD
   - Address validation
   - Duplicate prevention

**Hooks Testing:**
7. **`useApi.js`** - 15 tests
   - API calls with auth
   - Error handling
   - Loading states
   - Token refresh

8. **`useStore.js`** - 20 tests
   - State updates
   - Cart operations
   - User state
   - Payment state

**Page Testing:**
9. **`Home.jsx`** - 8 tests
10. **`Product.jsx`** - 10 tests
11. **`Cart.jsx`** - 10 tests
12. **`Orders.jsx`** - 8 tests

**Total Estimated Tests:** 134 tests  
**Total Effort:** 60-80 hours

**Testing Stack Needed:**
- Vitest (fast, Vite-native)
- @testing-library/react
- @testing-library/user-event
- msw (API mocking)
- @testing-library/jest-dom

---

## Test Quality Issues

### 1. Failing Tests ❌

**Backend:**
- **`subscription-payments.test.js`** - **12/13 tests FAIL**
  
  **Error:**
  ```
  null value in column "user_id" of relation "shop_subscriptions" violates not-null constraint
  ```
  
  **Root Cause:** Database schema mismatch
  - Tests expect `shop_subscriptions` without `user_id` column
  - Actual schema has `user_id NOT NULL`
  
  **Fix Required:**
  - Add `user_id` to test data creation
  - OR: Update schema to make `user_id` nullable
  - **Effort:** 2-3 hours

### 2. Skipped Tests ⚠️

**Bot:**
- `webappUrl.integration.test.js.skip` - **SKIPPED**
- `webappUrl.test.js.skip` - **SKIPPED**

**Reason:** Dynamic ngrok URL testing disabled

**Recommendation:** Re-enable with mock ngrok URL

### 3. Incomplete Test Coverage

**Payments (CRITICAL):**
- ✅ Input validation tested
- ❌ **Blockchain verification UNTESTED**

**Current:**
```javascript
// payments.test.js - ONLY validates inputs
it('should reject NULL payment_address', ...)
```

**Missing:**
```javascript
// NEEDED: Actual blockchain verification
it('should verify valid BTC transaction on blockchain', ...)
it('should reject transaction with insufficient amount', ...)
it('should reject transaction with < 3 confirmations', ...)
```

### 4. Flaky Tests (Potential)

**Async Issues:**
- Some integration tests don't wait for API calls:
  ```javascript
  await testBot.handleUpdate(callbackUpdate(`shop:view:${shopId}`));
  // ❌ Missing: await new Promise(resolve => setImmediate(resolve));
  ```
  
  **Fix:** Add explicit async waits after async handlers

**Race Conditions:**
- Order creation race condition test relies on Promise.allSettled
- Could be flaky on slow systems

### 5. Missing Edge Cases

**Everywhere:**
- ❌ Network timeout handling
- ❌ Database connection loss
- ❌ API rate limit responses
- ❌ Invalid JSON responses
- ❌ Blockchain API downtime
- ❌ Concurrent user actions

---

## Integration & E2E Gaps

### Missing End-to-End Tests

1. **Full Payment Flow** ❌
   - Browse shop → Add to cart → Checkout → Pay → Verify → Complete
   - **NO E2E test exists!**
   - **Effort:** 8-10 hours

2. **Shop Creation Flow** ⚠️
   - Partial: `createShop.e2e.test.js` exists
   - Missing: Payment verification step

3. **Follow & Resell Flow** ❌
   - Follow shop → Products sync → Buyer purchases → Seller notified
   - **Effort:** 6-8 hours

4. **Subscription Lifecycle** ❌
   - Create shop → Pay subscription → Upgrade to PRO → Renewal → Expiry
   - **Effort:** 8-10 hours

### Missing Contract Tests

- ❌ API contract validation
- ❌ Request/response schema validation
- ❌ Backward compatibility checks

### Missing Performance Tests

- ❌ Load testing (concurrent orders)
- ❌ Stress testing (high traffic)
- ❌ Database query performance
- ❌ API response time benchmarks

---

## Proposed Test Plan

### Phase 1: Critical Security Fixes (P0)
**Target: 80%+ coverage on critical paths**  
**Timeline: 2-3 weeks**

#### Backend (40 hours)
1. **Crypto Service Tests** - 15 hours
   - Bitcoin verification (8 tests)
   - Ethereum verification (8 tests)
   - USDT (ERC20) verification (4 tests)
   - USDT (TRC20) verification (4 tests)
   - Litecoin verification (4 tests)
   - Retry logic & error handling (3 tests)

2. **Payment Controller Integration Tests** - 10 hours
   - End-to-end payment verification (5 tests)
   - Amount validation with tolerance (3 tests)
   - Confirmation threshold checks (3 tests)
   - Double-spending prevention (2 tests)

3. **Subscription Service Tests** - 10 hours
   - Process subscription payment (4 tests)
   - Upgrade with prorated pricing (3 tests)
   - Grace period & expiry (3 tests)
   - Duplicate tx_hash handling (2 tests)

4. **Wallet Controller Tests** - 5 hours
   - Duplicate wallet prevention (3 tests)
   - Address validation (4 tests)
   - Multi-currency updates (2 tests)

#### Frontend (30 hours)
5. **PaymentFlowManager Tests** - 8 hours
   - Full payment wizard flow (5 tests)
   - QR code generation (2 tests)
   - Transaction verification (4 tests)
   - Error states (4 tests)

6. **CartSheet Tests** - 6 hours
   - Cart operations (6 tests)
   - Checkout flow (3 tests)
   - Total calculation (2 tests)

7. **useApi Hook Tests** - 8 hours
   - API calls with auth (5 tests)
   - Error handling (4 tests)
   - Loading states (3 tests)
   - Token refresh (3 tests)

8. **useStore Tests** - 8 hours
   - Cart state (5 tests)
   - Payment state (5 tests)
   - User state (3 tests)
   - Persistence (2 tests)

#### Bot (20 hours)
9. **paySubscription Scene Tests** - 6 hours
   - Tier selection (3 tests)
   - Payment submission (3 tests)
   - Verification handling (4 tests)

10. **upgradeShop Scene Tests** - 5 hours
    - Prorated price calculation (2 tests)
    - Payment flow (3 tests)

11. **Bot Handler Tests** - 9 hours
    - Buyer handlers (4 hours)
    - Seller handlers (3 hours)
    - Workspace handlers (2 hours)

**Phase 1 Total:** ~90 hours (2-3 weeks with 1-2 developers)

---

### Phase 2: High-Value Coverage (P1)
**Target: 70%+ overall coverage**  
**Timeline: 3-4 weeks**

#### Backend Services (30 hours)
1. **BlockCypher Service** - 5 hours
2. **Etherscan Service** - 5 hours
3. **Tron Service** - 4 hours
4. **Wallet Service** (HD wallet) - 8 hours
5. **Polling Service** - 5 hours
6. **Order Cleanup Service** - 3 hours

#### Backend Middleware (15 hours)
7. **Rate Limiter** - 4 hours
8. **Product Limits** - 3 hours
9. **Validation Middleware** - 5 hours
10. **Error Handler** - 3 hours

#### Frontend Components (25 hours)
11. **Settings Page** - 6 hours
12. **ProductCard** - 4 hours
13. **SubscriptionModal** - 5 hours
14. **WalletsModal** - 6 hours
15. **Product Pages** - 4 hours

#### Integration Tests (20 hours)
16. **Full Payment E2E** - 10 hours
17. **Follow & Resell E2E** - 6 hours
18. **Subscription Lifecycle E2E** - 4 hours

**Phase 2 Total:** ~90 hours (3-4 weeks)

---

### Phase 3: Comprehensive Coverage (P2)
**Target: 85%+ overall coverage**  
**Timeline: 2-3 weeks**

#### Remaining Services (20 hours)
1. **Product Sync Service** - 6 hours
2. **AI Product Service** - 5 hours
3. **DeepSeek Service** - 3 hours
4. **Broadcast Service** - 3 hours
5. **Telegram Service** - 3 hours

#### Edge Cases & Error Scenarios (25 hours)
6. **Network Failures** - 8 hours
7. **Database Errors** - 8 hours
8. **API Timeouts** - 5 hours
9. **Concurrent Operations** - 4 hours

#### Frontend Remaining (15 hours)
10. **All Pages** - 10 hours
11. **Remaining Components** - 5 hours

#### Performance & Load Tests (10 hours)
12. **Order Creation Load Test** - 4 hours
13. **Payment Verification Stress** - 3 hours
14. **API Response Benchmarks** - 3 hours

**Phase 3 Total:** ~70 hours (2-3 weeks)

---

## Grand Total Effort Estimate

| Phase | Duration | Tests | Coverage Target |
|-------|----------|-------|----------------|
| **Phase 1 (P0)** | 2-3 weeks | ~130 tests | 80% critical paths |
| **Phase 2 (P1)** | 3-4 weeks | ~110 tests | 70% overall |
| **Phase 3 (P2)** | 2-3 weeks | ~80 tests | 85%+ overall |
| **TOTAL** | 7-10 weeks | ~320 tests | 85%+ coverage |

**Assumptions:**
- 1-2 developers working full-time on tests
- Tests written with AI assistance (Claude/Copilot)
- Test infrastructure already set up (Jest, mocks, helpers)

---

## Immediate Recommendations

### 🚨 DO FIRST (This Week):

1. **Fix Failing Subscription Tests** (2-3 hours)
   - Add `user_id` to `shop_subscriptions` test data
   - Verify all 12 tests pass

2. **Add Crypto Service Tests** (15 hours)
   - Mock blockchain APIs (blockchain.info, Etherscan, TronGrid)
   - Test verification logic for all currencies
   - **This is HIGHEST RISK area!**

3. **Add Payment Controller Integration Tests** (10 hours)
   - End-to-end payment verification
   - Cover ALL scenarios in paymentController.verify()

4. **Setup Frontend Testing** (4 hours)
   - Install Vitest, @testing-library/react
   - Create test helpers & mocks
   - Write 1-2 sample tests to validate setup

### 📅 DO NEXT (Next 2 Weeks):

5. **Complete Frontend Payment Flow Tests** (15 hours)
   - PaymentFlowManager (highest risk)
   - CartSheet
   - useApi & useStore hooks

6. **Add Wallet Controller Tests** (5 hours)
   - Duplicate prevention is CRITICAL!

7. **Add Bot paySubscription Scene Tests** (6 hours)
   - Subscription payment wizard

### 📊 DO LATER (Ongoing):

8. **Achieve 70%+ Backend Coverage** (ongoing)
9. **Achieve 60%+ Frontend Coverage** (ongoing)
10. **Setup CI/CD Coverage Gates** (4 hours)
    - Fail builds if coverage drops below thresholds
    - Backend: 70%
    - Frontend: 60%
    - Critical paths: 90%

---

## Test Infrastructure Improvements

### Current Strengths:
- ✅ Jest configured for ESM
- ✅ Test helpers (testApp, testBot, testDb)
- ✅ Mock factories (updateFactories)
- ✅ Axios mock adapter
- ✅ Coverage reporting (lcov, html)

### Missing Infrastructure:

1. **Frontend Testing Stack** ❌
   ```bash
   npm install --save-dev vitest @testing-library/react \
     @testing-library/user-event @testing-library/jest-dom msw
   ```

2. **Test Factories** ⚠️
   - Missing: Product factory, Order factory
   - Needed for cleaner test setup

3. **API Contract Tests** ❌
   - Consider: Pact.io or OpenAPI validation

4. **Visual Regression Tests** ❌ (optional)
   - Consider: Playwright + Percy

5. **Coverage Thresholds in CI** ❌
   ```javascript
   // jest.config.js
   coverageThreshold: {
     global: {
       statements: 70,
       branches: 65,
       functions: 70,
       lines: 70
     }
   }
   ```

---

## Risk Assessment

### Financial Loss Risk:
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Payment underpayment not detected | 🔴 High | Medium | Test crypto verification ASAP |
| Duplicate wallet accepts payment | 🔴 High | Low | Test wallet controller |
| Wrong HD derivation path | 🔴 High | Low | Test wallet service |
| Overselling (stock race) | 🟠 Medium | Low | Already tested ✅ |

### Security Risk:
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Webhook replay attack | 🔴 High | Medium | Already tested ✅ |
| Auth bypass | 🔴 High | Low | Well tested ✅ |
| SQL injection | 🟠 Medium | Low | Parameterized queries |
| XSS in frontend | 🟡 Low | Low | React auto-escaping |

### Business Logic Risk:
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Subscription expiry not detected | 🟠 Medium | Medium | Test subscription service |
| Product sync fails silently | 🟠 Medium | Medium | Test product sync service |
| Order cleanup deletes wrong orders | 🟠 Medium | Low | Test cleanup service |

---

## Conclusion

### Current State:
- **Backend:** ~45-55% coverage (medium)
- **Bot:** ~50-60% coverage (medium)
- **Frontend:** **0% coverage (critical)**
- **Overall:** ~35-40% coverage (below target)

### Critical Gaps:
1. ❌ **Payment verification blockchain logic** (highest risk)
2. ❌ **Frontend completely untested** (0%)
3. ❌ **Subscription payment tests failing** (12/13 fail)
4. ❌ **Crypto services untested** (security risk)

### Path Forward:
1. **Week 1:** Fix failing tests, add crypto service tests
2. **Week 2-3:** Payment controller integration, frontend setup
3. **Week 4-6:** Frontend payment flow, wallet controller, bot scenes
4. **Week 7-10:** Comprehensive coverage, edge cases, E2E tests

### Success Metrics:
- ✅ All tests pass (0 failures)
- ✅ 80%+ coverage on critical paths (payment, auth, orders)
- ✅ 70%+ backend coverage
- ✅ 60%+ frontend coverage
- ✅ 50%+ bot coverage
- ✅ CI/CD coverage gates enforced

---

**Generated:** 2025-11-05  
**Next Review:** 2025-11-19 (after Phase 1 completion)
