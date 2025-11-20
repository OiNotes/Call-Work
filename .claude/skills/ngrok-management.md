---
name: ngrok-management
description: Manage ngrok tunnel - check status, get URL, restart tunnel, update .env files. Use when ngrok expires or after system sleep.
---

# ngrok Management Skill

Manage ngrok tunnel for Telegram Mini App connectivity.

## What this skill does:

1. Checks ngrok status and public URL
2. Restarts expired tunnels
3. Updates .env files with new ngrok URL
4. Rebuilds webapp with new URL
5. Verifies tunnel is working

## Usage:

Say: **"check ngrok"** or **"restart ngrok"** or **"ngrok status"** or **"ngrok url"**

## Commands:

### Check ngrok status:

```bash
echo "=== ngrok Status ==="
echo ""

# Check if ngrok is running
if pgrep -x ngrok >/dev/null 2>&1; then
  echo "✅ ngrok process is running"

  # Get public URL
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -n "$NGROK_URL" ]; then
    echo "✅ Public URL: $NGROK_URL"

    # Check if URL is working (responds to requests)
    if curl -s --head --request GET "$NGROK_URL" | grep "HTTP" >/dev/null; then
      echo "✅ Tunnel is responding to requests"
    else
      echo "⚠️  Tunnel URL not responding"
    fi

    # Show ngrok dashboard
    echo ""
    echo "ngrok Dashboard: http://localhost:4040"

  else
    echo "❌ ngrok running but no tunnel URL found"
    echo "   This usually means ngrok failed to start properly"
    echo "   Solution: Restart with ./stop.sh && ./start.sh"
  fi
else
  echo "❌ ngrok is not running"
  echo ""
  echo "CRITICAL: Mini App won't work without ngrok!"
  echo "Solution: Start everything with ./start.sh"
fi

echo ""
echo "=== End of Status ==="
```

### Restart ngrok tunnel:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "🔄 Restarting ngrok tunnel..."
echo ""

# Stop everything (includes ngrok)
cd "$PROJECT_DIR"
./stop.sh

sleep 2

# Start everything with fresh ngrok tunnel
./start.sh

# Wait for ngrok to initialize
sleep 5

# Verify new tunnel
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$NGROK_URL" ]; then
  echo ""
  echo "✅ New ngrok URL: $NGROK_URL"
  echo "✅ All .env files updated"
  echo "✅ Webapp rebuilt with new URL"
else
  echo ""
  echo "❌ Failed to get ngrok URL"
  echo "Check: http://localhost:4040"
  exit 1
fi
```

### Get current ngrok URL:

```bash
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$NGROK_URL" ]; then
  echo "Current ngrok URL: $NGROK_URL"

  # Also show where it's configured
  echo ""
  echo "Configured in:"
  echo "  - backend/.env (WEBAPP_URL, FRONTEND_URL)"
  echo "  - bot/.env (WEBAPP_URL)"
  echo "  - webapp/.env (VITE_API_URL)"
else
  echo "❌ No ngrok URL found. ngrok may not be running."
fi
```

## Why ngrok is critical:

This project uses **Telegram Mini App** which requires HTTPS URL to work. ngrok provides:

- ✅ **HTTPS tunnel** to local backend (localhost:3000)
- ✅ **Public URL** that Telegram can access
- ✅ **WebApp serving** so users can open Mini App in Telegram

**Without ngrok:** Mini App button won't work, users can't access the shop interface.

## Common ngrok issues:

### Issue 1: Tunnel expired

```
Symptom: Mini App not loading, "ERR_CONNECTION_REFUSED"
Cause: ngrok free plan has 2-hour session limit
Solution: Restart tunnel with "restart ngrok" or ./start.sh
```

### Issue 2: After system sleep/reboot

```
Symptom: Backend running but Mini App not accessible
Cause: ngrok tunnel dies when system sleeps
Solution: Restart tunnel with ./start.sh
```

### Issue 3: Wrong URL in .env

```
Symptom: API calls fail with 404, CORS errors
Cause: .env files have old ngrok URL
Solution: Restart tunnel (start.sh updates all .env files)
```

### Issue 4: ngrok not installed

```
Symptom: start.sh fails with "ngrok: command not found"
Solution: brew install ngrok (macOS) or download from ngrok.com
```

## ngrok tunnel details:

When ngrok is running:

- **Local:** http://localhost:3000 → Backend API
- **Public:** https://abc123.ngrok.io → Same Backend (public access)
- **Dashboard:** http://localhost:4040 → Request inspector

The public URL changes every time you restart ngrok (free plan).

## Files updated by start.sh:

When you restart tunnel, start.sh updates:

1. **backend/.env**

   ```
   WEBAPP_URL=https://new-url.ngrok.io
   FRONTEND_URL=https://new-url.ngrok.io
   ```

2. **bot/.env**

   ```
   WEBAPP_URL=https://new-url.ngrok.io
   ```

3. **webapp/.env**

   ```
   VITE_API_URL=https://new-url.ngrok.io/api
   ```

4. **Rebuilds webapp** with new API URL baked in

## When to use:

- 🌐 After system sleep/wake
- 🌐 Every 2 hours (ngrok free tier expires)
- 🌐 When Mini App not loading
- 🌐 After "connection refused" errors
- 🌐 When testing from real Telegram app
- 🌐 Before sharing bot with testers

## Pro tips:

- ngrok free tier: 2-hour sessions, need to restart
- ngrok paid tier: persistent URLs (no restarts needed)
- Keep ngrok dashboard open: http://localhost:4040 (shows all requests)
- Use health-check skill to verify ngrok is up
- Always restart with ./start.sh (handles all .env updates)
