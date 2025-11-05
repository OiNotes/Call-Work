# 🚨 PRODUCTION BLOCKERS - CRITICAL ISSUES (P0)

> **Статус:** ❌ NOT PRODUCTION READY  
> **Найдено критичных проблем:** 31  
> **Estimated fix time:** 85-105 hours  
> **Must fix before launch:** ALL P0 issues

---

## Executive Summary

| Category | P0 Count | Risk Level | Estimated Fix Time |
|----------|----------|------------|-------------------|
| Security | 8 | 🔴 CRITICAL | 18-22 hours |
| Payment | 5 | 🔴 CRITICAL | 12-15 hours |
| Backend | 3 | 🔴 CRITICAL | 6-8 hours |
| Frontend | 4 | 🔴 CRITICAL | 8-10 hours |
| Bot | 8 | 🔴 CRITICAL | 20-25 hours |
| Database | 3 | 🔴 CRITICAL | 3-4 hours |
| API | 8 | 🔴 CRITICAL | 12-15 hours |
| Performance | 1 | 🔴 CRITICAL | 4-6 hours |
| Tests | 1 | 🔴 CRITICAL | 15-20 hours |
| **TOTAL** | **31** | **🔴 CRITICAL** | **85-105 hours** |

---

## 🔴 SECURITY (8 issues)

### P0-SEC-1: Missing Authorization on Shop Details Endpoint

**Source:** audit-api.md  
**File:** `backend/src/routes/shops.js:78`  
**Impact:** Complete shop data exposure including wallet addresses (PII)  
**Risk:** Horizontal privilege escalation - any user can access any shop's data  
**Attack Scenario:**
```bash
# Attacker gets their own token, then accesses OTHER user's shop
curl -H "Authorization: Bearer <attacker_token>" \
  GET /api/shops/999

# Returns FULL shop details including wallets!
```

**Effort:** 30 minutes  
**Priority:** 1 (highest)  
**Blocker:** YES

**Fix:**
```javascript
router.get('/:id',
  verifyToken,           // Add authentication
  requireShopOwner,      // Add authorization check
  shopValidation.getById,
  shopController.getById
);
```

---

### P0-SEC-2: Unauthorized Wallet Access for Payments

**Source:** audit-api.md  
**File:** `backend/src/routes/shops.js:62-68`  
**Impact:** Payment address exposure, phishing risk  
**Risk:** Users can access ANY shop's wallet addresses  
**Attack Scenario:**
```bash
# Any authenticated user can view ANY shop's wallets
curl -H "Authorization: Bearer TOKEN" \
  GET /api/shops/123/wallets

# Returns all payment addresses → phishing attacks possible
```

**Effort:** 45 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
export const getWallets = async (req, res) => {
  const { id: shopId } = req.params;
  const userId = req.user.id;
  
  const shop = await shopQueries.findById(shopId);
  const isOwner = shop.owner_id === userId;
  
  // Allow if user has pending orders OR is shop owner
  const hasPendingOrder = await orderQueries.userHasPendingOrderForShop(userId, shopId);
  
  if (!isOwner && !hasPendingOrder) {
    return res.status(403).json({
      success: false,
      error: 'Wallet access denied. Create an order first.'
    });
  }
  
  return res.json({ success: true, data: { wallet_btc: shop.wallet_btc, ... } });
};
```

---

### P0-SEC-3: Test Authentication Bypass in Production

**Source:** audit-security.md  
**File:** `backend/src/middleware/auth.js:29-38`  
**Impact:** Complete authentication bypass if `NODE_ENV=test` accidentally set  
**Risk:** Account takeover without credentials  

**Current Code:**
```javascript
// ❌ CRITICAL BACKDOOR
if (config.nodeEnv === 'test' && token.startsWith('test_token_user_')) {
  const userId = Number.parseInt(token.replace('test_token_user_', ''), 10);
  req.user = { id: userId };
  return next();
}
```

**Attack:** If production deployed with wrong NODE_ENV:
```bash
curl -H "Authorization: Bearer test_token_user_1" \
  GET /api/shops/my

# Authenticated as user ID 1 WITHOUT password!
```

**Effort:** 15 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
// ❌ DELETE TEST BYPASS ENTIRELY
// Production apps should NEVER have test shortcuts in auth middleware

// ✅ Always verify JWT
const decoded = jwt.verify(token, config.jwt.secret);
req.user = { id: decoded.id, ... };
next();
```

---

### P0-SEC-4: Missing Rate Limiting on Resource Creation

**Source:** audit-security.md  
**File:** `backend/src/routes/shops.js:14`, `backend/src/routes/products.js:14`  
**Impact:** Resource exhaustion (DoS), database bloat  
**Risk:** Attacker creates 1000 shops/products within rate limit  

**Current Rate Limits:**
```javascript
API: {
  MAX_REQUESTS: 1000  // TOO HIGH! Allows mass creation
}
```

**Attack Scenario:**
```bash
# Attacker registers 10 bot accounts
# Each creates 100 shops in 15 minutes
# Total: 1000 shops → database exhaustion
```

**Effort:** 30 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
export const shopCreationLimiter = createRateLimiter(
  60 * 60 * 1000,  // 1 hour
  5,               // Max 5 shops per hour per IP
  'Too many shop creation attempts'
);

router.post('/', verifyToken, shopCreationLimiter, shopController.create);
```

---

### P0-SEC-5: SSRF via Unvalidated Logo URL

**Source:** audit-security.md  
**File:** `backend/src/middleware/validation.js:46-48`  
**Impact:** Internal network reconnaissance, cloud metadata access  
**Risk:** Attacker can scan internal services via logo URL  

**Attack Scenario:**
```bash
# Attacker creates shop with internal URL as logo
curl POST /api/shops \
  -d '{"logo": "http://169.254.169.254/latest/meta-data/"}'

