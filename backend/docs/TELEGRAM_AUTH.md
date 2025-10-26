# Telegram WebApp Authentication

## Overview

**SECURE** Telegram WebApp initData validation with HMAC-SHA256 signature verification and timing-safe comparison.

This document describes the `/api/auth/telegram-validate` endpoint for authenticating Telegram Mini App users.

---

## Security Implementation

### HMAC-SHA256 Signature Verification

Algorithm according to [Telegram WebApps Documentation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):

1. Parse `initData` query string
2. Extract `hash` parameter
3. Create `data-check-string` from remaining params (sorted alphabetically)
4. Compute `secret_key = HMAC-SHA256("WebAppData", bot_token)`
5. Calculate `hash = HMAC-SHA256(data_check_string, secret_key)`
6. Compare computed hash with provided hash using **timing-safe comparison**

### Critical Security Features

- **Timing-safe comparison** (`crypto.timingSafeEqual()`) - prevents timing attacks
- **24-hour expiration** - prevents replay attacks
- **Tamper detection** - any modification to user data invalidates signature
- **Bot token verification** - ensures initData signed by your bot

---

## API Endpoint

### POST `/api/auth/telegram-validate`

Validates Telegram WebApp initData and returns JWT token.

**Headers:**
```http
x-telegram-init-data: <initData from Telegram.WebApp.initData>
Content-Type: application/json
```

**Request:**
```http
POST /api/auth/telegram-validate
x-telegram-init-data: user=%7B%22id%22%3A123456789...&auth_date=1234567890&hash=abc123...
```

**Response (201 Created - New User):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "telegram_id": 123456789,
    "username": "testuser",
    "first_name": "Test",
    "last_name": "User",
    "selected_role": null,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response (200 OK - Existing User):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "telegram_id": 123456789,
    "username": "testuser",
    "first_name": "Test",
    "last_name": "User",
    "selected_role": "seller",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Unauthorized: No Telegram data` | Missing `x-telegram-init-data` header |
| 401 | `Unauthorized: Invalid Telegram data` | Missing hash parameter |
| 401 | `Unauthorized: Invalid Telegram signature` | Tampered signature |
| 401 | `Unauthorized: Telegram data expired` | initData older than 24 hours |
| 500 | `Internal server error` | Server error |

---

## Frontend Integration

### React / Telegram Mini App

```javascript
import { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Initialize Telegram WebApp
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // Authenticate user
    authenticateUser();
  }, []);

  async function authenticateUser() {
    try {
      // Get initData from Telegram SDK
      const initData = window.Telegram.WebApp.initData;

      if (!initData) {
        console.error('No initData available');
        return;
      }

      // Send to backend for validation
      const response = await fetch('https://your-api.com/api/auth/telegram-validate', {
        method: 'POST',
        headers: {
          'x-telegram-init-data': initData,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();

      // Save token and user
      setToken(data.token);
      setUser(data.user);

      // Store token for future requests
      localStorage.setItem('jwt_token', data.token);

    } catch (error) {
      console.error('Auth error:', error);
      window.Telegram.WebApp.showAlert('Authentication failed');
    }
  }

  // Use token in API requests
  async function makeAuthenticatedRequest(url, options = {}) {
    const token = localStorage.getItem('jwt_token');

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  return (
    <div>
      {user ? (
        <div>
          <h1>Welcome, {user.first_name}!</h1>
          <p>@{user.username}</p>
        </div>
      ) : (
        <p>Authenticating...</p>
      )}
    </div>
  );
}

export default App;
```

---

## Backend Middleware

### File: `backend/src/middleware/telegramAuth.js`

Middleware validates initData and populates `req.telegramUser`.

**Usage in routes:**

```javascript
import { verifyTelegramInitData } from '../middleware/telegramAuth.js';

router.post('/protected-endpoint', verifyTelegramInitData, (req, res) => {
  // req.telegramUser is available
  const { id, username, first_name } = req.telegramUser;

  res.json({
    message: `Hello, ${first_name}!`,
    userId: id
  });
});
```

**Optional validation (skip in development):**

```javascript
import { optionalTelegramAuth } from '../middleware/telegramAuth.js';

router.post('/debug-endpoint', optionalTelegramAuth, (req, res) => {
  // Validates if header present, skips if missing in dev/test
  res.json({ telegramUser: req.telegramUser || null });
});
```

---

## Testing

### Unit Tests

Run security tests:

```bash
cd backend
npm run test:auth  # or npm test
```

**Test coverage:**
- ✅ Valid signature verification
- ✅ Tampered hash rejection
- ✅ Tampered user data rejection
- ✅ Expired initData rejection (24h+)
- ✅ Missing hash parameter rejection
- ✅ Timing-safe comparison validation
- ✅ Edge cases (Cyrillic names, special chars, etc.)

### Integration Tests

Run integration tests:

```bash
cd backend
npm test __tests__/integration/telegramAuth.integration.test.js
```

**Test coverage:**
- ✅ New user creation (201)
- ✅ Existing user login (200)
- ✅ User info update
- ✅ Invalid signature rejection (401)
- ✅ Missing header rejection (401)
- ✅ Expired initData rejection (401)

---

## Security Best Practices

### DO ✅

1. **Always send initData in header** (`x-telegram-init-data`)
2. **Never expose bot token** in frontend code
3. **Use HTTPS** for all API requests
4. **Validate on server-side** - never trust client
5. **Check expiration** (24 hours max)
6. **Use timing-safe comparison** for hash validation

### DON'T ❌

1. **Never send bot token to frontend**
2. **Never skip signature validation** in production
3. **Never use `===` for hash comparison** (timing attack vulnerable)
4. **Never accept expired initData** (replay attack vulnerable)
5. **Never trust `telegramId` from request body** without validation

---

## Debugging

### Check if initData is valid

```javascript
// Frontend debug
console.log('initData:', window.Telegram.WebApp.initData);

// Should look like:
// user=%7B%22id%22%3A123456789...&auth_date=1234567890&hash=abc123...
```

### Test with curl

```bash
# Get initData from WebApp console
INIT_DATA="user=%7B%22id%22%3A123456789%7D&auth_date=1234567890&hash=abc123..."

curl -X POST https://your-api.com/api/auth/telegram-validate \
  -H "x-telegram-init-data: $INIT_DATA" \
  -H "Content-Type: application/json"
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `Unauthorized: No Telegram data` | Check header name: `x-telegram-init-data` |
| `Invalid signature` | Check `TELEGRAM_BOT_TOKEN` in `.env` matches bot |
| `Telegram data expired` | Refresh WebApp to get new initData |
| `Missing hash parameter` | Check initData format from Telegram SDK |

---

## Environment Variables

```bash
# backend/.env
TELEGRAM_BOT_TOKEN=your-bot-token-here
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d
```

---

## References

- [Telegram WebApps Documentation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [Node.js crypto.timingSafeEqual()](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
- [OWASP Timing Attack Prevention](https://owasp.org/www-community/attacks/Timing_attack)

---

## Changelog

### v1.0.0 (2024-01-15)
- ✅ Initial implementation
- ✅ HMAC-SHA256 signature verification
- ✅ Timing-safe comparison (`crypto.timingSafeEqual()`)
- ✅ 24-hour expiration check
- ✅ Auto user creation/update
- ✅ Unit tests (10 tests)
- ✅ Integration tests (8 tests)
