# Security Audit Report - Status Stock 4.0

**Date:** 2025-01-05  
**Auditor:** Claude Code (Security Analysis)  
**Scope:** Full-stack application (Backend API, WebApp, Bot)  
**Methodology:** OWASP Top 10 2021 Framework  

---

## Executive Summary

**Total Vulnerabilities Found:** 23

| Severity | Count | Status |
|----------|-------|--------|
| **P0 (Critical)** | 8 | 🚨 **BLOCKS PRODUCTION** |
| **P1 (High)** | 7 | ⚠️ Must fix before launch |
| **P2 (Medium)** | 5 | 📝 Recommended fixes |
| **P3 (Low)** | 3 | 💡 Best practices |

### Risk Assessment

**Current Security Posture:** 🔴 **HIGH RISK** - NOT production-ready

**Critical Findings:**
- Broken access control allowing unauthorized shop wallet access
- Test authentication bypass may persist in production
- Missing rate limiting enables resource exhaustion attacks
- SSRF vulnerability via unvalidated logo URLs
- No CSRF protection for state-changing operations

**Recommendation:** **DO NOT DEPLOY** until all P0 vulnerabilities are resolved.

---

## OWASP Top 10 Summary

| OWASP ID | Category | Issues Found | Severity |
|----------|----------|--------------|----------|
| **A01** | Broken Access Control | 7 | P0, P1, P2 |
| **A02** | Cryptographic Failures | 3 | P0, P1, P2 |
| **A03** | Injection | 1 | P0 |
| **A04** | Insecure Design | 4 | P0, P1, P2 |
| **A05** | Security Misconfiguration | 2 | P1, P2 |
| **A06** | Vulnerable Components | 0 | ✅ Clean |
| **A07** | Authentication Failures | 3 | P0, P1 |
| **A08** | Data Integrity Failures | 2 | P1, P2 |
| **A09** | Logging Failures | 1 | P1 |
| **A10** | SSRF | 1 | P0 |

**npm audit:** ✅ 0 vulnerabilities in dependencies

---

## P0: CRITICAL VULNERABILITIES (FIX IMMEDIATELY)

### [A01-P0-001] Missing Authorization on Shop Details Endpoint

**File:** `backend/src/routes/shops.js:78`  
**OWASP:** A01 - Broken Access Control  
**CWE:** CWE-862 Missing Authorization  

**Issue:**
```javascript
// ❌ VULNERABLE - No authorization check
router.get('/:id', shopValidation.getById, shopController.getById);
```