# System validates URL format: ✅ Valid
# Frontend/bot attempts to fetch logo → AWS metadata leaked!
```

**Effort:** 1 hour  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
export function isInternalUrl(urlString) {
  const url = new URL(urlString);
  
  // Block internal hostnames
  const blockedHosts = ['localhost', '127.0.0.1', '169.254.169.254', ...];
  if (blockedHosts.some(h => url.hostname.includes(h))) return true;
  
  // Block private IP ranges (RFC 1918)
  // ... IP validation logic
  
  return false;
}

body('logo').custom((value) => {
  if (value && isInternalUrl(value)) {
    throw new Error('Logo URL cannot point to internal network');
  }
  return true;
});
```

---

### P0-SEC-6: Missing CSRF Protection

**Source:** audit-security.md  
**Impact:** Unauthorized actions on behalf of victim  
**Risk:** If tokens stored in cookies or XSS vulnerability exists  

**Attack Scenario:**
```html
<!-- Attacker's site: evil.com -->
<script>
fetch('https://statusstock.com/api/orders', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + stolenToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    productId: 123,
    quantity: 1000,
    deliveryAddress: 'Attacker address'
  })
});
</script>
```

**Effort:** 2 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
import csrf from 'csurf';

export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Apply to state-changing routes
app.use('/api/orders', csrfProtection);
app.use('/api/products', csrfProtection);
app.use('/api/shops', csrfProtection);
```

---

### P0-SEC-7: Sensitive Data Exposure in Error Responses

**Source:** audit-security.md  
**File:** `backend/src/middleware/errorHandler.js:24-33`  
**Impact:** Information disclosure aids further attacks  
**Risk:** Database schema, file paths, internal structure leaked  

**Current Code:**
```javascript
if (err.code === '23505') {
  return new ApiError(409, 'Resource already exists', {
    constraint: err.constraint  // ← Leaks table/column names!
  });
}
```

**Effort:** 45 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
export const errorHandler = (err, req, res, _next) => {
  // Log FULL error internally
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    userId: req.user?.id
  });

  // MINIMAL error response (same for all environments)
  const errorResponse = {
    success: false,
    error: err.isOperational ? err.message : 'Internal server error'
    // ❌ NEVER include: stack, details, constraint names
  };

  res.status(statusCode).json(errorResponse);
};
```

---

### P0-SEC-8: Hardcoded Internal API Secret

**Source:** audit-backend.md  
**File:** `backend/src/routes/internal.js:13`  
**Impact:** Unauthorized access to WebSocket broadcast system  
**Risk:** Attacker can broadcast fake updates to all clients  

**Current Code:**
```javascript
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'change-me-in-production';
// Fallback allows access if env var not set!
```

**Effort:** 5 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

if (!INTERNAL_SECRET) {
  throw new Error('INTERNAL_SECRET environment variable is required');
}
```

---

## 🔴 PAYMENT (5 issues)

### P0-PAY-1: tx_hash Can Be Reused for Different Orders

**Source:** audit-payment.md  
**File:** `backend/src/controllers/paymentController.js:156`  
**Impact:** User pays once, claims multiple orders → FINANCIAL LOSS  
**Risk:** Double-spending attack  

**Attack Scenario:**
```bash
# Attacker creates 5 orders (IDs: 100, 101, 102, 103, 104)
# Pays ONLY order 100 with tx_hash 0xABCD...
# Submits SAME tx_hash for orders 101-104
# Current code finds existingTx for order 100, but request is for order 101!
# ❌ No validation that tx_hash belongs to current order
```

**Effort:** 15 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
const existingTx = await paymentQueries.findByTxHash(txHash);

if (existingTx) {
  // ✅ Check if tx_hash is for a DIFFERENT order
  if (existingTx.order_id !== orderId) {
    return res.status(400).json({
      success: false,
      error: 'Transaction already used for another order',
      usedForOrder: existingTx.order_id
    });
  }
  // ... rest of logic
}
```

---

### P0-PAY-2: Invoice Generation Code Missing

**Source:** audit-payment.md  
**File:** `backend/src/controllers/orderController.js:generateInvoice`  
**Impact:** No unique HD wallet addresses → payments to wrong addresses  
**Risk:** Financial loss, payment attribution errors  

**Current Status:**
```javascript
// Uses SELLER'S wallet address (shop.wallet_btc)
// Does NOT generate unique HD wallet address
// Does NOT use invoiceQueries.create()
// Does NOT implement BIP44 derivation
```

**Effort:** 4-6 hours  
**Priority:** 1  
**Blocker:** YES

**Fix Required:**
1. Implement HD wallet address generation
2. Use `cryptoPriceService.convertAndRound()` for real-time rates
3. Register webhooks for payment monitoring
4. Store invoice in database with expiry

---

### P0-PAY-3: No Webhook Signature Validation

**Source:** audit-payment.md  
**File:** `backend/src/services/blockCypherService.js`  
**Impact:** Anyone can send fake webhook → Mark unpaid orders as paid  
**Risk:** Free products for attackers  

**Attack Scenario:**
```bash
# Attacker creates order for $100
# Does NOT pay
# Sends fake webhook with made-up tx_hash
curl POST /webhooks/blockcypher \
  -d '{"hash": "fake_tx_hash_123", "confirmations": 99}'

# Backend marks order as paid WITHOUT blockchain verification!
```

