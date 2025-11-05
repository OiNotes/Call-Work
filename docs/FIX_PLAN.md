# 🛠️ COMPREHENSIVE FIX PLAN

> **Total Issues Found:** 182  
> **P0 (Critical):** 31 - Must fix now  
> **P1 (High):** 63 - Fix before launch  
> **P2 (Medium):** 70 - Fix after launch  
> **P3 (Low):** 18 - Technical debt  

---

## Issues Breakdown by Priority

| Priority | Count | Total Effort | Timeline |
|----------|-------|--------------|----------|
| P0 (Critical) | 31 | 85-105 hours | This week (5 days) |
| P1 (High) | 63 | 180-220 hours | Week 2-4 (3 weeks) |
| P2 (Medium) | 70 | 140-180 hours | Week 5-9 (5 weeks) |
| P3 (Low) | 18 | 40-60 hours | Backlog (ongoing) |
| **TOTAL** | **182** | **445-565 hours** | **~13-16 weeks** |

---

## Issues Breakdown by Component

| Component | P0 | P1 | P2 | P3 | Total |
|-----------|----|----|----|----|-------|
| Backend | 3 | 8 | 12 | 5 | 28 |
| Frontend | 4 | 12 | 18 | 13 | 47 |
| Security | 8 | 7 | 5 | 3 | 23 |
| Payment | 5 | 7 | 8 | 4 | 24 |
| Bot | 8 | 15 | 18 | 6 | 47 |
| Database | 3 | 8 | 12 | 5 | 28 |
| API | 8 | 15 | 14 | 6 | 43 |
| Tests | 1 | 8 | 10 | 4 | 23 |
| Code Quality | 0 | 4 | 14 | 5 | 23 |
| Performance | 1 | 5 | 7 | 3 | 16 |
| **TOTAL** | **31** | **63** | **70** | **18** | **182** |

---

## PHASE 1: P0 CRITICAL FIXES (This Week - Days 1-5)

**Timeline:** Days 1-5  
**Total Issues:** 31  
**Total Effort:** 85-105 hours  
**Required:** 2 developers working full-time  

### Day 1: Security P0 (8 issues - 18-22 hours)

#### [P0-SEC-1] Missing Authorization on Shop Details Endpoint
- **Source:** audit-api.md
- **File:** backend/src/routes/shops.js:78
- **Assigned to:** backend-architect subagent
- **Effort:** 30 minutes
- **Priority:** 1
- **Dependencies:** None
- **Fix Steps:**
  1. Add verifyToken middleware
  2. Add requireShopOwner middleware
  3. Test authorization flow
- **Verification:**
  - [ ] Fix applied
  - [ ] Authorization tests added
  - [ ] Manual test: try accessing other user's shop (expect 403)

#### [P0-SEC-2] Unauthorized Wallet Access
- **Source:** audit-api.md
- **File:** backend/src/routes/shops.js:62-68
- **Effort:** 45 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Add orderQueries.userHasPendingOrderForShop() helper
  2. Update getWallets() to check ownership OR pending order
  3. Add tests
- **Verification:**
  - [ ] Fix applied
  - [ ] Test: shop owner can access wallets
  - [ ] Test: buyer with pending order can access
  - [ ] Test: random user gets 403

#### [P0-SEC-3] Test Authentication Bypass
- **Source:** audit-security.md
- **File:** backend/src/middleware/auth.js:29-38
- **Effort:** 15 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Delete test shortcut code entirely
  2. Update tests to use real JWT tokens
  3. Verify production deployment env vars
- **Verification:**
  - [ ] Test shortcut removed
  - [ ] All auth tests passing with real tokens
  - [ ] Production ENV verified (NODE_ENV=production)

#### [P0-SEC-4] Missing Rate Limiting on Resource Creation
- **Source:** audit-security.md
- **File:** backend/src/routes/shops.js:14, products.js:14
- **Effort:** 30 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Create shopCreationLimiter (5 shops/hour)
  2. Create productCreationLimiter (20 products/minute)
  3. Apply to routes
  4. Test limits
- **Verification:**
  - [ ] Shop creation limited to 5/hour
  - [ ] Product creation limited to 20/minute
  - [ ] 429 status returned after limit

#### [P0-SEC-5] SSRF via Unvalidated Logo URL
- **Source:** audit-security.md
- **File:** backend/src/middleware/validation.js:46-48
- **Effort:** 1 hour
- **Priority:** 1
- **Fix Steps:**
  1. Create isInternalUrl() validator
  2. Block localhost, 127.0.0.1, 169.254.169.254
  3. Block private IP ranges (10.x, 172.16.x, 192.168.x)
  4. Add to shopValidation.create
  5. Test with malicious URLs
- **Verification:**
  - [ ] Internal IPs rejected
  - [ ] Cloud metadata IPs rejected
  - [ ] Valid external URLs accepted
  - [ ] Tests added