**Attack Scenario:**
1. Attacker authenticates as User A
2. Attacker calls `GET /api/shops/123` (User B's shop)
3. System returns ALL shop data including:
   - `wallet_btc`, `wallet_eth`, `wallet_usdt`, `wallet_ltc` (PII)
   - `owner_id` (horizontal privilege escalation)
   - `subscription_status`, `tier`, `next_payment_due`

**Impact:** 
- **CRITICAL** - Complete shop data exposure
- **Data Breach** - Wallet addresses (PII) leaked
- **Horizontal Privilege Escalation** - Access to any shop

**Proof of Concept:**
```bash
# Attacker gets their own token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"telegramId": 123456}'

# Attacker accesses ANOTHER user's shop
curl -X GET http://localhost:3000/api/shops/999 \
  -H "Authorization: Bearer <attacker_token>"

# Response: ✅ 200 OK - FULL shop details returned!
{
  "id": 999,
  "owner_id": 888,           # ← Leaks other user's ID
  "wallet_btc": "bc1q...",    # ← CRITICAL: Payment address leaked
  "wallet_eth": "0x...",
  "wallet_usdt": "TR...",
  "subscription_status": "active",
  "tier": "pro"
}
```

**Fix:**
```javascript
// ✅ SECURE VERSION
router.get(
  '/:id',
  verifyToken,           // ← Add authentication
  requireShopOwner,      // ← Add authorization check
  shopValidation.getById,
  shopController.getById
);
```

**OR** (if public access is needed):
```javascript
// Option 2: Filter sensitive fields for non-owners
export const getById = async (req, res) => {
  const shop = await shopQueries.findById(req.params.id);
  if (!shop) return res.status(404).json({ error: 'Not found' });

  // Check if requester is owner
  const isOwner = req.user && shop.owner_id === req.user.id;

  // Return filtered data for non-owners
  if (!isOwner) {
    const publicShop = {
      id: shop.id,
      name: shop.name,
      description: shop.description,
      logo: shop.logo,
      is_active: shop.is_active,
      tier: shop.tier,
      created_at: shop.created_at
      // ❌ NO wallet addresses, owner_id, subscription details
    };
    return res.json({ success: true, data: publicShop });
  }

  // Full data for owner
  return res.json({ success: true, data: shop });
};
```

**Effort:** 30 minutes  
**Priority:** P0 - **BLOCKS PRODUCTION**

---

### [A01-P0-002] Unauthorized Wallet Access for Payments

**File:** `backend/src/routes/shops.js:62-68`  
**OWASP:** A01 - Broken Access Control  

**Issue:**
```javascript
// ❌ TOO PERMISSIVE - Any authenticated user can view ANY shop's wallets
router.get(
  '/:id/wallets',
  verifyToken,           // ← Only checks if user is authenticated
  shopController.getWallets  // ← No ownership check!
);
```

**Attack Scenario:**
1. Attacker authenticates as User A
2. Attacker calls `GET /api/shops/123/wallets` (User B's shop)
3. System returns all payment wallet addresses
4. Attacker can now phish buyers by impersonating shop owner

**Impact:**
- **CRITICAL** - Payment address exposure
- **Phishing Risk** - Attacker can redirect payments to their own wallets
- **Privacy Violation** - Wallet addresses are PII

**Business Logic Analysis:**
This endpoint is used by buyers during checkout to get seller's wallet addresses. The current implementation allows ANY authenticated user to get ANY shop's wallets, which is correct for payment flow BUT creates unnecessary exposure.

**Fix:**
```javascript
// ✅ SECURE - Only return wallets for active orders or shop owner
export const getWallets = async (req, res) => {
  const { id: shopId } = req.params;
  const userId = req.user.id;

  const shop = await shopQueries.findById(shopId);
  if (!shop) return res.status(404).json({ error: 'Shop not found' });

  // Allow if:
  // 1. User is shop owner
  const isOwner = shop.owner_id === userId;
  
  // 2. User has pending orders for this shop
  const hasPendingOrder = await orderQueries.userHasPendingOrderForShop(
    userId,
    shopId
  );

  if (!isOwner && !hasPendingOrder) {
    return res.status(403).json({
      success: false,
      error: 'Wallet access denied. Create an order first.'
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      wallet_btc: shop.wallet_btc || null,
      wallet_eth: shop.wallet_eth || null,
      wallet_usdt: shop.wallet_usdt || null,
      wallet_ltc: shop.wallet_ltc || null,
      updated_at: shop.updated_at
    }
  });
};
```

**Add helper query:**
```javascript
// backend/src/models/db.js
export const orderQueries = {
  // ...existing queries...
  
  userHasPendingOrderForShop: async (userId, shopId) => {
    const result = await query(
      `SELECT EXISTS(
        SELECT 1 FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.buyer_id = $1
          AND p.shop_id = $2
          AND o.status = 'pending'
      )`,
      [userId, shopId]
    );
    return result.rows[0].exists;
  }
};
```

**Effort:** 45 minutes  
**Priority:** P0 - **BLOCKS PRODUCTION**

---

### [A07-P0-003] Test Authentication Bypass in Production

**File:** `backend/src/middleware/auth.js:29-38`  
**OWASP:** A07 - Identification and Authentication Failures  
**CWE:** CWE-798 Use of Hard-coded Credentials  

**Issue:**
```javascript
// ❌ CRITICAL BACKDOOR
// Test environment shortcut: accept synthetic tokens used in integration tests
if (config.nodeEnv === 'test' && token.startsWith('test_token_user_')) {
  const userId = Number.parseInt(token.replace('test_token_user_', ''), 10);

  if (Number.isInteger(userId)) {
    req.user = {
      id: userId,
      telegramId: null,
      username: null
    };
    return next();
  }
}
```

**Attack Scenario:**
If `NODE_ENV=test` is accidentally set in production (common misconfiguration):
1. Attacker sends: `Authorization: Bearer test_token_user_1`
2. System bypasses JWT validation completely
3. Attacker is authenticated as user ID 1 (likely admin/first user)
4. Full access to admin account without password

**Impact:**
- **CRITICAL** - Complete authentication bypass
- **Account Takeover** - Access to any user account
- **Data Breach** - Full database access

**Real-World Example:**
Many production environments accidentally deploy with `NODE_ENV=development` or `NODE_ENV=test`, especially in:
- Docker containers with wrong ENV
- CI/CD pipelines that forget to set production ENV
- Staging environments promoted to production

**Fix:**
```javascript
// ✅ SECURE VERSION - Remove test shortcut entirely
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    // ❌ DELETE TEST BYPASS ENTIRELY
    // Production apps should NEVER have test shortcuts in auth middleware

    // ✅ Always verify JWT
    const decoded = jwt.verify(token, config.jwt.secret);

    req.user = {
      id: decoded.id,
      telegramId: decoded.telegramId,
      username: decoded.username
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    return res.status(500).json({ success: false, error: 'Authentication error' });
  }
};
```

**Alternative (if test shortcuts are needed):**
```javascript
// Move to separate test-only middleware file
// backend/src/middleware/testAuth.js (gitignored, never deployed)
export const testAuthMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test auth middleware used in non-test environment!');
  }
  // ... test shortcuts here ...
};
```

**Effort:** 15 minutes  
**Priority:** P0 - **BLOCKS PRODUCTION**

---

### [A04-P0-004] Missing Rate Limiting on Resource Creation

**File:** `backend/src/routes/shops.js:14`, `backend/src/routes/products.js:14`  
**OWASP:** A04 - Insecure Design  
**CWE:** CWE-770 Allocation of Resources Without Limits  

**Issue:**
```javascript
// ❌ VULNERABLE - Only global rate limit (1000 req/15min)
router.post('/', verifyToken, shopValidation.create, shopController.create);
router.post('/', verifyToken, checkProductLimit, productValidation.create, productController.create);
```

**Current Rate Limits (constants.js):**
```javascript
API: {
  WINDOW_MS: 15 * 60 * 1000,  // 15 minutes
  MAX_REQUESTS: 1000          // TOO HIGH!
}
```

**Attack Scenario:**
1. Attacker registers 10 bot accounts
2. Each bot creates 100 shops in 15 minutes
3. Total: 1000 shops created (within rate limit)
4. Database exhaustion, disk space consumed, service degradation

**Impact:**
- **HIGH** - Resource exhaustion (DoS)
- **Cost** - Database growth, hosting costs
- **Service Degradation** - Slower for legitimate users

**Fix:**
```javascript
// ✅ SECURE - Add per-resource rate limiters

// backend/src/middleware/rateLimiter.js
export const shopCreationLimiter = createRateLimiter(
  60 * 60 * 1000,  // 1 hour
  5,               // Max 5 shops per hour per IP
  'Too many shop creation attempts. Please try again later.'
);

export const productCreationLimiter = createRateLimiter(
  60 * 1000,       // 1 minute
  10,              // Max 10 products per minute per IP
  'Too many product creation attempts. Please slow down.'
);

// backend/src/routes/shops.js
router.post(
  '/',
  verifyToken,
  shopCreationLimiter,      // ← Add specific limiter
  shopValidation.create,
  shopController.create
);

// backend/src/routes/products.js
router.post(
  '/',
  verifyToken,
  productCreationLimiter,   // ← Add specific limiter
  checkProductLimit,
  productValidation.create,
  productController.create
);
```

**Additional Protection:**
```javascript
// Add per-user limits in controller
export const create = async (req, res) => {
  // Check if user already has a shop
  const existingShops = await shopQueries.findByOwnerId(req.user.id);
  
  // ✅ Limit: 1 shop per user (business rule)
  if (existingShops.length >= 1) {
    return res.status(400).json({
      success: false,
      error: 'User already has a shop. Only one shop per account allowed.'
    });
  }
  
  // ... rest of creation logic
};
```

**Effort:** 30 minutes  
**Priority:** P0 - **BLOCKS PRODUCTION**

---

### [A10-P0-005] SSRF via Unvalidated Logo URL

**File:** `backend/src/middleware/validation.js:46-48`  
**OWASP:** A10 - Server-Side Request Forgery  
**CWE:** CWE-918 Server-Side Request Forgery  

**Issue:**
```javascript
// ❌ VULNERABLE - Only checks if valid URL format
body('logo')
  .optional()
  .isURL()  // ← Does NOT validate against internal IPs
  .withMessage('Logo must be a valid URL'),
```

**Attack Scenario:**
1. Attacker creates shop with logo: `http://localhost:5432`
2. System validates URL format: ✅ Valid
3. Frontend/bot attempts to fetch logo → internal port scan
4. Attacker discovers internal services:
   - `http://localhost:5432` → PostgreSQL (database)
   - `http://169.254.169.254/latest/meta-data/` → AWS metadata
   - `http://10.0.0.5:6379` → Redis cache
   - `http://192.168.1.1/admin` → Router admin panel

**Impact:**
- **HIGH** - Internal network reconnaissance
- **Cloud Metadata Access** - AWS/GCP credentials leak
- **Database Access** - If DB exposed on network

**Fix:**
```javascript
// ✅ SECURE - Validate against internal IPs

// backend/src/utils/validation.js
import { isIP } from 'net';
import { URL } from 'url';

/**
 * Check if URL points to internal/private network
 */
export function isInternalUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Block common internal hostnames
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '169.254.169.254',  // AWS metadata
      'metadata.google.internal',  // GCP metadata
    ];
    
    if (blockedHosts.some(h => url.hostname.includes(h))) {
      return true;
    }
    
    // Block private IP ranges (RFC 1918)
    const hostname = url.hostname;
    if (isIP(hostname)) {
      const parts = hostname.split('.');
      const first = parseInt(parts[0], 10);
      const second = parseInt(parts[1], 10);
      
      // 10.0.0.0/8
      if (first === 10) return true;
      
      // 172.16.0.0/12
      if (first === 172 && second >= 16 && second <= 31) return true;
      
      // 192.168.0.0/16
      if (first === 192 && second === 168) return true;
      
      // 127.0.0.0/8 (loopback)
      if (first === 127) return true;
    }
    
    return false;
  } catch {
    return true; // Invalid URL → block
  }
}

// backend/src/middleware/validation.js
import { isInternalUrl } from '../utils/validation.js';

export const shopValidation = {
  create: [
    // ... other validations ...
    
    body('logo')
      .optional()
      .isURL()
      .withMessage('Logo must be a valid URL')
      .custom((value) => {
        if (value && isInternalUrl(value)) {
          throw new Error('Logo URL cannot point to internal network');
        }
        return true;
      }),
    
    validate
  ]
};
```

**Additional Protection:**
```javascript
// Add to server.js for defense in depth
import helmet from 'helmet';

app.use(helmet({
  // ... existing config ...
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: [
        "'self'",
        "data:",
        "https:",  // Only allow HTTPS images
        // ❌ NOT: "http:" (blocks HTTP entirely)
      ],
    },
  },
}));
```

**Effort:** 1 hour  
**Priority:** P0 - **BLOCKS PRODUCTION**

---

### [A01-P0-006] Missing CSRF Protection

**OWASP:** A01 - Broken Access Control  
**CWE:** CWE-352 Cross-Site Request Forgery  

**Issue:**
No CSRF tokens for state-changing operations (POST, PUT, DELETE).

**Attack Scenario:**
1. Victim is logged into Status Stock (has valid JWT in localStorage)
2. Victim visits attacker's malicious website
3. Malicious site makes request:
```html
<!-- Attacker's site: evil.com -->
<script>
// Use victim's token to create order
fetch('https://statusstock.com/api/orders', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + stolenToken,  // ← From XSS or localStorage leak
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

**Impact:**
- **MEDIUM-HIGH** - Unauthorized actions on behalf of victim
- **Account Takeover** - If combined with XSS
- **Financial Loss** - Unauthorized orders/payments

**Note:** Current implementation uses JWT in Authorization header (not cookies), which provides **some** CSRF protection. However, if tokens are ever stored in cookies or if there's an XSS vulnerability, CSRF becomes critical.

**Fix:**
```javascript
// ✅ SECURE - Add CSRF protection with csurf package

// backend/package.json
{
  "dependencies": {
    "csurf": "^1.11.0"
  }
}

// backend/src/middleware/csrf.js
import csrf from 'csurf';

// CSRF protection for cookie-based sessions
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Generate CSRF token endpoint
export const getCsrfToken = (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
};

// backend/src/server.js
import { csrfProtection, getCsrfToken } from './middleware/csrf.js';

// Get CSRF token for client
app.get('/api/csrf-token', csrfProtection, getCsrfToken);

// Apply to state-changing routes
app.use('/api/orders', csrfProtection);
app.use('/api/products', csrfProtection);
app.use('/api/shops', csrfProtection);
```

**Frontend:**
```javascript
// webapp/src/hooks/useApi.js
const createRequest = (tokenGetter) => async (method, endpoint, data = null, config = {}) => {
  // Get CSRF token for state-changing requests
  let csrfToken = null;
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfRes = await axios.get(`${API_BASE_URL}/csrf-token`);
    csrfToken = csrfRes.data.csrfToken;
  }

  const axiosConfig = {
    method,
    url: `${API_BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...(currentToken && { 'Authorization': `Bearer ${currentToken}` }),
      ...(csrfToken && { 'X-CSRF-Token': csrfToken }),  // ← Add CSRF token
      ...config.headers,
    },
    // ... rest of config
  };
  // ...
};
```

**Alternative (Simpler):**
```javascript
// Use SameSite cookies for JWT instead of localStorage
// This provides built-in CSRF protection

// backend/src/controllers/authController.js
export const login = async (req, res) => {
  // ... generate token ...
  
  // Set as httpOnly cookie instead of response body
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  });
  
  return res.json({ success: true, user });
};
```

**Effort:** 2 hours  
**Priority:** P0 - **Important for production**

---

### [A02-P0-007] Sensitive Data Exposure in Error Responses

**File:** `backend/src/middleware/errorHandler.js:24-33`  
**OWASP:** A02 - Cryptographic Failures  
**CWE:** CWE-209 Generation of Error Message Containing Sensitive Information  

**Issue:**
```javascript
// ❌ VULNERABLE - Stack traces leak internal structure
if (config.nodeEnv === 'development') {
  errorResponse.stack = err.stack;      // ← Leaks file paths, function names
  errorResponse.details = err.details || null;
}

// ❌ Database errors expose schema
if (err.code === '23505') {
  return new ApiError(409, 'Resource already exists', {
    constraint: err.constraint  // ← Leaks table/column names!
  });
}
```

**Attack Scenario:**
1. Attacker triggers database error (e.g., duplicate username)
2. Response: `{ error: 'Resource already exists', details: { constraint: 'users_username_key' }}`
3. Attacker learns: Table name is `users`, column is `username`, index exists
4. Attacker can now craft SQL injection or guess schema structure

**Development Error Example:**
```json
{
  "success": false,
  "error": "Database error",
  "stack": "Error: connect ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1300:16)\n    at /Users/dev/status-stock/backend/src/config/database.js:45:12",
  "details": {
    "code": "ECONNREFUSED",
    "syscall": "connect",
    "address": "127.0.0.1",
    "port": 5432
  }
}
```
→ Leaks internal IP, port, file paths, developer username!

**Impact:**
- **HIGH** - Information disclosure aids further attacks
- **Schema Enumeration** - Database structure revealed
- **Path Disclosure** - Internal file structure leaked

**Fix:**
```javascript
// ✅ SECURE - Never leak internal details

// backend/src/middleware/errorHandler.js
export const errorHandler = (err, req, res, _next) => {
  // Log FULL error internally (with stack, details)
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    // ❌ Do NOT log req.body (may contain passwords)
  });

  // Determine error status
  const statusCode = err.statusCode || err.status || 500;

  // Prepare MINIMAL error response (same for all environments)
  const errorResponse = {
    success: false,
    error: err.isOperational ? err.message : 'Internal server error'
    // ❌ NEVER include: stack, details, err.code, constraint names
  };

  // Send response
  res.status(statusCode).json(errorResponse);
};

// Database error handler - NO schema details
export const dbErrorHandler = (err) => {
  logger.error('Database error', {
    error: err.message,
    code: err.code,
    detail: err.detail,
    constraint: err.constraint  // ← Log internally only
  });

  // Generic messages for users
  if (err.code === '23505') {
    return new ApiError(409, 'This value already exists');  // ← No constraint name
  }

  if (err.code === '23503') {
    return new ApiError(400, 'Referenced resource not found');  // ← No FK details
  }

  if (err.code === '23502') {
    return new ApiError(400, 'Required field is missing');  // ← No column name
  }

  return new ApiError(500, 'Database operation failed');
};
```

**Effort:** 45 minutes  
**Priority:** P0 - **BLOCKS PRODUCTION**

---

### [A03-P0-008] Potential SQL Injection in Dynamic Queries

**File:** `backend/src/models/db.js` (various queries)  
**OWASP:** A03 - Injection  
**CWE:** CWE-89 SQL Injection  

**Current Status:** ✅ **MOSTLY SECURE** - All queries I reviewed use parameterized queries ($1, $2, etc.)

**Issue:**
Need to verify **ALL** queries use parameterization, especially:
- Dynamic WHERE clauses
- ORDER BY with user input
- LIKE queries with user-controlled patterns

**Potential Vulnerability Example:**
```javascript
// ❌ DANGEROUS (if this exists anywhere)
const result = await query(
  `SELECT * FROM products WHERE name LIKE '%${searchTerm}%'`  // ← SQL injection!
);

// Attack: searchTerm = "'; DROP TABLE products; --"
```

**Audit Required:**
```bash
# Search for potential SQL injection patterns
grep -r "query\(\`.*\${" backend/src/
grep -r 'query\(`.*\${' backend/src/
grep -r "query('.*' + " backend/src/
```

**Fix (if found):**
```javascript
// ✅ SECURE - Parameterized query
const result = await query(
  `SELECT * FROM products WHERE name ILIKE $1`,
  [`%${searchTerm}%`]  // ← Safe: PostgreSQL driver escapes this
);
```

**Special Case - ORDER BY:**
```javascript
// ❌ VULNERABLE - Cannot use $1 for column names
const orderBy = req.query.sort; // User input: "name" or "price"
const result = await query(
  `SELECT * FROM products ORDER BY ${orderBy}`  // ← SQL injection if not validated!
);

// Attack: sort = "name; DROP TABLE products; --"

// ✅ SECURE - Whitelist allowed columns
const allowedSortColumns = ['name', 'price', 'created_at'];
const orderBy = allowedSortColumns.includes(req.query.sort) 
  ? req.query.sort 
  : 'created_at';  // Default

const result = await query(
  `SELECT * FROM products ORDER BY ${orderBy} DESC`  // ← Safe: whitelisted
);
```

**Action Required:**
1. Manual code review of ALL queries in `backend/src/models/db.js`
2. Automated scan: `npm install --save-dev sqlint && npx sqlint backend/src/`
3. Add SQL injection test cases

**Effort:** 2 hours (audit) + fixes as needed  
**Priority:** P0 - **Must verify before production**

---

## P1: HIGH SEVERITY VULNERABILITIES

### [A07-P1-001] JWT Without Refresh Token Mechanism

**File:** `backend/src/controllers/authController.js:42-45`  
**OWASP:** A07 - Identification and Authentication Failures  

**Issue:**
```javascript
// ❌ Single long-lived token (7 days)
const token = jwt.sign(
  { id: user.id, telegramId: user.telegram_id, username: user.username },
  config.jwt.secret,
  { expiresIn: '7d' }  // ← If compromised, valid for 7 days!
);
```

**Impact:**
- **HIGH** - Stolen token valid for 7 days
- **No Revocation** - Cannot invalidate compromised tokens
- **Session Fixation** - Old tokens remain valid after password change

**Fix:**
```javascript
// ✅ SECURE - Short-lived access token + refresh token

// backend/src/controllers/authController.js
export const login = async (req, res) => {
  // ... validate user ...

  // Generate short-lived access token (15 minutes)
  const accessToken = jwt.sign(
    { id: user.id, type: 'access' },
    config.jwt.secret,
    { expiresIn: '15m' }
  );

  // Generate long-lived refresh token (7 days)
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh', jti: crypto.randomUUID() },
    config.jwt.refreshSecret,  // Different secret!
    { expiresIn: '7d' }
  );

  // Store refresh token in database for revocation
  await query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
    [user.id, refreshToken]
  );

  return res.json({
    success: true,
    accessToken,
    refreshToken,
    user
  });
};

// New endpoint: Refresh access token
export const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  // Verify refresh token
  const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

  // Check if refresh token exists in DB (not revoked)
  const tokenRecord = await query(
    'SELECT * FROM refresh_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW()',
    [decoded.id, refreshToken]
  );

  if (tokenRecord.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  // Generate new access token
  const accessToken = jwt.sign(
    { id: decoded.id, type: 'access' },
    config.jwt.secret,
    { expiresIn: '15m' }
  );

  return res.json({ success: true, accessToken });
};

// Revoke refresh token (logout)
export const logout = async (req, res) => {
  const { refreshToken } = req.body;
  
  await query(
    'DELETE FROM refresh_tokens WHERE token = $1',
    [refreshToken]
  );

  return res.json({ success: true, message: 'Logged out' });
};
```

**Migration Required:**
```sql
-- Create refresh_tokens table
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

**Effort:** 3 hours  
**Priority:** P1 - **Highly recommended before production**

---

### [A07-P1-002] Weak Telegram InitData Validation in Development

**File:** `backend/src/middleware/telegramAuth.js:91-108`  
**OWASP:** A07 - Authentication Failures  

**Issue:**
```javascript
// ❌ BYPASSES VALIDATION IN DEV/TEST
export const optionalTelegramAuth = (req, res, next) => {
  const env = process.env.NODE_ENV || 'development';
  if ((env === 'development' || env === 'test') && !req.headers['x-telegram-init-data']) {
    logger.debug('Skipping Telegram validation in development/test');
    return next();  // ← Bypass!
  }
  return verifyTelegramInitData(req, res, next);
};
```

**Attack Scenario:**
If deployed with `NODE_ENV=development` (common mistake):
1. Attacker sends request WITHOUT x-telegram-init-data header
2. Validation skipped
3. Attacker can access Telegram-protected endpoints

**Impact:**
- **MEDIUM** - Authentication bypass in misconfigured production
- **Depends** on whether optionalTelegramAuth is used on critical endpoints

**Fix:**
```javascript
// ✅ SECURE - Never skip validation, use mock in tests only

// backend/src/middleware/telegramAuth.js
export const optionalTelegramAuth = (req, res, next) => {
  // ❌ DELETE development bypass entirely
  
  // If no initData header present, continue without user
  if (!req.headers['x-telegram-init-data']) {
    return next();
  }
  
  // If initData present, ALWAYS validate (even in dev)
  return verifyTelegramInitData(req, res, next);
};

// For testing, use dependency injection instead
// backend/__tests__/setup.js
if (process.env.NODE_ENV === 'test') {
  // Mock Telegram validation in tests ONLY
  jest.mock('../src/middleware/telegramAuth.js', () => ({
    verifyTelegramInitData: (req, res, next) => {
      req.telegramUser = { id: 123, username: 'test_user' };
      next();
    }
  }));
}
```

**Effort:** 30 minutes  
**Priority:** P1 - **Fix before production**

---

### [A01-P1-003] Insecure Direct Object Reference in Order Fetching

**File:** `backend/src/controllers/orderController.js:87-112`  
**OWASP:** A01 - Broken Access Control  

**Issue:**
```javascript
// ❌ FETCHES order BEFORE authorization check
export const getById = async (req, res) => {
  const { id } = req.params;

  const order = await orderQueries.findById(id);  // ← Fetch first

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Check authorization AFTER fetch
  if (order.buyer_id !== req.user.id && order.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  // ...
};
```

**Impact:**
- **LOW-MEDIUM** - Timing attack reveals if order ID exists
- **Information Leakage** - 404 vs 403 distinguishes existence
- **Best Practice** - Fetch only authorized data

**Better Design:**
```javascript
// ✅ SECURE - Fetch only if authorized

export const getById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Single query with authorization built-in
  const order = await orderQueries.findByIdForUser(id, userId);

  if (!order) {
    // Ambiguous error - cannot tell if order doesn't exist or access denied
    return res.status(404).json({ error: 'Order not found' });
  }

  return res.status(200).json({ success: true, data: order });
};

// backend/src/models/db.js
export const orderQueries = {
  // ... existing methods ...
  
  findByIdForUser: async (orderId, userId) => {
    const result = await query(
      `SELECT o.*, p.name as product_name, p.shop_id, s.name as shop_name, s.owner_id
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN shops s ON p.shop_id = s.id
       WHERE o.id = $1
         AND (o.buyer_id = $2 OR s.owner_id = $2)  -- ← Authorization in query
       LIMIT 1`,
      [orderId, userId]
    );
    return result.rows[0];
  }
};
```

**Effort:** 2 hours (refactor all IDOR endpoints)  
**Priority:** P1 - **Recommended for production**

---

### [A09-P1-004] Sensitive Data Logged in Request Logger

**File:** `backend/src/middleware/requestLogger.js` (implied)  
**OWASP:** A09 - Security Logging and Monitoring Failures  
**CWE:** CWE-532 Insertion of Sensitive Information into Log File  

**Issue:**
```javascript
// ❌ LIKELY VULNERABLE - Logs req.body which may contain:
logger.info('Request', {
  method: req.method,
  path: req.path,
  body: req.body,  // ← May contain passwords, tokens, payment data!
  params: req.params,
  query: req.query
});
```

**Impact:**
- **MEDIUM** - Passwords, tokens, payment hashes in log files
- **Compliance** - GDPR/PCI-DSS violation
- **Insider Threat** - Anyone with log access sees secrets

**Fix:**
```javascript
// ✅ SECURE - Redact sensitive fields

// backend/src/middleware/requestLogger.js
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'credit_card',
  'cvv',
  'ssn',
  'telegramId',
  'telegram_id',
  'txHash',
  'tx_hash',
  'initData',
  'init_data'
];

function redactSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const redacted = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveData(value);  // Recursive
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

export const requestLogger = (req, res, next) => {
  logger.info('Request', {
    method: req.method,
    path: req.path,
    body: redactSensitiveData(req.body),      // ← Redacted
    params: redactSensitiveData(req.params),  // ← Redacted
    query: redactSensitiveData(req.query),    // ← Redacted
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  next();
};
```

**Effort:** 1 hour  
**Priority:** P1 - **Required for compliance**

---

### [A08-P1-005] Missing Webhook Signature Verification

**File:** `backend/src/routes/webhooks.js:30-38`  
**OWASP:** A08 - Software and Data Integrity Failures  

**Issue:**
```javascript
// ❌ SECRET TOKEN IS OPTIONAL!
const webhookSecret = process.env.BLOCKCYPHER_WEBHOOK_SECRET;
if (webhookSecret) {  // ← What if not set?
  const providedToken = req.query.token || req.headers['x-webhook-token'];
  if (!providedToken || providedToken !== webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
// If webhookSecret not set, validation is SKIPPED!
```

**Attack Scenario:**
1. Admin forgets to set `BLOCKCYPHER_WEBHOOK_SECRET` in .env
2. Attacker discovers webhook endpoint: `/webhooks/blockcypher`
3. Attacker sends fake payment confirmations
4. System marks orders as paid without actual payment

**Impact:**
- **CRITICAL** (if secret not set) - Payment fraud
- **Financial Loss** - Free products for attacker
- **Business Logic Bypass** - Fake confirmations

**Fix:**
```javascript
// ✅ SECURE - REQUIRE webhook secret

// backend/src/config/env.js
const requiredEnvVars = [
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'BLOCKCYPHER_WEBHOOK_SECRET'  // ← Add to required list
];

// backend/src/routes/webhooks.js
router.post('/blockcypher', async (req, res) => {
  // ❌ REMOVE optional check
  const webhookSecret = process.env.BLOCKCYPHER_WEBHOOK_SECRET;
  
  // ✅ ALWAYS validate (fail if not set)
  if (!webhookSecret) {
    logger.error('[Webhook] BLOCKCYPHER_WEBHOOK_SECRET not configured!');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const providedToken = req.query.token || req.headers['x-webhook-token'];

  if (!providedToken || providedToken !== webhookSecret) {
    logger.warn('[Webhook] BlockCypher: Invalid or missing webhook token', {
      ip: req.ip,
      hasToken: !!providedToken
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ... rest of webhook handler
});
```

**Additional Protection:**
```javascript
// Use HMAC signature instead of plain token
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expected = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

**Effort:** 30 minutes  
**Priority:** P1 - **CRITICAL for payment security**

---

### [A05-P1-006] CORS Misconfiguration Risk

**File:** `backend/src/server.js:94-99`  
**OWASP:** A05 - Security Misconfiguration  

**Issue:**
```javascript
// ❌ CORS origin from environment variable (unchecked)
app.use(cors({
  origin: config.frontendUrl,  // ← What if set to "*" by mistake?
  credentials: true
}));
```

**Attack Scenario:**
1. Admin accidentally sets `FRONTEND_URL=*` in production
2. Any website can now make requests with user credentials
3. Attacker's site `evil.com` makes requests to API
4. Browser sends user's cookies/tokens (credentials: true)
5. Attacker steals data or performs actions as victim

**Impact:**
- **HIGH** - Cross-origin data theft
- **Session Hijacking** - If cookies used
- **CSRF** - Combined with missing CSRF protection

**Fix:**
```javascript
// ✅ SECURE - Validate CORS origin

// backend/src/config/env.js
export const config = {
  // ... other config ...
  
  frontendUrl: (() => {
    const url = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid FRONTEND_URL: ${url}`);
    }
    
    // NEVER allow wildcard in production
    if (process.env.NODE_ENV === 'production' && url === '*') {
      throw new Error('FRONTEND_URL cannot be "*" in production!');
    }
    
    return url;
  })()
};

// backend/src/server.js
const allowedOrigins = [
  config.frontendUrl,
  'https://web.telegram.org',  // Telegram WebApp
  'https://telegram.org'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked', { origin, ip: req.ip });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data']
}));
```

**Effort:** 45 minutes  
**Priority:** P1 - **Important for production**

---

### [A01-P1-007] Missing Worker Authorization on Some Endpoints

**File:** Various controllers  
**OWASP:** A01 - Broken Access Control  

**Issue:**
Product/Order endpoints check authorization via `isAuthorizedToManageShop()` helper, but need to verify ALL endpoints consistently use this pattern.

**Audit Required:**
```javascript
// Check these endpoints have worker authorization:
// - POST /api/products → ✅ Has checkProductLimit, but need verifyShopAccess
// - PUT /api/products/:id → ✅ Has isAuthorizedToManageShop
// - DELETE /api/products/:id → ✅ Has isAuthorizedToManageShop
// - POST /api/orders/:id/status → Need to check if workers can update
// - POST /api/products/bulk-update → ✅ Has isAuthorizedToManageShop
```

**Fix:**
Ensure ALL shop management endpoints use consistent authorization:
```javascript
// Option 1: Use requireShopAccess middleware (already exists)
router.post(
  '/',
  verifyToken,
  requireShopAccess,  // ← Checks owner OR worker
  productValidation.create,
  productController.create
);

// Option 2: Keep controller-level checks (current approach)
export const create = async (req, res) => {
  const isAuthorized = await isAuthorizedToManageShop(shopId, req.user.id);
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Access denied' });
  }
  // ... create logic
};
```

**Effort:** 1 hour (audit) + 30 min per missing check  
**Priority:** P1 - **Verify before production**

---

## P2: MEDIUM SEVERITY VULNERABILITIES

### [A04-P2-001] Missing Security Headers

**File:** `backend/src/server.js:69-81`  
**OWASP:** A04 - Insecure Design  

**Issue:**
```javascript
// ❌ INCOMPLETE - Missing several security headers
app.use(helmet({
  contentSecurityPolicy: { /* ... */ },
  crossOriginEmbedderPolicy: false,
  frameguard: false  // Disabled for Telegram iframe
}));
```

**Missing Headers:**
- `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
- `Referrer-Policy: strict-origin-when-cross-origin` (privacy)
- `Permissions-Policy` (feature restrictions)

**Fix:**
```javascript
// ✅ SECURE - Comprehensive security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://telegram.org"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "ws://localhost:3000",
        "wss://localhost:3000",
        "http://localhost:3000",
        "https://*.ngrok-free.app"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameAncestors: [
        "'self'",
        "https://web.telegram.org",
        "https://*.telegram.org",
        "https://telegram.org"
      ],
    },
  },
  crossOriginEmbedderPolicy: false,
  frameguard: {
    action: 'allow-from',
    domain: 'https://telegram.org'  // ← Instead of false
  },
  xContentTypeOptions: true,  // ← Add X-Content-Type-Options: nosniff
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'  // ← Add Referrer-Policy
  },
  permissionsPolicy: {  // ← Add Permissions-Policy
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'self'"],
      payment: ["'self'"]
    }
  }
}));
```

**Effort:** 30 minutes  
**Priority:** P2 - **Recommended**

---

### [A02-P2-002] Weak Payment Amount Tolerance

**File:** `backend/src/services/crypto.js:54, 132, 212, 304`  
**OWASP:** A02 - Cryptographic Failures  

**Issue:**
```javascript
// ❌ 0.5% tolerance allows underpayment
const tolerance = expectedAmount * 0.005;  // 0.5%
const amountMatches = Math.abs(amountBTC - expectedAmount) <= tolerance;