**Effort:** 2 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
router.post('/blockcypher', async (req, res) => {
  // ✅ ALWAYS verify against blockchain (DON'T trust webhook)
  const verification = await blockCypherService.getTransaction(
    payload.chain,
    payload.hash
  );
  
  if (!verification || verification.doubleSpend) {
    logger.warn('[Webhook] Fake or double-spend detected', { payload });
    return res.status(400).json({ error: 'Invalid transaction' });
  }
  
  // ✅ Process payment
  await processPaymentConfirmation(verification);
  res.status(200).json({ message: 'Processed' });
});
```

---

### P0-PAY-4: Expired Invoices Never Cleaned Up

**Source:** audit-payment.md  
**File:** `backend/database/schema.sql:724`  
**Impact:** Database grows indefinitely, invoice addresses reused  
**Risk:** Address conflicts, gaps in derivation path  

**Current Status:**
```sql
-- Function exists but NEVER called:
CREATE OR REPLACE FUNCTION cleanup_old_webhooks() ...
-- ❌ Only cleans webhooks, NOT invoices!
```

**Effort:** 1 hour  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
// backend/src/jobs/invoiceCleanup.js
import cron from 'node-cron';

// Run every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  const expired = await invoiceQueries.findExpired();
  
  for (const invoice of expired) {
    await invoiceQueries.updateStatus(invoice.id, 'expired');
    
    // Unregister webhook
    if (invoice.tatum_subscription_id) {
      await blockCypherService.unregisterWebhook(invoice.tatum_subscription_id);
    }
  }
});
```

---

### P0-PAY-5: Amount Rounding Errors with parseFloat

**Source:** audit-payment.md  
**File:** `backend/src/services/cryptoPriceService.js:53`  
**Impact:** User pays 0.99999998 BTC instead of 1.00000000 BTC → Order rejected  
**Risk:** Financial loss for high-value transactions  

**Current Code:**
```javascript
export function roundCryptoAmount(amount, chain) {
  const decimals = CRYPTO_DECIMALS[chain] || 8;
  return parseFloat(amount.toFixed(decimals));  // ❌ Precision loss!
}
```

**Effort:** 2 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
import Decimal from 'decimal.js';

export function roundCryptoAmount(amount, chain) {
  const decimals = CRYPTO_DECIMALS[chain] || 8;
  
  // ✅ Use Decimal for precision
  return new Decimal(amount)
    .toDecimalPlaces(decimals, Decimal.ROUND_DOWN)
    .toNumber();
}
```

**Dependencies:** `npm install decimal.js`

---

## 🔴 BACKEND (3 issues)

### P0-BACK-1: Hardcoded Promo Code in Controller

**Source:** audit-backend.md  
**File:** `backend/src/controllers/shopController.js:11`  
**Impact:** Revenue loss, unlimited free PRO accounts  
**Risk:** Promo code visible in source control  

**Current Code:**
```javascript
const PROMO_CODE = 'comi9999';  // ❌ Hardcoded and in git!
```

**Effort:** 30 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
// Move to environment variable
const PROMO_CODE = process.env.PROMO_CODE;

if (!PROMO_CODE) {
  throw new Error('PROMO_CODE environment variable is required');
}

// Better: Use database-driven promo codes
CREATE TABLE promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  tier VARCHAR(10) NOT NULL CHECK (tier IN ('basic', 'pro')),
  max_uses INT DEFAULT NULL,
  used_count INT DEFAULT 0,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

---

### P0-BACK-2: Connection Leak Risk in Transaction Flows

**Source:** audit-backend.md  
**Files:** Multiple controllers (orderController:42, 269; productController:589; subscriptionController)  
**Impact:** Connection pool exhaustion → application unresponsive  
**Risk:** Failed transactions don't release client  

**Current Code:**
```javascript
const client = await getClient();
try {
  await client.query('BEGIN');
  // ... operations ...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');  // ❌ If this throws, client.release() never executes!
  throw error;
} finally {
  client.release();
}
```

**Effort:** 1 hour (fix all occurrences)  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
const client = await getClient();
try {
  await client.query('BEGIN');
  // ... operations ...
  await client.query('COMMIT');
} catch (error) {
  // CRITICAL: Catch rollback errors to prevent connection leak
  try {
    await client.query('ROLLBACK');
  } catch (rollbackError) {
    logger.error('Rollback error', { error: rollbackError.message });
  }
  throw error;
} finally {
  // ALWAYS executes - guaranteed cleanup
  client.release();
}
```

---

### P0-BACK-3: Unbounded Query Results Without Max Limit

**Source:** audit-backend.md  
**File:** `backend/src/controllers/orderController.js:203`  
**Impact:** DoS risk, memory exhaustion  
**Risk:** User requests limit=100 repeatedly  

**Current Code:**
```javascript
const limit = parseInt(req.query.limit) || 50;  // ❌ No max cap!
```

**Attack Scenario:**
```bash
curl GET '/api/orders?limit=999999'
# Loads 999,999 orders → OOM crash
```