#### [P0-SEC-6] Missing CSRF Protection
- **Source:** audit-security.md
- **Effort:** 2 hours
- **Priority:** 1
- **Fix Steps:**
  1. Install csurf package
  2. Create csrfProtection middleware
  3. Add GET /api/csrf-token endpoint
  4. Apply to state-changing routes
  5. Update frontend to include CSRF token
- **Verification:**
  - [ ] CSRF token generated
  - [ ] POST/PUT/DELETE require valid token
  - [ ] Invalid token returns 403
  - [ ] Frontend updated

#### [P0-SEC-7] Sensitive Data in Error Responses
- **Source:** audit-security.md
- **File:** backend/src/middleware/errorHandler.js:24-33
- **Effort:** 45 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Update errorHandler to never include stack/details
  2. Update dbErrorHandler to return generic messages
  3. Log full errors internally only
  4. Test error responses in production mode
- **Verification:**
  - [ ] No stack traces in responses
  - [ ] No constraint names leaked
  - [ ] Generic error messages only
  - [ ] Full errors logged internally

#### [P0-SEC-8] Hardcoded Internal Secret
- **Source:** audit-backend.md
- **File:** backend/src/routes/internal.js:13
- **Effort:** 5 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Remove fallback 'change-me-in-production'
  2. Throw error if INTERNAL_SECRET not set
  3. Update .env.example
  4. Verify production deployment
- **Verification:**
  - [ ] No fallback secret
  - [ ] Server fails to start without env var
  - [ ] Production secret rotated

**Day 1 Deliverables:**
- [ ] All 8 security P0 issues fixed
- [ ] Security tests added
- [ ] Code reviewed
- [ ] Merged to main

---

### Day 2: Payment P0 (5 issues - 12-15 hours)

#### [P0-PAY-1] tx_hash Cross-Order Validation
- **Source:** audit-payment.md
- **File:** backend/src/controllers/paymentController.js:156
- **Effort:** 15 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Add check: if (existingTx.order_id !== orderId)
  2. Return error with usedForOrder info
  3. Add test: create 2 orders, pay 1, try to reuse tx_hash
- **Verification:**
  - [ ] Duplicate tx_hash for different order rejected
  - [ ] Same order, same tx_hash allowed (idempotency)
  - [ ] Test added

#### [P0-PAY-2] Invoice Generation Implementation
- **Source:** audit-payment.md
- **File:** backend/src/controllers/orderController.js:444
- **Effort:** 4-6 hours (LONGEST)
- **Priority:** 1
- **Fix Steps:**
  1. Create backend/src/services/walletService.js
  2. Implement HD wallet address derivation (BIP44)
  3. Add invoiceQueries.create() logic
  4. Integrate cryptoPriceService for real-time rates
  5. Register BlockCypher/Etherscan webhooks
  6. Add invoice expiry tracking
  7. Test address generation uniqueness
- **Verification:**
  - [ ] Unique addresses generated for each invoice
  - [ ] Real-time crypto prices used
  - [ ] Invoice stored in database
  - [ ] Webhooks registered
  - [ ] Expiry time set (1 hour)

#### [P0-PAY-3] Webhook Signature Validation
- **Source:** audit-payment.md
- **File:** backend/src/routes/webhooks.js
- **Effort:** 2 hours
- **Priority:** 1
- **Fix Steps:**
  1. Add webhook deduplication (processed_webhooks table)
  2. Always verify against blockchain API
  3. Reject double-spend transactions
  4. Store webhook for replay prevention
  5. Add tests for fake webhooks
- **Verification:**
  - [ ] Fake webhooks rejected
  - [ ] Real transactions verified on blockchain
  - [ ] Duplicate webhooks ignored
  - [ ] Tests added

#### [P0-PAY-4] Invoice Cleanup Cron Job
- **Source:** audit-payment.md
- **File:** backend/database/schema.sql:724
- **Effort:** 1 hour
- **Priority:** 1
- **Fix Steps:**
  1. Create backend/src/jobs/invoiceCleanup.js
  2. Schedule every 10 minutes
  3. Mark expired invoices as 'expired'
  4. Unregister webhooks
  5. Add logging
  6. Test with mock expired invoice
- **Verification:**
  - [ ] Cron job runs every 10 minutes
  - [ ] Expired invoices marked correctly
  - [ ] Webhooks unregistered
  - [ ] Logs visible

#### [P0-PAY-5] Amount Rounding with Decimal.js
- **Source:** audit-payment.md
- **File:** backend/src/services/cryptoPriceService.js:53
- **Effort:** 2 hours
- **Priority:** 1
- **Dependencies:** npm install decimal.js
- **Fix Steps:**
  1. Install decimal.js package
  2. Update roundCryptoAmount() to use Decimal
  3. Update all crypto amount calculations
  4. Test precision with edge cases
  5. Update database fields if needed
- **Verification:**
  - [ ] No precision loss in calculations
  - [ ] 0.99999998 BTC handled correctly
  - [ ] Tests added for precision
  - [ ] All payment flows tested