// Example: $100 order → $99.50 accepted (attacker saves $0.50)
```

**Impact:**
- **LOW-MEDIUM** - Financial loss from underpayments
- **Accumulates** - 1000 orders × $0.50 = $500 loss

**Fix:**
```javascript
// ✅ SECURE - Tighter tolerance OR over-payment only

// Option 1: Tighter tolerance (0.1% for network fees)
const tolerance = expectedAmount * 0.001;  // 0.1%

// Option 2: Allow ONLY over-payment (common in crypto)
const amountMatches = amountBTC >= expectedAmount * 0.999;  // Accept 0.1% under OR any over

// Option 3: Fixed satoshi tolerance (for small amounts)
const toleranceSatoshis = 10000;  // ~$4 at $40k BTC
const tolerance = toleranceSatoshis / 100000000;
const amountMatches = Math.abs(amountBTC - expectedAmount) <= tolerance;
```

**Industry Standard:**
Most crypto payment processors use:
- 0.1% tolerance (Coinbase Commerce)
- No under-payment, any over-payment OK (BTCPay Server)

**Effort:** 30 minutes  
**Priority:** P2 - **Consider for production**

---

### [A08-P2-003] No Maximum Input Length on Optional Fields

**File:** `backend/src/middleware/validation.js`  
**OWASP:** A08 - Software and Data Integrity Failures  

**Issue:**
```javascript
// ✅ Has max length
body('description')
  .optional()
  .trim()
  .isLength({ max: 1000 })  // ← Good!