**Effort:** 10 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
const MAX_LIMIT = 100;  // Hard cap
const limit = Math.min(parseInt(req.query.limit) || 50, MAX_LIMIT);
```

---

## 🔴 FRONTEND (4 issues)

### P0-FE-1: Memory Leak - Missing cleanup in FollowDetail loadData

**Source:** audit-frontend.md  
**File:** `webapp/src/pages/FollowDetail.jsx:57-80`  
**Impact:** Stale closures, memory leaks, hard-to-debug issues  
**Risk:** Function called inside useEffect but not in dependencies  

**Current Code:**
```javascript
useEffect(() => {
  const loadData = async () => { /* ... */ };
  loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [followDetailId]); // ❌ loadData not in dependencies
```

**Effort:** 20 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
const loadData = useCallback(async () => {
  // ... implementation
}, [followDetailId, followsApi, setCurrentFollow, setFollowProducts]);

useEffect(() => {
  if (!followDetailId) return;
  loadData();
}, [followDetailId, loadData]); // ✅ Include loadData
```

---

### P0-FE-2: Race Condition - Double-click in WalletsModal

**Source:** audit-frontend.md  
**File:** `webapp/src/components/Settings/WalletsModal.jsx:234-266`  
**Impact:** Duplicate API calls, database inconsistency  
**Risk:** setSaving(true) takes effect after second click  

**Current Code:**
```javascript
const handleSaveWallets = useCallback(async () => {
  if (saving) return;  // ❌ Race condition window here
  setSaving(true);
  // ... API call
}, [/* ... */]);
```

**Effort:** 10 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
const handleSaveWallets = (() => {
  let saveInProgress = false; // Synchronous lock
  
  return async () => {
    if (saveInProgress || saving) return;
    saveInProgress = true;
    setSaving(true);
    
    try {
      // ... API call
    } finally {
      saveInProgress = false;
      setSaving(false);
    }
  };
})();
```

---

### P0-FE-3: Memory Leak - WebSocket reconnection timeout accumulation

**Source:** audit-frontend.md  
**File:** `webapp/src/hooks/useWebSocket.js:39-100`  
**Impact:** Multiple duplicate WS connections, memory leaks  
**Risk:** Rapid disconnects accumulate uncancelled timeouts  

**Current Code:**
```javascript
ws.onclose = (event) => {
  reconnectTimeoutRef.current = setTimeout(() => {
    connect(); // ❌ May create new timeout before old one cleared
  }, delay);
};
```

**Effort:** 15 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
ws.onclose = (event) => {
  // Clear existing timeout first
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
  }
  
  reconnectTimeoutRef.current = setTimeout(() => {
    connect();
  }, delay);
};
```

---

### P0-FE-4: Memory Leak - CountdownTimer interval not cleared on fast unmount

**Source:** audit-frontend.md  
**File:** `webapp/src/components/common/CountdownTimer.jsx:18-58`  
**Impact:** State updates on unmounted component, memory leak  
**Risk:** Component unmounts during calculateTimeLeft() execution  

**Current Code:**
```javascript
useEffect(() => {
  calculateTimeLeft(); // ❌ Synchronous call before interval

  const interval = setInterval(calculateTimeLeft, 1000);
  return () => clearInterval(interval);
}, [expiresAt]);
```

**Effort:** 10 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
useEffect(() => {
  let isMounted = true;
  
  const calculateTimeLeft = () => {
    if (!isMounted) return; // Safety check
    // ... calculations
  };

  calculateTimeLeft();
  const interval = setInterval(calculateTimeLeft, 1000);

  return () => {
    isMounted = false;
    clearInterval(interval);
  };
}, [expiresAt]);
```

---

## 🔴 BOT (8 issues)

### P0-BOT-1: Scene State Corruption - Missing scene.leave() in Error Handlers

**Source:** audit-bot.md  
**Files:** createShop.js (4 paths), paySubscription.js (6 paths), upgradeShop.js (3 paths), chooseTier.js (2 paths)  
**Impact:** User stuck in scene after error, must restart bot  
**Risk:** Affects ~15-20% of shop creation attempts  

**Current Code:**
```javascript
} catch (error) {
  logger.error('Error creating shop:', error);
  await cleanReply(ctx, userMessage, successButtons);
  // ❌ MISSING: return await ctx.scene.leave();
}
```

**Scenario:**
1. User enters chooseTier scene
2. API call fails (network timeout)
3. Error shown, but scene NOT left
4. User tries /start → ignored (still in scene)
5. Must restart entire bot

**Effort:** 2-3 hours (review all 11 scenes)  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
} catch (error) {
  logger.error('Error creating shop:', error);
  await cleanReply(ctx, userMessage, successButtons);
  return await ctx.scene.leave(); // ✅ FIX
}
```

---

### P0-BOT-2: Session Data Loss on Bot Restart (In-Memory Storage)

**Source:** audit-bot.md  
**File:** `bot/src/bot.js:64`  
**Impact:** ALL user sessions lost on restart  
**Risk:** Users forced to re-authenticate  

**Current Code:**
```javascript
bot.use(session()); // ❌ No persistence layer
```

**Scenario:**
1. User creates shop, gets shopId=123 in session
2. Bot restarts (deployment/crash)
3. User presses "Active Orders"
4. shopId=null → "Shop required" error

**Effort:** 4-6 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
import RedisSession from 'telegraf-session-redis';