**Day 2 Deliverables:**
- [ ] All 5 payment P0 issues fixed
- [ ] Payment verification working end-to-end
- [ ] HD wallet address generation tested
- [ ] Merged to main

---

### Day 3: Backend + Database P0 (6 issues - 6-8 hours)

#### [P0-BACK-1] Hardcoded Promo Code
- **Source:** audit-backend.md
- **File:** backend/src/controllers/shopController.js:11
- **Effort:** 30 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Move PROMO_CODE to environment variable
  2. Create promo_codes table
  3. Implement dynamic promo validation
  4. Migrate existing code
  5. Update .env.example
- **Verification:**
  - [ ] Promo code from database
  - [ ] Multiple codes supported
  - [ ] Usage tracking works
  - [ ] Tests added

#### [P0-BACK-2] Connection Leak in Transactions
- **Source:** audit-backend.md
- **Files:** Multiple controllers
- **Effort:** 1 hour
- **Priority:** 1
- **Fix Steps:**
  1. Audit all transaction flows
  2. Wrap ROLLBACK in try-catch
  3. Ensure client.release() always executes
  4. Test error scenarios
  5. Update 6 affected functions
- **Verification:**
  - [ ] All transaction flows updated
  - [ ] Rollback errors caught
  - [ ] Connection pool stable
  - [ ] Tests added

#### [P0-BACK-3] Unbounded Query Results
- **Source:** audit-backend.md
- **File:** backend/src/controllers/orderController.js:203
- **Effort:** 10 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Define MAX_LIMIT constant (100)
  2. Apply Math.min(limit, MAX_LIMIT)
  3. Update all list endpoints
  4. Add tests
- **Verification:**
  - [ ] MAX_LIMIT enforced
  - [ ] limit=999999 capped at 100
  - [ ] All list endpoints updated
  - [ ] Tests added

#### [P0-DB-1] Wallet Uniqueness Constraints
- **Source:** audit-database.md
- **File:** backend/database/schema.sql:50-53
- **Effort:** 30 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Create migration 022_add_wallet_constraints.sql
  2. Add UNIQUE constraints for each wallet type
  3. Handle existing duplicates (if any)
  4. Run migration
  5. Test duplicate prevention
- **Verification:**
  - [ ] Duplicate wallet_btc rejected
  - [ ] Duplicate wallet_eth rejected
  - [ ] Duplicate wallet_usdt rejected
  - [ ] Duplicate wallet_ltc rejected

#### [P0-DB-2] shopFollowController Rollback
- **Source:** audit-database.md
- **File:** backend/src/controllers/shopFollowController.js:343
- **Effort:** 20 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Move syncAllProductsForFollow inside transaction
  2. Pass client to sync function
  3. Test sync failure rollback
  4. Verify atomicity
- **Verification:**
  - [ ] Product sync inside transaction
  - [ ] Sync failure rolls back follow
  - [ ] No orphaned data
  - [ ] Tests added

#### [P0-DB-3] getMyOrders Unbounded Query
- **Source:** audit-database.md
- **File:** backend/src/controllers/orderController.js:203
- **Effort:** 10 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Add MAX_LIMIT enforcement
  2. Add status filter validation
  3. Test with large datasets
- **Verification:**
  - [ ] MAX_LIMIT applied
  - [ ] Status filter validated
  - [ ] Tests added

**Day 3 Deliverables:**
- [ ] All 6 backend/database P0 fixed
- [ ] Database constraints added
- [ ] Transaction safety verified
- [ ] Merged to main

---

### Day 4: Frontend + Bot Priority P0 (12 issues - 20-30 hours)

#### [P0-FE-1] FollowDetail loadData Cleanup
- **Source:** audit-frontend.md
- **File:** webapp/src/pages/FollowDetail.jsx:57
- **Effort:** 20 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Wrap loadData in useCallback
  2. Add all dependencies
  3. Include loadData in useEffect deps
  4. Test re-renders
- **Verification:**
  - [ ] No stale closures
  - [ ] loadData stable reference
  - [ ] No memory leaks
  - [ ] Tests added

#### [P0-FE-2] WalletsModal Race Condition
- **Source:** audit-frontend.md
- **File:** webapp/src/components/Settings/WalletsModal.jsx:234
- **Effort:** 10 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Add synchronous lock (IIFE)
  2. Check lock before API call
  3. Test rapid double-click
- **Verification:**
  - [ ] Double-click safe
  - [ ] Only 1 API call made
  - [ ] Tests added

#### [P0-FE-3] WebSocket Timeout Accumulation
- **Source:** audit-frontend.md
- **File:** webapp/src/hooks/useWebSocket.js:39
- **Effort:** 15 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Clear existing timeout before creating new
  2. Test rapid disconnect/reconnect
  3. Verify no memory leaks
- **Verification:**
  - [ ] Only 1 timeout active
  - [ ] No timeout accumulation
  - [ ] Tests added

