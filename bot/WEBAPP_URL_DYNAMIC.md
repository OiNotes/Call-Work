# Dynamic WEBAPP_URL Implementation

## Overview

The Telegram bot now dynamically reads `WEBAPP_URL` from environment variables instead of using a static config value. This allows the bot to automatically adapt to changing ngrok URLs during development.

## Changes Made

### 1. New Utility: `src/utils/webappUrl.js`

**Functions:**
- `getWebAppUrl()` - Returns validated WEBAPP_URL from environment
- `logWebAppConfig()` - Logs WebApp URL configuration at startup

**Validation:**
- Checks if WEBAPP_URL is set
- Validates URL format
- Enforces HTTPS requirement (Telegram WebApp requirement)

### 2. Updated Keyboards

All keyboard files now use `getWebAppUrl()` instead of `config.webAppUrl`:

- `src/keyboards/seller.js` - Seller menu
- `src/keyboards/buyer.js` - Buyer menu (2 variants)
- `src/keyboards/workspace.js` - Workspace menu

### 3. Updated Bot Startup

`src/bot.js` now calls `logWebAppConfig()` during startup to:
- Log the current WebApp URL
- Remind developer to update BotFather menu button if URL changed

### 4. Removed from Config

`src/config/index.js` - Removed `webAppUrl` property (no longer needed)

### 5. Updated .env.example

Added detailed comments explaining:
- HTTPS requirement
- ngrok auto-update by dev-scripts
- Production URL example

## Usage

### Development (ngrok)

When ngrok URL changes:

1. Update `.env` file:
   ```bash
   WEBAPP_URL=https://new-ngrok-url.ngrok-free.app
   ```

2. Restart bot - it will automatically pick up the new URL

3. Update BotFather menu button:
   ```
   /setmenubutton
   ```

### Production

Set permanent URL in `.env`:
```bash
WEBAPP_URL=https://statusstock.app
```

## Error Handling

The bot will fail to start if:
- `WEBAPP_URL` is not set
- `WEBAPP_URL` has invalid format
- `WEBAPP_URL` does not use HTTPS

Error messages are clear and actionable.

## Logging

At bot startup, you'll see:
```
[info]: WebApp URL configured { url: 'https://...' }
[info]: BotFather Menu Button should be set to: { url: 'https://...' }
[info]: If URL changed, update in BotFather: /setmenubutton
```

## Tests

### Unit Tests
`tests/unit/webappUrl.test.js` - Tests utility functions

### Integration Tests
`tests/integration/webappUrl.integration.test.js` - Tests keyboard integration

Run tests:
```bash
npm test -- webappUrl
```

## Files Changed

1. **Created:**
   - `src/utils/webappUrl.js`
   - `tests/unit/webappUrl.test.js`
   - `tests/integration/webappUrl.integration.test.js`

2. **Modified:**
   - `src/bot.js`
   - `src/config/index.js`
   - `src/keyboards/seller.js`
   - `src/keyboards/buyer.js`
   - `src/keyboards/workspace.js`
   - `.env.example`

## Benefits

1. No bot restart needed when ngrok URL changes
2. Clear error messages if URL is misconfigured
3. Automatic validation of URL format and HTTPS
4. Helpful logging to remind about BotFather updates
5. Full test coverage