const session = new RedisSession({
  store: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

bot.use(session.middleware());
```

---

### P0-BOT-3: Race Condition - manageWallets setTimeout Cleanup

**Source:** audit-bot.md  
**File:** `bot/src/scenes/manageWallets.js:269-279`  
**Impact:** Timer fires AFTER user left scene → crash  
**Risk:** ctx.wizard undefined when timeout executes  

**Current Code:**
```javascript
ctx.session.manageWalletsRefreshTimer = setTimeout(async () => {
  try {
    ctx.wizard.selectStep(0);  // ❌ wizard undefined if scene left!
    await showWallets(ctx);
  } catch (refreshError) {
    logger.error('Error refreshing wallets view:', refreshError);
  }
}, 1000);
```

**Effort:** 1 hour  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
manageWalletsScene.leave(async (ctx) => {
  if (ctx.session.manageWalletsRefreshTimer) {
    clearTimeout(ctx.session.manageWalletsRefreshTimer);
    delete ctx.session.manageWalletsRefreshTimer; // ✅ FIX
  }
  ctx.wizard.state = {};
});
```

---

### P0-BOT-4: Unhandled Double answerCbQuery() Calls

**Source:** audit-bot.md  
**File:** `bot/src/handlers/buyer/index.js:156-157`  
**Impact:** Infinite spinner on button, no error shown to user  
**Risk:** Second answerCbQuery() silently ignored by Telegram  

**Current Code:**
```javascript
const handleUnsubscribe = async (ctx) => {
  await ctx.answerCbQuery(generalMessages.done); // ✅ First call
  
  // ... later in catch block
  await ctx.answerCbQuery(buyerMessages.unsubscribeError, { show_alert: true }); // ❌ Second call
};
```

**Effort:** 3-4 hours (audit all 100+ callback handlers)  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
const handleUnsubscribe = async (ctx) => {
  try {
    await subscriptionApi.unsubscribe(shopId, ctx.session.token);
    await ctx.answerCbQuery(generalMessages.done); // ✅ Once in success
  } catch (error) {
    await ctx.answerCbQuery(buyerMessages.unsubscribeError, { show_alert: true }); // ✅ Once in error
  }
};
```

---

### P0-BOT-5: Global Error Handler Clears Critical Session Data

**Source:** audit-bot.md  
**File:** `bot/src/bot.js:95-113`  
**Impact:** User loses progress in multi-step flows  
**Risk:** Wizard state cleared on ANY error  

**Current Code:**
```javascript
bot.catch((err, ctx) => {
  // Clear session state if corrupted
  if (ctx.session && typeof ctx.session === 'object') {
    const { token, user, shopId, shopName, role } = ctx.session;
    ctx.session = { token, user, shopId, shopName, role }; // ❌ Loses wizard state!
  }
});
```

**Scenario:**
1. User in paySubscription scene (step 3/4)
2. API timeout error occurs
3. Global handler clears wizard.state
4. User presses "Retry" → lost context

**Effort:** 1-2 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
bot.catch((err, ctx) => {
  logger.error(`Bot error for ${ctx.updateType}:`, err);

  // Leave scene if active (don't clear session data)
  if (ctx.scene) {
    ctx.scene.leave().catch(() => {});
  }

  cleanReply(ctx, generalMessages.actionFailed).catch(() => {});
});
```

---

### P0-BOT-6: No Authorization Check for Workspace Handlers

**Source:** audit-bot.md  
**File:** `bot/src/handlers/workspace/index.js:35-60`  
**Impact:** User can manipulate session to access any shop  
**Risk:** Security - gain unauthorized worker access  

**Current Code:**
```javascript
export const handleWorkspaceShopSelect = async (ctx) => {
  const shopId = parseInt(ctx.match[1]);
  
  // ❌ Only checks if shop exists in session (client-side data)
  const shop = ctx.session.accessibleShops?.find(s => s.id === shopId);
  
  // ❌ No server-side verification!
  ctx.session.shopId = shop.id;
};
```

**Attack:** Modify session to include target shopId  

**Effort:** 2-3 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
export const handleWorkspaceShopSelect = async (ctx) => {
  const shopId = parseInt(ctx.match[1]);
  
  // ✅ Verify with backend
  const workerShops = await shopApi.getWorkerShops(ctx.session.token);
  const shop = workerShops.find(s => s.id === shopId);
  
  if (!shop) {
    await ctx.editMessageText(workspaceMessages.accessDenied);
    return;
  }
  
  ctx.session.shopId = shop.id;
};
```

---

### P0-BOT-7: Payment Verification Timeout Too Short

**Source:** audit-bot.md  
**File:** `bot/src/utils/api.js:7`  
**Impact:** Payment verification fails before blockchain responds  
**Risk:** User sees "failed" even though payment succeeded  

**Current Code:**
```javascript
const api = axios.create({
  timeout: 10000, // ❌ 10s timeout for blockchain verification (15-30s needed)
});
```

**Scenario:**
1. User pays subscription (BTC transaction)
2. Bot calls `/subscriptions/:id/payment/status`
3. Backend queries Blockchair API (slow)
4. Takes 15 seconds to confirm
5. Bot timeout at 10s → error shown
6. User retries → duplicate subscription

**Effort:** 2 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
export const subscriptionApi = {
  async getSubscriptionPaymentStatus(subscriptionId, token) {
    const { data } = await api.get(
      `/subscriptions/${subscriptionId}/payment/status`,
      {
        timeout: 60000, // ✅ 60s for blockchain queries
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return data.payment || data.data || data;
  }
};
```

---

### P0-BOT-8: QR Code Generation Blocks Event Loop

**Source:** audit-bot.md  
**File:** `bot/src/scenes/paySubscription.js:156-165`  
**Impact:** Bot unresponsive during peak usage  
**Risk:** CPU-intensive operation blocks event loop for 200-500ms  

**Current Code:**
```javascript
const qrCodeBuffer = await QRCode.toBuffer(invoice.address, {
  width: 512, // ❌ Large image, CPU-intensive
  margin: 2
});
```

**Scenario:**
10 users generate QR codes simultaneously:
- Each takes 300ms (CPU-bound)
- Total block time: 3 seconds
- Other users delayed by 3s

**Effort:** 4-6 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
// Option 1: Worker thread
import { Worker } from 'worker_threads';

const generateQR = (address) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./qr-worker.js');
    worker.postMessage(address);
    worker.on('message', resolve);
    worker.on('error', reject);
  });
};