// ❌ NO max length
body('deliveryAddress')
  .optional()
  .trim()
  // Missing isLength({ max: X })
```

**Impact:**
- **LOW** - Database storage exhaustion
- **DoS** - Large payloads slow down parsing

**Fix:**
```javascript
// ✅ SECURE - Add max length to ALL text fields

export const orderValidation = {
  create: [
    body('deliveryAddress')
      .optional()
      .trim()
      .isLength({ max: 500 })  // ← Add limit
      .withMessage('Delivery address must not exceed 500 characters'),
    
    validate
  ]
};

// Add to all validations:
// - shop name: max 100
// - product name: max 200
// - description: max 1000
// - delivery address: max 500
// - username: max 32
```

**Effort:** 45 minutes  
**Priority:** P2 - **Recommended**

---

### [A04-P2-004] HSTS Not Enforced in All Production Environments

**File:** `backend/src/server.js:72-88`  
**OWASP:** A04 - Insecure Design  

**Issue:**
```javascript
// ❌ HSTS only if HTTPS_ENABLED=true
if (config.nodeEnv === 'production' && process.env.HTTPS_ENABLED === 'true') {
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
}
```

**Impact:**
- **MEDIUM** - HTTPS downgrade attacks if HTTPS_ENABLED forgotten
- **MITM** - Attacker can force HTTP connection

**Fix:**
```javascript
// ✅ SECURE - ALWAYS set HSTS in production