#### [P0-FE-4] CountdownTimer Cleanup
- **Source:** audit-frontend.md
- **File:** webapp/src/components/common/CountdownTimer.jsx:18
- **Effort:** 10 minutes
- **Priority:** 1
- **Fix Steps:**
  1. Add isMounted flag
  2. Check flag in calculateTimeLeft
  3. Test fast unmount
- **Verification:**
  - [ ] No state updates on unmounted
  - [ ] Interval cleared
  - [ ] Tests added

#### [P0-BOT-1] Missing scene.leave() in Errors
- **Source:** audit-bot.md
- **Files:** 4 scenes (15 error paths)
- **Effort:** 2-3 hours
- **Priority:** 1
- **Fix Steps:**
  1. Audit all 11 scenes
  2. Add scene.leave() in all catch blocks
  3. Test error scenarios
  4. Document pattern
- **Verification:**
  - [ ] All error paths call scene.leave()
  - [ ] User not stuck in scenes
  - [ ] /start works after errors
  - [ ] Tests added

#### [P0-BOT-2] Redis Session Storage
- **Source:** audit-bot.md
- **File:** bot/src/bot.js:64
- **Effort:** 4-6 hours
- **Priority:** 1
- **Dependencies:** Redis, telegraf-session-redis
- **Fix Steps:**
  1. Install telegraf-session-redis
  2. Setup Redis (Docker or service)
  3. Configure session middleware
  4. Test session persistence across restarts
  5. Update deployment docs
- **Verification:**
  - [ ] Sessions persist after restart
  - [ ] shopId preserved
  - [ ] JWT tokens preserved
  - [ ] Tests added

#### [P0-BOT-3] manageWallets setTimeout Race
- **Source:** audit-bot.md
- **File:** bot/src/scenes/manageWallets.js:269
- **Effort:** 1 hour
- **Priority:** 1
- **Fix Steps:**
  1. Clear timeout in scene.leave()
  2. Add mutex lock or debounce
  3. Test rapid scene switches
- **Verification:**
  - [ ] Timeout cleared on leave
  - [ ] No crashes
  - [ ] Tests added

#### [P0-BOT-4] Double answerCbQuery Audit
- **Source:** audit-bot.md
- **File:** Multiple handlers
- **Effort:** 3-4 hours
- **Priority:** 1
- **Fix Steps:**
  1. Audit all 100+ callback handlers
  2. Ensure single answerCbQuery per path
  3. Move to end of function
  4. Test callbacks
- **Verification:**
  - [ ] No double answerCbQuery
  - [ ] No spinners stuck
  - [ ] All callbacks tested

#### [P0-BOT-5] Global Error Handler Session Clear
- **Source:** audit-bot.md
- **File:** bot/src/bot.js:95
- **Effort:** 1-2 hours
- **Priority:** 1
- **Fix Steps:**
  1. Remove aggressive session clear
  2. Only leave scene on error
  3. Preserve wizard state
  4. Test error recovery
- **Verification:**
  - [ ] Session not cleared
  - [ ] Scene left gracefully
  - [ ] Wizard state preserved
  - [ ] Tests added

#### [P0-BOT-6] Workspace Authorization
- **Source:** audit-bot.md
- **File:** bot/src/handlers/workspace/index.js:35
- **Effort:** 2-3 hours
- **Priority:** 1
- **Fix Steps:**
  1. Add backend verification in handleWorkspaceShopSelect
  2. Call shopApi.getWorkerShops()
  3. Validate shop in returned list
  4. Test unauthorized access
- **Verification:**
  - [ ] Server-side verification added
  - [ ] Session manipulation prevented
  - [ ] Tests added

#### [P0-BOT-7] Payment Timeout Too Short
- **Source:** audit-bot.md
- **File:** bot/src/utils/api.js:7
- **Effort:** 2 hours
- **Priority:** 1
- **Fix Steps:**
  1. Create per-endpoint timeout config
  2. Set payment endpoints to 60s
  3. Keep others at 10s
  4. Test blockchain queries
- **Verification:**
  - [ ] Payment endpoints 60s timeout
  - [ ] Other endpoints 10s timeout
  - [ ] Tests added

#### [P0-BOT-8] QR Code Blocking
- **Source:** audit-bot.md
- **File:** bot/src/scenes/paySubscription.js:156
- **Effort:** 4-6 hours
- **Priority:** 1
- **Fix Steps:**
  1. Option A: Worker thread for QR generation
  2. Option B: Backend generates QR
  3. Test performance under load
  4. Choose best approach
- **Verification:**
  - [ ] QR generation non-blocking
  - [ ] Event loop not blocked
  - [ ] Tests added

**Day 4 Deliverables:**
- [ ] All 4 frontend P0 fixed
- [ ] All 8 bot P0 fixed
- [ ] Redis session storage working
- [ ] Scene error handling tested
- [ ] Merged to main