// Option 2: Backend generates QR (better)
const invoice = await subscriptionApi.generateSubscriptionInvoice(...);
// Backend returns invoice.qrCodeUrl (pre-generated)
```

---

## 🔴 DATABASE (3 issues)

### P0-DB-1: Wallet Address Reuse Vulnerability

**Source:** audit-database.md  
**File:** `backend/database/schema.sql:50-53`  
**Impact:** Payment attribution ambiguity, potential fraud  
**Risk:** Multiple shops can use same wallet address  

**Current Schema:**
```sql
wallet_btc VARCHAR(255),
wallet_eth VARCHAR(255),
wallet_usdt VARCHAR(255),
wallet_ltc VARCHAR(255)
-- ❌ No uniqueness constraint!
```

**Scenario:**
- Shop A: wallet_btc = "bc1qxy2..."
- Shop B: wallet_btc = "bc1qxy2..." (same!)
- Payment arrives → which shop gets credit?

**Effort:** 30 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```sql
ALTER TABLE shops ADD CONSTRAINT shops_wallet_btc_unique 
  UNIQUE (wallet_btc) WHERE wallet_btc IS NOT NULL;

ALTER TABLE shops ADD CONSTRAINT shops_wallet_eth_unique 
  UNIQUE (wallet_eth) WHERE wallet_eth IS NOT NULL;

ALTER TABLE shops ADD CONSTRAINT shops_wallet_usdt_unique 
  UNIQUE (wallet_usdt) WHERE wallet_usdt IS NOT NULL;

ALTER TABLE shops ADD CONSTRAINT shops_wallet_ltc_unique 
  UNIQUE (wallet_ltc) WHERE wallet_ltc IS NOT NULL;
```

---

### P0-DB-2: Missing Rollback in shopFollowController

**Source:** audit-database.md  
**File:** `backend/src/controllers/shopFollowController.js:343-382`  
**Impact:** Inconsistent state if sync fails after follow creation  
**Risk:** Transaction committed but product sync fails  

**Current Code:**
```javascript
// Transaction committed
await client.query('COMMIT');

// Product sync AFTER transaction (OUTSIDE transaction!)
if (normalizedMode === 'resell') {
  try {
    await syncAllProductsForFollow(follow.id);
  } catch (syncError) {
    // ⚠️ Rollback follow but transaction already committed!
    await shopFollowQueries.delete(follow.id);
  }
}
```

**Effort:** 20 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
try {
  await client.query('BEGIN');
  
  // Insert follow
  const follow = await client.query(...).rows[0];
  
  // If resell mode, sync products WITHIN transaction
  if (normalizedMode === 'resell') {
    await syncAllProductsForFollow(follow.id, client); // Pass client!
  }
  
  await client.query('COMMIT');
} catch (txError) {
  await client.query('ROLLBACK');
  throw txError;
}
```

---

### P0-DB-3: Unbounded Query in getMyOrders

**Source:** audit-database.md  
**File:** `backend/src/controllers/orderController.js:203-213`  
**Impact:** Memory exhaustion with large result sets  
**Risk:** User with 10,000+ orders triggers massive query  

**Current Code:**
```javascript
orders = await orderQueries.findByBuyerId(req.user.id, limit, offset);
// No status filter, no MAX_LIMIT enforcement
```

**Attack:**
```bash
curl GET '/api/orders?limit=999999'
# Loads 999,999 records → OOM crash
```

**Effort:** 10 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
const MAX_LIMIT = 100;
const limit = Math.min(parseInt(req.query.limit, 10) || 50, MAX_LIMIT);
```

---

## 🔴 API (8 issues)

### P0-API-1: IDOR - Subscription Endpoints Missing Ownership Middleware

**Source:** audit-api.md  
**Files:** 5 subscription endpoints  
**Impact:** Users can view other users' subscription data  
**Risk:** IDOR vulnerability  

**Vulnerable Endpoints:**
- `GET /api/subscriptions/upgrade-cost/:shopId`
- `GET /api/subscriptions/status/:shopId`
- `GET /api/subscriptions/history/:shopId`
- `POST /api/subscriptions/:id/payment/generate`
- `GET /api/subscriptions/:id/payment/status`

**Current Code:**
```javascript
router.get('/upgrade-cost/:shopId', verifyToken, subscriptionController.getUpgradeCost);
// No requireShopOwner middleware!
```

**Effort:** 30 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
router.get('/upgrade-cost/:shopId', 
  verifyToken, 
  requireShopOwner,  // ✅ Add this!
  subscriptionController.getUpgradeCost
);
```

---

### P0-API-2: IDOR - Shop Follows Endpoints No Authorization

**Source:** audit-api.md  
**Files:** 5 follow endpoints  
**Impact:** Users can modify other users' shop follows  
**Risk:** IDOR vulnerability  

**Vulnerable Endpoints:**
- `GET /api/shop-follows/:id`
- `PUT /api/shop-follows/:id/markup`
- `PUT /api/shop-follows/:id/mode`
- `DELETE /api/shop-follows/:id`

**Attack:**
```bash
# User B modifies User A's follow markup
curl -H "Authorization: Bearer USER_B_TOKEN" \
  PUT /api/shop-follows/123/markup \
  -d '{"markup_percentage": 50}'
# SUCCESS!
```

