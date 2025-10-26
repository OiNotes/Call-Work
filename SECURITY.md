# Security Policy

## Telegram WebApp Authentication Security

### CRITICAL: HMAC-SHA256 Signature Verification

Status Stock implements **cryptographically secure** Telegram WebApp authentication with the following protections:

#### ✅ Implemented Security Measures

1. **HMAC-SHA256 Signature Verification**
   - Algorithm: [Telegram WebApps Validation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
   - Server-side validation only
   - Tamper detection for any user data modification

2. **Timing-Safe Comparison** (Critical!)
   - Uses `crypto.timingSafeEqual()` instead of `===`
   - Prevents timing attacks on signature verification
   - File: `backend/src/middleware/telegramAuth.js:68-74`
   - File: `backend/src/services/telegram.js:44-52`

3. **Expiration Check**
   - Max age: 24 hours
   - Prevents replay attacks
   - Rejects expired initData automatically

4. **Secure Token Storage**
   - JWT tokens with configurable expiration (default: 7 days)
   - `JWT_SECRET` must be strong random string
   - Never exposed to client

---

## Vulnerability Prevention

### ❌ What We Prevent

| Threat | Prevention Method |
|--------|-------------------|
| **User Impersonation** | HMAC-SHA256 signature verification |
| **Timing Attacks** | `crypto.timingSafeEqual()` comparison |
| **Replay Attacks** | 24-hour expiration check |
| **Tampered Data** | Hash invalidation on any modification |
| **Bot Token Exposure** | Server-side validation only |
| **CSRF** | Telegram initData binding to user |

---

## Security Testing

### Unit Tests (18 tests)

```bash
cd backend
npm test __tests__/unit/telegramAuth.test.js
```

**Coverage:**
- ✅ Valid signature verification
- ✅ Tampered hash rejection
- ✅ Tampered user ID rejection
- ✅ Expired initData rejection
- ✅ Missing parameters rejection
- ✅ Timing-safe comparison validation
- ✅ Edge cases (Cyrillic, special chars)

### Integration Tests (8 tests)

```bash
cd backend
npm test __tests__/integration/telegramAuth.integration.test.js
```

**Coverage:**
- ✅ New user creation (201)
- ✅ Existing user login (200)
- ✅ User info update
- ✅ Invalid signature rejection (401)
- ✅ Expired initData rejection (401)

---

## Configuration Requirements

### Backend Environment Variables

```bash
# CRITICAL: Never expose these secrets
JWT_SECRET=<strong-random-string-min-32-chars>
TELEGRAM_BOT_TOKEN=<your-bot-token>

# Optional: Increase security
JWT_EXPIRES_IN=7d  # Can be reduced for higher security
```

**Security checklist:**
- [ ] `JWT_SECRET` is at least 32 characters
- [ ] `JWT_SECRET` is randomly generated
- [ ] `TELEGRAM_BOT_TOKEN` is never in frontend code
- [ ] `.env` is in `.gitignore`
- [ ] HTTPS is enabled in production

---

## Best Practices

### DO ✅

1. **Always validate on server-side**
   ```javascript
   // ✅ Correct
   router.post('/api/endpoint', verifyTelegramInitData, handler);
   ```

2. **Use timing-safe comparison**
   ```javascript
   // ✅ Correct (already implemented)
   crypto.timingSafeEqual(hashBuffer, calculatedHashBuffer);

   // ❌ Wrong (timing attack vulnerable)
   if (hash === calculatedHash) { ... }
   ```

3. **Check expiration**
   ```javascript
   // ✅ Correct (already implemented)
   const maxAge = 24 * 60 * 60; // 24 hours
   if (currentTime - authDate > maxAge) throw new Error('Expired');
   ```

4. **Send initData in header**
   ```javascript
   // ✅ Correct
   headers: { 'x-telegram-init-data': initData }

   // ❌ Wrong
   body: { initData }
   ```

### DON'T ❌

1. **Never trust client-side validation**
   ```javascript
   // ❌ VULNERABLE
   const { telegramId } = req.body; // Can be forged!

   // ✅ Secure
   const telegramId = req.telegramUser.id; // Validated by middleware
   ```

2. **Never use === for hash comparison**
   ```javascript
   // ❌ VULNERABLE to timing attacks
   if (hash === calculatedHash) { ... }

   // ✅ Secure
   crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(calculatedHash));
   ```

3. **Never expose bot token**
   ```javascript
   // ❌ CRITICAL VULNERABILITY
   const botToken = '123456:ABC-DEF...'; // Hardcoded

   // ✅ Secure
   const botToken = process.env.TELEGRAM_BOT_TOKEN;
   ```

---

## Reporting Security Vulnerabilities

### Private Disclosure

If you discover a security vulnerability, please report it privately:

1. **DO NOT** open a public GitHub issue
2. Email: [your-security-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

### Response Timeline

- **24 hours** - Initial acknowledgment
- **7 days** - Vulnerability assessment
- **30 days** - Fix deployment (if confirmed)

---

## Security Audit Log

### v1.0.0 (2024-01-15)

**Changes:**
- ✅ Fixed timing attack vulnerability in hash comparison
  - Before: `if (calculatedHash !== hash)`
  - After: `crypto.timingSafeEqual(hashBuffer, calculatedHashBuffer)`
  - Files: `telegramAuth.js:68-74`, `telegram.js:44-52`

- ✅ Added 18 unit tests for security validation
- ✅ Added 8 integration tests for endpoint security
- ✅ Documented security best practices

**Tested attack vectors:**
- [x] Timing attacks on hash comparison - MITIGATED
- [x] Replay attacks with expired initData - MITIGATED
- [x] User impersonation via tampered data - MITIGATED
- [x] Bot token exposure - MITIGATED
- [x] CSRF attacks - MITIGATED

---

## Security Headers

Backend automatically applies security headers via Helmet.js:

```javascript
// backend/src/server.js
app.use(helmet());
```

**Headers applied:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HTTPS only)

---

## Rate Limiting

Authentication endpoints are protected by rate limiting:

```javascript
// backend/src/middleware/rateLimiter.js
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});
```

---

## Compliance

- ✅ **OWASP Top 10** - Mitigated common vulnerabilities
- ✅ **CWE-208** - Timing attack prevention
- ✅ **CWE-294** - Replay attack prevention
- ✅ **CWE-347** - Proper signature verification

---

## References

- [Telegram WebApps Security](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [OWASP Timing Attack Prevention](https://owasp.org/www-community/attacks/Timing_attack)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
- [CWE-208: Observable Timing Discrepancy](https://cwe.mitre.org/data/definitions/208.html)

---

**Last Updated:** 2024-01-15
**Security Version:** 1.0.0