---

### Day 5: API + Performance + Tests P0 (10 issues - 25-30 hours)

#### [P0-API-1 to P0-API-8] API Security Issues
- **Source:** audit-api.md
- **Files:** Multiple routes
- **Effort:** 8-10 hours total
- **Priority:** 1
- **Fix Steps:**
  1. Add requireShopOwner to subscription endpoints (30 min)
  2. Create requireFollowOwner middleware (2 hours)
  3. Add requireShopOwner to migration endpoints (15 min)
  4. Add wallet validation middleware (5 min)
  5. Create bulk operation validators (1 hour)
  6. Add subscription rate limiter (15 min)
  7. Add shop creation rate limiter (10 min)
  8. Add AI rate limiter + validation (30 min)
- **Verification:**
  - [ ] All IDOR vulnerabilities fixed
  - [ ] All rate limiters working
  - [ ] All validation in place
  - [ ] Tests added

#### [P0-PERF-1] Product Sync Background Job
- **Source:** audit-performance.md
- **File:** backend/src/controllers/shopFollowController.js:287
- **Effort:** 4-6 hours
- **Priority:** 1
- **Dependencies:** Redis, Bull
- **Fix Steps:**
  1. Install Bull queue library
  2. Create syncQueue in jobs/syncQueue.js
  3. Update controller to queue job
  4. Return 202 status with "pending" message
  5. Add background worker
  6. Test sync completion
- **Verification:**
  - [ ] Sync queued, not blocking
  - [ ] Response instant (<200ms)
  - [ ] Background worker processes sync
  - [ ] Tests added

#### [P0-TEST-1] Payment Verification Tests
- **Source:** audit-tests.md
- **File:** backend/src/services/crypto.js
- **Effort:** 12-15 hours
- **Priority:** 1
- **Fix Steps:**
  1. Create crypto.test.js test file
  2. Mock blockchain APIs (blockchain.info, Etherscan, TronGrid)
  3. Write 8 BTC verification tests
  4. Write 8 ETH verification tests
  5. Write 4 USDT (ERC20) tests
  6. Write 4 USDT (TRC20) tests
  7. Write 4 LTC tests
  8. Test retry logic and timeouts
- **Verification:**
  - [ ] 28+ tests added
  - [ ] 80%+ coverage on crypto.js
  - [ ] All edge cases covered
  - [ ] CI passing

**Day 5 Deliverables:**
- [ ] All 8 API P0 fixed
- [ ] Product sync non-blocking
- [ ] Payment verification tests added
- [ ] Full P0 suite complete
- [ ] Merged to main

---

## PHASE 2: P1 HIGH PRIORITY (Week 2-4 - 3 weeks)

**Timeline:** Days 6-20 (3 weeks)  
**Total Issues:** 63  
**Total Effort:** 180-220 hours  
**Required:** 2 developers  

### Week 2 (Days 6-10): Backend + API P1

#### Backend P1 Issues (8 issues - 30-40 hours)

1. **[P1-SEC-003] Missing Authorization Check in Migration Endpoints**
   - File: backend/src/routes/shops.js:117-155
   - Effort: 15 minutes
   - Add requireShopOwner middleware

2. **[P1-SEC-004] Insufficient Rate Limiting on Payment Endpoints**
   - File: backend/src/routes/payments.js:17
   - Effort: 30 minutes
   - Create strictPaymentLimiter (3 req/minute)

3. **[P1-PERF-005] Unbounded Query Results Without Max Limit**
   - Files: Multiple list endpoints
   - Effort: 30 minutes
   - Enforce MAX_LIMIT=50 globally

4. **[P1-PERF-006] Missing Database Indexes**
   - File: backend/database/indexes.sql
   - Effort: 1 hour
   - Add 6 critical indexes

5. **[P1-SEC-005] JWT Secret Strength Not Enforced**
   - File: backend/src/config/env.js
   - Effort: 15 minutes
   - Validate JWT_SECRET minimum 32 chars

6. **[P1-SEC-006] Wallet Uniqueness Not Validated in Bulk Ops**
   - File: backend/src/controllers/walletController.js:70
   - Effort: 30 minutes
   - Use walletController everywhere

7. **[P1-ARCH-007] No API Versioning**
   - File: backend/src/server.js
   - Effort: 2 hours
   - Add /api/v1/ prefix

8. **[P1-SEC-007] Insufficient Input Validation for Markup**
   - File: backend/src/controllers/shopFollowController.js:214
   - Effort: 15 minutes
   - Limit markup to 0.1-200%

**Week 2 Deliverables:**
- [ ] All 8 backend P1 fixed
- [ ] Database indexes added
- [ ] API versioning implemented
- [ ] Tests added
- [ ] Merged to main

---

### Week 3 (Days 11-15): Frontend + Bot P1

#### Frontend P1 Issues (12 issues - 35-45 hours)