**Effort:** 2 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
// Create requireFollowOwner middleware
export const requireFollowOwner = async (req, res, next) => {
  const followId = req.params.id;
  const follow = await followQueries.findById(followId);
  
  if (!follow || follow.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  req.follow = follow;
  next();
};

// Apply to routes
router.get('/:id', verifyToken, requireFollowOwner, followController.getFollowDetail);
```

---

### P0-API-3: IDOR - Migration Endpoints Missing Shop Owner Check

**Source:** audit-api.md  
**Files:** 4 migration endpoints  
**Impact:** Users can hijack other shops' channel migration  
**Risk:** Broadcast spam to other shop's subscribers  

**Vulnerable Endpoints:**
- `POST /api/shops/:shopId/migration`
- `GET /api/shops/:shopId/migration/check`
- `GET /api/shops/:shopId/migration/history`

**Attack:**
```bash
# User A triggers migration for User B's shop
curl -H "Authorization: Bearer USER_A_TOKEN" \
  POST /api/shops/999/migration \
  -d '{"new_channel": "@attacker_channel"}'
# Migration broadcast sent!
```

**Effort:** 15 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
router.post('/:shopId/migration',
  verifyToken,
  requireShopOwner,  // ✅ Add ownership check
  migrationController.initiateMigration
);
```

---

### P0-API-4: No Validation - Shop Wallets Update

**Source:** audit-api.md  
**File:** `backend/src/routes/shops.js:114-119`  
**Impact:** Invalid/malicious wallet addresses saved  
**Risk:** Loss of funds, XSS, SQL injection  

**Attack:**
```bash
curl PUT /api/shops/123/wallets \
  -d '{
    "wallet_btc": "javascript:alert(1)",
    "wallet_eth": "DROP TABLE shops;"
  }'
# Invalid addresses saved!
```

**Effort:** 5 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
// Validation already exists, just need to import and use!
import { walletValidation } from '../middleware/validation.js';

router.put('/:id/wallets',
  verifyToken,
  requireShopOwner,
  walletValidation.updateWallets,  // ✅ ADD THIS!
  shopController.updateWallets
);
```

---

### P0-API-5: No Validation - Product Bulk Operations

**Source:** audit-api.md  
**Files:** 3 bulk endpoints  
**Impact:** Database corruption, negative prices  
**Risk:** Malformed data breaks queries  

**Vulnerable Endpoints:**
- `POST /api/products/bulk-discount`
- `POST /api/products/bulk-discount/remove`
- `POST /api/products/bulk-update`

**Attack:**
```bash
# Negative discount
curl POST /api/products/bulk-discount \
  -d '{"percentage": -50, "type": "malicious"}'

# Malformed bulk update
curl POST /api/products/bulk-update \
  -d '{"updates": [{"productId": "not-a-number", "updates": {"price": -999}}]}'
```

**Effort:** 1 hour  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
// Create validation schemas
export const productValidation = {
  bulkDiscount: [
    body('percentage').isFloat({ min: 0, max: 100 }),
    body('type').isIn(['permanent', 'timer']),
    validate
  ],
  
  bulkUpdate: [
    body('updates').isArray({ min: 1, max: 50 }),
    body('updates.*.productId').isInt({ min: 1 }),
    body('updates.*.updates.price').optional().isFloat({ min: 0 }),
    validate
  ]
};
```

---

### P0-API-6: No Rate Limiting - Subscription Payments

**Source:** audit-api.md  
**Files:** 3 subscription endpoints  
**Impact:** DoS, blockchain API quota exhaustion  
**Risk:** Spam subscription payments  

**Vulnerable Endpoints:**
- `POST /api/subscriptions/pay`
- `POST /api/subscriptions/upgrade`
- `POST /api/subscriptions/pending`

**Attack:**
```bash
# Spam 1000 subscription payments
for i in {1..1000}; do
  curl POST /api/subscriptions/pay \
    -d '{"shopId": 1, "txHash": "fake-'$i'"}' &
done
# Blockchain API rate limits hit
```

**Effort:** 15 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
export const subscriptionLimiter = createRateLimiter(
  5 * 60 * 1000,  // 5 minutes
  10,  // Max 10 operations per 5 minutes
  'Too many subscription requests'
);

router.use(subscriptionLimiter);
```

---

### P0-API-7: No Rate Limiting - Shop Creation

**Source:** audit-api.md  
**File:** `backend/src/routes/shops.js:14-19`  
**Impact:** Database bloat, name squatting  
**Risk:** Spam shop creation  

**Attack:**
```bash
for name in {test1..test10000}; do
  curl POST /api/shops -d "{\"name\": \"$name\"}" &
done
```

**Effort:** 10 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
export const shopCreationLimiter = createRateLimiter(
  60 * 60 * 1000,  // 1 hour
  5,  // Max 5 shops per hour
  'Too many shop creation attempts'
);

router.post('/', verifyToken, shopCreationLimiter, shopController.create);
```

---

### P0-API-8: No Validation + No Rate Limiting - AI Chat

**Source:** audit-api.md  
**File:** `backend/src/routes/ai.js:7`  
**Impact:** AI API cost explosion, quota exhaustion  
**Risk:** Spam with large prompts  

**Attack:**
```bash
curl POST /api/ai/products/chat \
  -d '{"message": "A".repeat(100000)}'  # 100KB prompt
# AI API quota exhausted
```

**Effort:** 30 minutes  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
export const aiValidation = {
  chat: [
    body('message').trim().notEmpty().isLength({ max: 500 }),
    validate
  ]
};

export const aiLimiter = createRateLimiter(60 * 1000, 10);

router.post('/products/chat', 
  verifyToken, 
  aiLimiter, 
  aiValidation.chat, 
  aiProductController.chat
);
```

---

## 🔴 PERFORMANCE (1 issue)

### P0-PERF-1: Product Sync Blocks HTTP Request

**Source:** audit-performance.md  
**File:** `backend/src/controllers/shopFollowController.js:287`  
**Impact:** 10-30s response time for large catalogs  
**Risk:** Timeout, DDoS vector  

**Current Code:**
```javascript
if (normalizedMode === 'resell') {
  await syncAllProductsForFollow(follow.id);  // 🔥 BLOCKS 10-30 SECONDS
}
res.status(201).json({ data: formatFollowResponse(followWithDetails) });
```

**Scenario:**
- 1000 products × 4 DB queries = 4000 queries
- Estimated time: 10-30 seconds
- User sees timeout → retries → duplicate follows

**Effort:** 4-6 hours  
**Priority:** 1  
**Blocker:** YES

**Fix:**
```javascript
// Queue background job instead
if (normalizedMode === 'resell') {
  await syncQueue.add('sync-products', {
    followId: follow.id,
    sourceShopId: sourceId
  });
}

res.status(201).json({
  data: {
    ...formatFollowResponse(followWithDetails),
    syncStatus: 'pending',
    message: 'Products sync started in background'
  }
});
```

**Dependencies:** Redis, Bull queue

---

## 🔴 TESTS (1 issue)

### P0-TEST-1: Payment Verification Blockchain Logic Untested

**Source:** audit-tests.md  
**File:** `backend/src/services/crypto.js` (0% coverage)  
**Impact:** Security risk - wrong amount verification allows underpayment  
**Risk:** Direct financial loss  

**Untested Functions:**
- `verifyBitcoinTransaction()` - **UNTESTED!**
- `verifyEthereumTransaction()` - **UNTESTED!**
- `verifyUSDTTransaction()` - **UNTESTED!**
- `verifyLitecoinTransaction()` - **UNTESTED!**

**Missing Test Coverage:**
- Valid BTC transaction (correct amount, address, confirmations)
- Transaction not found (404)
- Wrong address in outputs
- Insufficient amount (tolerance check)
- Insufficient confirmations (<3)
- API timeout/retry logic

**Effort:** 12-15 hours  
**Priority:** 1  
**Blocker:** YES

**Required Tests (estimated 25):**
```javascript
describe('Bitcoin Verification', () => {
  it('should verify valid BTC transaction');
  it('should reject transaction not found');
  it('should reject wrong address');
  it('should reject insufficient amount');
  it('should reject insufficient confirmations');
  // ... 20 more
});
```

---

## Immediate Action Plan

### THIS WEEK (must complete):

**Day 1-2: Critical Security (8 issues)**
1. [P0-SEC-1] Add requireShopOwner to shop details endpoint
2. [P0-SEC-2] Restrict wallet access to shop owner + active buyers
3. [P0-SEC-3] Remove test authentication bypass
4. [P0-SEC-4] Add rate limiting on resource creation
5. [P0-SEC-5] Validate logo URLs against SSRF
6. [P0-SEC-6] Implement CSRF protection
7. [P0-SEC-7] Sanitize error responses
8. [P0-SEC-8] Remove hardcoded internal secret

**Day 3: Critical Payment (5 issues)**
1. [P0-PAY-1] Validate tx_hash cross-order usage
2. [P0-PAY-2] Implement invoice generation (LONGEST - 4-6 hours)
3. [P0-PAY-3] Add webhook signature validation
4. [P0-PAY-4] Create invoice cleanup cron
5. [P0-PAY-5] Fix amount rounding with Decimal.js

**Day 4: Backend + Database (6 issues)**
1. [P0-BACK-1] Move promo code to environment
2. [P0-BACK-2] Fix connection leak in transactions
3. [P0-BACK-3] Enforce MAX_LIMIT in queries
4. [P0-DB-1] Add wallet uniqueness constraints
5. [P0-DB-2] Fix shopFollowController rollback
6. [P0-DB-3] Add MAX_LIMIT to getMyOrders

**Day 5: Frontend + Bot Priority (6 issues)**
1. [P0-FE-1] Fix FollowDetail loadData cleanup
2. [P0-FE-2] Fix WalletsModal race condition
3. [P0-FE-3] Fix WebSocket timeout accumulation
4. [P0-FE-4] Fix CountdownTimer cleanup
5. [P0-BOT-1] Add scene.leave() in error handlers (2-3 hours)
6. [P0-BOT-2] Implement Redis sessions (4-6 hours)

**Total Time (Day 1-5):** ~60-70 hours with 2 developers

---

## Blockers Checklist

- [ ] All security P0 fixed (8 issues)
- [ ] All payment P0 fixed (5 issues)
- [ ] All backend P0 fixed (3 issues)
- [ ] All frontend P0 fixed (4 issues)
- [ ] All bot P0 fixed (8 issues)
- [ ] All database P0 fixed (3 issues)
- [ ] All API P0 fixed (8 issues)
- [ ] All performance P0 fixed (1 issue)
- [ ] Payment verification tests added
- [ ] Regression tests passing

---

## Risk Assessment

**Current Risk Level:** 🔴 **CRITICAL** - 31 production blockers

**After P0 Fixes:** 🟡 **MEDIUM** - Safe for beta/staging

**Production Ready:** ❌ **NO** - Fix all P0 first

---

**Last Updated:** 2025-11-05  
**Status:** Ready for immediate execution  
**Estimated Time to Production Ready:** 85-105 hours (2-3 weeks with 2 developers)