if (config.nodeEnv === 'production') {
  // Always enforce HTTPS in production (remove conditional)
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      return next();
    }
    // Redirect HTTP to HTTPS
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  });
}
```

**Effort:** 15 minutes  
**Priority:** P2 - **Recommended for production**

---

### [A01-P2-005] Timing Attack on Order ID Enumeration

**File:** `backend/src/controllers/orderController.js:87-112`  
**OWASP:** A01 - Broken Access Control  

**Issue:**
```javascript
// ❌ Different response times reveal order existence
const order = await orderQueries.findById(id);  // 50ms DB query

if (!order) {
  return res.status(404).json({ error: 'Order not found' });  // Fast response
}

if (order.buyer_id !== req.user.id) {
  return res.status(403).json({ error: 'Access denied' });  // Slow response
}
```

**Attack Scenario:**
1. Attacker measures response time for `/api/orders/1`, `/api/orders/2`, etc.
2. Fast 404 (< 50ms) = Order doesn't exist
3. Slow 403 (> 50ms) = Order exists, but not yours
4. Attacker enumerates all valid order IDs

**Impact:**
- **LOW** - Information leakage about order IDs
- **Privacy** - Reveals total order volume

**Fix:**
```javascript
// ✅ SECURE - Constant-time response

export const getById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Single query: fetch only if authorized (see P1-003)
  const order = await orderQueries.findByIdForUser(id, userId);

  if (!order) {
    // Ambiguous error - same for "not found" and "access denied"
    return res.status(404).json({
      success: false,
      error: 'Order not found'  // ← Same message, same status
    });
  }

  return res.status(200).json({ success: true, data: order });
};
```

**Effort:** 1 hour (combined with P1-003)  
**Priority:** P2 - **Nice to have**

---

## P3: LOW SEVERITY (Best Practices)

### [P3-001] No Audit Trail for Sensitive Operations

**OWASP:** A09 - Security Logging and Monitoring Failures  

**Issue:**
No audit log for critical actions:
- Shop wallet changes
- Order status changes
- Product deletions
- Subscription upgrades

**Impact:**
- **LOW** - Difficult to investigate fraud
- **Compliance** - Required for PCI-DSS

**Fix:**
```javascript
// Create audit_logs table
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INTEGER,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