1. **[P1-PERF-005] No Virtualization for Large Lists**
   - File: webapp/src/components/Product/ProductGrid.jsx:50
   - Effort: 2 hours
   - Implement react-virtual

2. **[P1-CODE-006] Eslint-disable Without Justification**
   - Files: Multiple
   - Effort: 30 minutes per file
   - Use useCallback for stable refs

3. **[P1-PERF-007] ProductCard Too Many useMemo**
   - File: webapp/src/components/Product/ProductCard.jsx:15
   - Effort: 20 minutes
   - Move static calculations outside component

4. **[P1-CODE-008] Complex Dependencies in ProductsModal**
   - File: webapp/src/components/Settings/ProductsModal.jsx:95
   - Effort: 30 minutes
   - Extract loadData to useCallback

5. **[P1-PERF-009] SubscriptionModal Recalculates on Every Render**
   - File: webapp/src/pages/Settings.jsx:23
   - Effort: 15 minutes
   - Wrap getSettingsSections in useMemo

6. **[P1-RACE-010] PaymentMethodModal Retry Logic**
   - File: webapp/src/components/Payment/PaymentMethodModal.jsx:140
   - Effort: 30 minutes
   - Add AbortController

7. **[P1-MEMORY-011] FollowDetail Async Without Cleanup**
   - File: webapp/src/pages/FollowDetail.jsx:57
   - Effort: 25 minutes
   - Add isMounted flag

8. **[P1-PERF-012] PaymentHashModal Input Validation**
   - File: webapp/src/components/Payment/PaymentHashModal.jsx:40
   - Effort: 15 minutes
   - Memoize validateTxHash

9-12. **Additional frontend P1 issues** (see audit-frontend.md)

**Week 3 Deliverables:**
- [ ] All 12 frontend P1 fixed
- [ ] Virtualization implemented
- [ ] Memory leaks resolved
- [ ] Tests added
- [ ] Merged to main

---

#### Bot P1 Issues (15 issues - 40-50 hours)

1. **[P1-BOT-001] Missing Token Validation in Handlers**
   - Files: 15+ handlers
   - Effort: 3-4 hours
   - Add validateTokenMiddleware

2. **[P1-BOT-002] No Retry Logic for Network Errors**
   - File: bot/src/utils/api.js
   - Effort: 2-3 hours
   - Add axios-retry

3. **[P1-BOT-003] Follow Markup Edit Race Condition**
   - File: bot/src/handlers/seller/follows.js:229
   - Effort: 3-4 hours
   - Refactor to scene-based state

4. **[P1-BOT-004] Circular Dependency Not Checked**
   - File: bot/src/scenes/createFollow.js:67
   - Effort: 2-3 hours
   - Add backend validation endpoint

5. **[P1-BOT-005] Worker Username Validation Too Weak**
   - File: bot/src/scenes/manageWorkers.js:53
   - Effort: 1 hour
   - Stricter regex validation

6. **[P1-BOT-006] Order History Pagination Memory Leak**
   - File: bot/src/handlers/seller/orders.js:297
   - Effort: 2 hours
   - Use debounce or in-memory cache

7. **[P1-BOT-007] Missing User Message Cleanup in Scenes**
   - Files: 2 scenes
   - Effort: 2-3 hours
   - Add userMessageIds tracking

8. **[P1-BOT-008] Subscription Payment Polling Not Implemented**
   - File: bot/src/scenes/paySubscription.js:202
   - Effort: 3-4 hours
   - Add auto-polling every 30s

9-15. **Additional bot P1 issues** (see audit-bot.md)

**Week 3 Deliverables:**
- [ ] All 15 bot P1 fixed
- [ ] Token validation middleware
- [ ] Retry logic added
- [ ] Tests added
- [ ] Merged to main

---

### Week 4 (Days 16-20): Database + Performance P1

#### Database P1 Issues (8 issues - 25-30 hours)

1. **[P1-INDEX-001] Missing idx_invoices_subscription_id**
   - File: backend/database/schema.sql
   - Effort: 5 minutes
   - CREATE INDEX idx_invoices_subscription_id

2. **[P1-QUERY-002] N+1 Query in orderQueries.findByOwnerId**
   - File: backend/src/models/db.js:548
   - Effort: 30 minutes
   - Add batch query method

3. **[P1-PERF-003] Missing Index on period_end**
   - File: backend/database/schema.sql:463
   - Effort: 5 minutes (verify existing)
   - Ensure query planner uses it

4. **[P1-DATA-004] Missing CHECK on products.price**
   - File: backend/database/schema.sql:86
   - Effort: 10 minutes
   - Add upper bound (< 1 billion)

5. **[P1-INDEX-005] Missing Composite on (buyer_id, created_at)**
   - File: backend/database/schema.sql
   - Effort: 5 minutes
   - CREATE INDEX idx_orders_buyer_created

6. **[P1-SEC-006] SQL Injection Risk in productSyncService**
   - File: backend/src/services/productSyncService.js:275
   - Effort: 5 minutes
   - Use parameterized interval

