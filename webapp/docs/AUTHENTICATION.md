# Frontend Authentication Guide

## Telegram WebApp Authentication

### Quick Start

```javascript
// In your App.js or main component

import { useEffect, useState } from 'react';

function App() {
  const [authToken, setAuthToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    authenticateUser();
  }, []);

  async function authenticateUser() {
    try {
      // 1. Get initData from Telegram SDK
      const initData = window.Telegram.WebApp.initData;

      if (!initData) {
        console.error('No Telegram initData - not running in WebApp?');
        return;
      }

      // 2. Send to backend for validation
      const response = await fetch('http://localhost:3000/api/auth/telegram-validate', {
        method: 'POST',
        headers: {
          'x-telegram-init-data': initData,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`);
      }

      const data = await response.json();

      // 3. Save token and user
      setAuthToken(data.token);
      setUser(data.user);
      localStorage.setItem('auth_token', data.token);

      console.log('✅ Authenticated:', data.user);

    } catch (error) {
      console.error('❌ Authentication error:', error);
      window.Telegram.WebApp.showAlert('Authentication failed');
    }
  }

  return user ? (
    <div>Welcome, {user.first_name}!</div>
  ) : (
    <div>Loading...</div>
  );
}
```

---

## API Endpoint

**URL:** `POST /api/auth/telegram-validate`

**Headers:**
- `x-telegram-init-data` - From `Telegram.WebApp.initData`
- `Content-Type: application/json`

**Response (Success):**
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
    "selected_role": "buyer",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Unauthorized: Invalid Telegram signature"
}
```

---

## Using JWT Token

After authentication, include token in all API requests:

```javascript
async function fetchUserData() {
  const token = localStorage.getItem('auth_token');

  const response = await fetch('http://localhost:3000/api/auth/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  return data;
}
```

---

## React Hook Example

Create custom hook for authentication:

```javascript
// hooks/useAuth.js

import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    authenticate();
  }, []);

  async function authenticate() {
    try {
      setLoading(true);

      const initData = window.Telegram.WebApp.initData;
      if (!initData) {
        throw new Error('No Telegram initData available');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/telegram-validate`, {
        method: 'POST',
        headers: {
          'x-telegram-init-data': initData,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const data = await response.json();

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('auth_token', data.token);

    } catch (err) {
      setError(err.message);
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  }

  return { user, token, loading, error, logout };
}
```

**Usage:**

```javascript
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, token, loading, error } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Welcome, {user.first_name}!</h1>
      <p>@{user.username}</p>
    </div>
  );
}
```

---

## Environment Variables

Create `.env` file in webapp root:

```bash
# webapp/.env
VITE_API_URL=http://localhost:3000
```

For production:

```bash
# webapp/.env.production
VITE_API_URL=https://your-production-api.com
```

---

## Zustand Store Integration

If using Zustand for state management:

```javascript
// stores/authStore.js

import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: (token, user) => set({
    token,
    user,
    isAuthenticated: true
  }),

  clearAuth: () => set({
    token: null,
    user: null,
    isAuthenticated: false
  }),

  authenticate: async () => {
    try {
      const initData = window.Telegram.WebApp.initData;
      if (!initData) throw new Error('No initData');

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/telegram-validate`, {
        method: 'POST',
        headers: {
          'x-telegram-init-data': initData,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Auth failed');

      const data = await response.json();

      set({
        token: data.token,
        user: data.user,
        isAuthenticated: true
      });

      localStorage.setItem('auth_token', data.token);

      return data;

    } catch (error) {
      console.error('Auth error:', error);
      throw error;
    }
  }
}));
```

**Usage:**

```javascript
import { useAuthStore } from './stores/authStore';

function App() {
  const { user, isAuthenticated, authenticate } = useAuthStore();

  useEffect(() => {
    authenticate().catch(console.error);
  }, []);

  return isAuthenticated ? (
    <div>Welcome, {user.first_name}!</div>
  ) : (
    <div>Loading...</div>
  );
}
```

---

## Security Notes

### DO ✅

1. **Always use HTTPS** in production
2. **Send initData in header** (not body)
3. **Store JWT token securely** (localStorage or sessionStorage)
4. **Never expose bot token** in frontend

### DON'T ❌

1. **Never validate initData on frontend** (server-side only!)
2. **Never hardcode API URLs** (use env variables)
3. **Never expose sensitive data** in console logs (production)

---

## Testing

### Development Mode

If Telegram WebApp SDK is not available (local testing):

```javascript
// Mock Telegram SDK for development
if (!window.Telegram?.WebApp) {
  window.Telegram = {
    WebApp: {
      initData: 'mock-init-data-for-dev',
      ready: () => console.log('Telegram WebApp ready (mock)'),
      expand: () => console.log('Telegram WebApp expanded (mock)')
    }
  };
}
```

**Note:** Backend will reject mock initData. Use `/api/auth/register` endpoint for local testing instead.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `No Telegram initData` | Check if app is opened inside Telegram WebApp |
| `401 Unauthorized` | Check `TELEGRAM_BOT_TOKEN` in backend `.env` |
| `CORS error` | Check `FRONTEND_URL` in backend `.env` |
| `Token expired` | Implement token refresh or re-authenticate |

---

## API Requests Helper

Create reusable API helper:

```javascript
// utils/api.js

const API_URL = import.meta.env.VITE_API_URL;

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Usage examples:

// GET request
const profile = await apiRequest('/api/auth/profile');

// POST request
const shop = await apiRequest('/api/shops', {
  method: 'POST',
  body: JSON.stringify({ name: 'My Shop' })
});
```

---

## References

- [Telegram WebApp SDK](https://core.telegram.org/bots/webapps)
- [Backend Auth Documentation](../../backend/docs/TELEGRAM_AUTH.md)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