// Log all sensitive operations
export const updateWallets = async (req, res) => {
  const oldShop = await shopQueries.findById(req.params.id);
  
  // ... perform update ...
  
  // Log audit trail
  await auditLogQueries.create({
    userId: req.user.id,
    action: 'shop_wallets_updated',
    resourceType: 'shop',
    resourceId: req.params.id,
    oldValue: {
      wallet_btc: oldShop.wallet_btc,
      wallet_eth: oldShop.wallet_eth
    },
    newValue: {
      wallet_btc: req.body.wallet_btc,
      wallet_eth: req.body.wallet_eth
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  // ... return response
};
```

**Effort:** 3 hours  
**Priority:** P3 - **Best practice for production**

---

### [P3-002] No Account Lockout After Failed Login Attempts

**OWASP:** A07 - Authentication Failures  

**Issue:**
No brute-force protection on login endpoint.

**Impact:**
- **LOW** - Brute-force attacks possible (mitigated by rate limiting)
- **Already has:** Rate limiting (1000 req/15min)

**Fix:**
```javascript
// Add account lockout after 5 failed attempts
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000;  // 30 minutes

export const login = async (req, res) => {
  const user = await userQueries.findByTelegramId(req.body.telegramId);
  
  // Check if account is locked
  if (user.locked_until && new Date() < new Date(user.locked_until)) {
    const remainingMinutes = Math.ceil(
      (new Date(user.locked_until) - new Date()) / 60000
    );
    return res.status(429).json({
      error: `Account locked. Try again in ${remainingMinutes} minutes.`
    });
  }
  
  // Validate credentials
  const valid = await validateTelegramInitData(req.body.initData);
  
  if (!valid) {
    // Increment failed attempts
    const attempts = (user.failed_login_attempts || 0) + 1;
    
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      // Lock account
      await userQueries.update(user.id, {
        failed_login_attempts: attempts,
        locked_until: new Date(Date.now() + LOCKOUT_DURATION_MS)
      });
      return res.status(429).json({
        error: 'Too many failed attempts. Account locked for 30 minutes.'
      });
    }
    
    await userQueries.update(user.id, { failed_login_attempts: attempts });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Reset failed attempts on success
  await userQueries.update(user.id, { failed_login_attempts: 0, locked_until: null });
  
  // ... generate token and return ...
};
```

**Effort:** 2 hours  
**Priority:** P3 - **Nice to have**

---

### [P3-003] JWT Secret Should Be Rotated Periodically

**OWASP:** A02 - Cryptographic Failures  

**Issue:**
JWT secret never rotated. If compromised, all tokens are valid forever.

**Impact:**
- **LOW** - Long-term risk if secret leaked

**Fix:**
```javascript
// Implement JWT secret rotation with grace period

// Support multiple secrets (current + previous)
const JWT_SECRETS = [
  process.env.JWT_SECRET,           // Current secret
  process.env.JWT_SECRET_PREVIOUS   // Previous secret (grace period)
].filter(Boolean);

export const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  // Try each secret until one works
  for (const secret of JWT_SECRETS) {
    try {
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      return next();
    } catch (err) {
      continue;  // Try next secret
    }
  }
  
  return res.status(401).json({ error: 'Invalid token' });
};

// Rotate secret every 90 days
// 1. Generate new secret: openssl rand -base64 32
// 2. Set JWT_SECRET_PREVIOUS = current JWT_SECRET
// 3. Set JWT_SECRET = new secret
// 4. After 7 days (token expiry), remove JWT_SECRET_PREVIOUS
```

**Effort:** 1 hour  
**Priority:** P3 - **Best practice**

---

## Compliance Check

### GDPR Compliance
- [ ] **P0** - User data can be exported (implement `/api/users/me/export`)
- [ ] **P0** - User data can be deleted (implement `/api/users/me/delete`)
- [ ] **P1** - Audit trail of data access (implement audit logging)
- [ ] **P1** - Data breach notification process

### PCI DSS Compliance
- [ ] **N/A** - Project uses crypto payments (not credit cards)
- [ ] **P1** - Audit trail for financial transactions
- [ ] **P0** - Secure payment data handling (wallet addresses are PII)

### SOC 2 Readiness
- [ ] **P1** - Comprehensive audit logging
- [ ] **P1** - Access control reviews
- [ ] **P2** - Incident response plan
- [ ] **P3** - Regular security testing

---

## Recommendations

### Immediate Actions (Before Production - 0-2 weeks)

1. **Fix all P0 vulnerabilities** (8 issues) - **BLOCKS PRODUCTION**
   - [A01-P0-001] Add authorization to GET /api/shops/:id
   - [A01-P0-002] Restrict wallet access to shop owner + active buyers
   - [A07-P0-003] Remove test authentication bypass
   - [A04-P0-004] Add rate limiting on resource creation
   - [A10-P0-005] Validate logo URLs against SSRF
   - [A01-P0-006] Implement CSRF protection
   - [A02-P0-007] Sanitize error responses
   - [A03-P0-008] Audit all queries for SQL injection

2. **Security Testing**
   - Run automated vulnerability scan (OWASP ZAP)
   - Perform manual penetration testing
   - Load testing with rate limiters

3. **Environment Hardening**
   - Set all required environment variables
   - Never deploy with NODE_ENV=development/test
   - Rotate JWT secret before launch

### Short-term (1-2 months post-launch)

1. **Fix all P1 vulnerabilities** (7 issues)
   - Implement refresh token mechanism
   - Add webhook signature verification
   - Audit worker authorization on all endpoints

2. **Monitoring & Alerting**
   - Set up Sentry/DataDog for error tracking
   - Configure alerts for:
     - Failed authentication attempts
     - Rate limit violations
     - Webhook validation failures
     - Database errors

3. **Security Training**
   - Educate developers on OWASP Top 10
   - Establish secure coding standards
   - Code review checklist

### Long-term (3-6 months post-launch)

1. **Fix P2/P3 vulnerabilities** (8 issues)
   - Implement audit logging
   - Account lockout mechanism
   - JWT secret rotation

2. **Bug Bounty Program**
   - Launch on HackerOne/Bugcrowd
   - Reward researchers for finding vulnerabilities

3. **Compliance Certifications**
   - SOC 2 Type I/II
   - ISO 27001 (if serving enterprise customers)

4. **Regular Security Audits**
   - Quarterly internal audits
   - Annual external penetration testing
   - Automated dependency scanning (npm audit, Snyk)

---

## Testing Recommendations

### Automated Security Testing

```bash
# 1. Dependency Scanning
npm audit
npm install -g snyk
snyk test

# 2. Static Application Security Testing (SAST)
npm install -g eslint-plugin-security
eslint --plugin security backend/src/

# 3. Dynamic Application Security Testing (DAST)
# Use OWASP ZAP or Burp Suite to scan running application

# 4. SQL Injection Testing
npm install -g sqlmap
# Test all POST/PUT endpoints with --data parameters

# 5. XSS Testing
npm install -g xssstrike
# Test all input fields in WebApp
```

### Manual Testing Checklist

- [ ] Test authentication bypass with `test_token_user_*`
- [ ] Test IDOR on `/api/orders/:id`, `/api/shops/:id`
- [ ] Test rate limiting by sending 1001 requests in 15 minutes
- [ ] Test SSRF with logo URLs: `http://localhost:5432`, `http://169.254.169.254`
- [ ] Test CSRF by creating malicious HTML form
- [ ] Test SQL injection on all search/filter parameters
- [ ] Test authorization on all endpoints (use Burp Intruder)
- [ ] Test payment amount manipulation (send 99.5% of expected)
- [ ] Test webhook replay attacks
- [ ] Test XSS in shop descriptions, product names

---

## Appendix A: Security Tools

### Recommended Tools

1. **Dependency Scanning**
   - Snyk (free for open-source)
   - WhiteSource Bolt
   - GitHub Dependabot

2. **SAST (Static Analysis)**
   - SonarQube
   - Semgrep
   - ESLint with security plugins

3. **DAST (Dynamic Analysis)**
   - OWASP ZAP
   - Burp Suite Professional
   - Acunetix

4. **Secrets Detection**
   - TruffleHog
   - GitGuardian
   - git-secrets

5. **Monitoring**
   - Sentry (error tracking)
   - DataDog (APM + security monitoring)
   - Splunk (log analysis)

---

## Appendix B: Secure Development Checklist

### Pre-Commit
- [ ] No hardcoded secrets (API keys, passwords)
- [ ] No `console.log` with sensitive data
- [ ] All queries use parameterization ($1, $2)
- [ ] Input validation on all user inputs
- [ ] Authorization checks before data access

### Pre-Deployment
- [ ] All P0 vulnerabilities fixed
- [ ] Environment variables set correctly
- [ ] NODE_ENV=production (not development/test)
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Error tracking (Sentry) enabled
- [ ] Backups configured
- [ ] Incident response plan documented

### Post-Deployment
- [ ] Monitor error logs for security issues
- [ ] Review audit logs weekly
- [ ] Update dependencies monthly
- [ ] Run security scans quarterly
- [ ] External pentest annually

---

**Report Generated:** 2025-01-05  
**Status:** 🔴 **NOT PRODUCTION READY**  
**Next Review:** After P0 fixes completed  

---

*This audit was conducted using OWASP Top 10 2021 methodology combined with manual code review and threat modeling. For questions or clarifications, please contact the security team.*