7. **[P1-PERF-007] Slow Query in shopFollowQueries.findById**
   - File: backend/src/models/shopFollowQueries.js:26
   - Effort: 20 minutes
   - Use JOIN with GROUP BY

8. **[P1-INDEX-008] Missing Index on (user_id, promo_code)**
   - File: backend/database/schema.sql:405
   - Effort: 5 minutes
   - CREATE INDEX or verify UNIQUE creates one

**Week 4 Deliverables:**
- [ ] All 8 database P1 fixed
- [ ] All critical indexes added
- [ ] Query plans verified
- [ ] Performance tests run
- [ ] Merged to main

---

#### Performance P1 Issues (5 issues - 20-25 hours)

1. **[P1-PERF-001] N+1 in Payment Confirmation**
   - File: backend/src/services/pollingService.js:305
   - Effort: 2 hours
   - Single JOIN query

2. **[P1-PERF-002] Frontend Bundle Optimization**
   - Files: Multiple
   - Effort: 4-6 hours
   - Tree-shake Framer Motion, lazy load QRCode

3. **[P1-PERF-003] Polling Should Use Webhooks**
   - File: backend/src/services/pollingService.js
   - Effort: 6-8 hours
   - Implement Etherscan/TronGrid webhooks

4. **[P1-PERF-004] Missing Index on (status, created_at)**
   - File: backend/database/schema.sql
   - Effort: 1 minute
   - CREATE INDEX idx_orders_status_created

5. **[P1-PERF-005] Additional Performance Optimizations**
   - Various files
   - Effort: Variable
   - See audit-performance.md

**Week 4 Deliverables:**
- [ ] All 5 performance P1 fixed
- [ ] Webhooks implemented
- [ ] Bundle size reduced
- [ ] Performance benchmarks improved
- [ ] Merged to main

---

## PHASE 3: P2 MEDIUM PRIORITY (Week 5-9 - 5 weeks)

**Timeline:** Days 21-45 (5 weeks)  
**Total Issues:** 70  
**Total Effort:** 140-180 hours  

### Week 5-6: Backend + API P2

**Backend P2 (12 issues):**
- Error response format standardization
- Magic numbers extraction
- Duplicate wallet update logic
- Order analytics query optimization
- Console.log replacement
- Input validation improvements
- And 6 more (see audit-backend.md)

**API P2 (14 issues):**
- API versioning
- Response format consistency
- Pagination validation
- Security audit logs
- Search query validation
- And 9 more (see audit-api.md)

**Week 5-6 Deliverables:**
- [ ] All 26 backend/API P2 fixed
- [ ] Code quality improved
- [ ] Tests added
- [ ] Merged to main

---

### Week 7: Frontend + Bot P2

**Frontend P2 (18 issues):**
- Missing PropTypes validation
- CartSheet virtualization
- useToast stable reference
- useBackButton optimization
- Error handling consistency
- And 13 more (see audit-frontend.md)

**Bot P2 (18 issues):**
- Debounce middleware tuning
- Logger debug level configuration
- User rate limiting
- Health check endpoint
- Order export/search/statistics
- And 13 more (see audit-bot.md)

**Week 7 Deliverables:**
- [ ] All 36 frontend/bot P2 fixed
- [ ] UX improvements
- [ ] Tests added
- [ ] Merged to main

---

### Week 8: Database + Performance P2

**Database P2 (12 issues):**
- Redundant index removal
- Composite index optimization
- Currency ENUM type
- Discount expiration cleanup
- And 8 more (see audit-database.md)

**Performance P2 (7 issues):**
- WebSocket room-based broadcasting
- Database pool size tuning
- Slow query logging
- Brotli compression
- And 3 more (see audit-performance.md)

**Week 8 Deliverables:**
- [ ] All 19 database/performance P2 fixed
- [ ] Query performance improved
- [ ] Compression enabled
- [ ] Merged to main

---

### Week 9: Code Quality + Tests P2

**Code Quality P2 (14 issues):**
- Extract crypto service utilities
- Refactor large files (productAI.js: 2881 LOC)
- Centralize magic numbers
- Split monolithic store
- And 10 more (see audit-code-quality.md)

**Tests P2 (10 issues):**
- Frontend test setup
- Payment flow tests
- Cart tests
- Settings tests
- And 6 more (see audit-tests.md)

**Week 9 Deliverables:**
- [ ] All 24 code quality/tests P2 fixed
- [ ] Large files refactored
- [ ] Frontend tests added
- [ ] Merged to main

---

## PHASE 4: P3 LOW PRIORITY (Backlog - Ongoing)

**Timeline:** Month 2+ (ongoing)  
**Total Issues:** 18  
**Total Effort:** 40-60 hours  

### Technical Debt Items

**Backend P3 (5 issues):**
- Unused imports cleanup
- Missing health check for external services
- No request ID for tracing
- Database migration version tracking
- And 1 more

**Frontend P3 (13 issues):**
- Inconsistent error messages
- Magic numbers in code
- Unused imports
- Code formatting inconsistency
- Missing JSDoc comments
- And 8 more

**Database P3 (5 issues):**
- TODO comments → GitHub issues
- Unused imports
- Missing health checks
- Request tracking
- Migration tracking

**Performance P3 (4 issues):**
- Order cleanup frequency
- Image optimization
- CDN for static assets
- Read replicas

**Code Quality P3 (5 issues):**
- JSDoc documentation
- File structure improvements
- Import order consistency
- And 2 more

**Tests P3 (4 issues):**
- Rate limiter tests
- Contract tests
- Performance tests
- Visual regression tests

---

## Testing Phase Plan

**After each phase, run:**

### Unit Tests
```bash
# Backend
cd backend && npm run test:unit
# Target: 80%+ coverage

# Bot
cd bot && npm run test:unit
# Target: 70%+ coverage

# Frontend
cd webapp && npm run test
# Target: 60%+ coverage
```

### Integration Tests
```bash
# Backend
npm run test:integration
# Target: 70%+ critical paths

# Bot
npm run test:integration
# Target: 60%+ flows
```

### E2E Tests
```bash
npm run test:e2e
# Target: payment flow, auth, orders
```

### Security Scan
```bash
npm audit
snyk test
```

### Performance Test
```bash
npm run loadtest
# Target: p95 <500ms
```

---

## Subagent Assignment Matrix

| Subagent | Phase 1 (P0) | Phase 2 (P1) | Phase 3 (P2) | Phase 4 (P3) |
|----------|-------------|-------------|-------------|-------------|
| backend-architect | 8 tasks | 15 tasks | 18 tasks | 8 tasks |
| frontend-developer | 4 tasks | 12 tasks | 18 tasks | 13 tasks |
| telegram-bot-expert | 8 tasks | 15 tasks | 18 tasks | 6 tasks |
| crypto-integration-specialist | 5 tasks | 7 tasks | 8 tasks | 4 tasks |
| database-designer | 3 tasks | 8 tasks | 12 tasks | 5 tasks |
| debug-master | 3 tasks | 6 tasks | 8 tasks | 3 tasks |

---

## Risk & Dependency Matrix

### Critical Path (Blocking):

1. **[P0-PAY-2] Invoice Generation** blocks all payment testing
2. **[P0-DB-1] Wallet Uniqueness** blocks wallet updates
3. **[P0-BOT-2] Redis Sessions** blocks bot restart testing
4. **[P0-SEC-6] CSRF Protection** blocks frontend state changes
5. **[P0-PERF-1] Product Sync** blocks follow creation

### Parallelizable Work:

- Security fixes (independent)
- Frontend fixes (independent)
- Bot fixes (independent)
- Database indexes (can run concurrently)

---

## Success Metrics

### Phase 1 (P0) Success:
- [ ] Zero P0 issues remaining
- [ ] Production blocker checklist complete
- [ ] All regression tests passing
- [ ] Security scan clean
- [ ] Code review approved
- [ ] Payment flow working end-to-end

### Phase 2 (P1) Success:
- [ ] Zero P1 issues remaining
- [ ] 80%+ test coverage on critical paths
- [ ] Performance benchmarks met (p95 <500ms)
- [ ] No new P0/P1 issues introduced
- [ ] All webhooks functional

### Phase 3 (P2) Success:
- [ ] All P2 resolved
- [ ] Code quality metrics improved
- [ ] Documentation updated
- [ ] Frontend tests added (60%+ coverage)

### Phase 4 (P3) Success:
- [ ] Technical debt reduced by 80%
- [ ] All TODOs converted to issues
- [ ] Clean codebase audit

---

## Timeline Summary

```
Week 1:     P0 Fixes (5 days, 85-105 hours)
            ├─ Security (Day 1)
            ├─ Payment (Day 2)
            ├─ Backend/DB (Day 3)
            ├─ Frontend/Bot (Day 4)
            └─ API/Perf/Tests (Day 5)

Week 2-4:   P1 Fixes (15 days, 180-220 hours)
            ├─ Backend/API (Week 2)
            ├─ Frontend/Bot (Week 3)
            └─ Database/Performance (Week 4)

Week 5-9:   P2 Fixes (25 days, 140-180 hours)
            ├─ Backend/API (Week 5-6)
            ├─ Frontend/Bot (Week 7)
            ├─ Database/Performance (Week 8)
            └─ Code Quality/Tests (Week 9)

Month 2+:   P3 Backlog (~40-60 hours)
            └─ Technical debt cleanup

TOTAL:      ~13-16 weeks, 445-565 hours
```

**With 2 developers:** 13-16 weeks  
**With 1 developer:** 26-32 weeks  

---

**Last Updated:** 2025-11-05  
**Status:** Ready for execution  
**Next Steps:** Review with team, prioritize, start Phase 1
