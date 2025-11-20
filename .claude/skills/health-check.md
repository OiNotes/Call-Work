---
name: health-check
description: Check Backend API health, Bot process, ngrok tunnel status, PostgreSQL connection, recent errors. Use before starting work, after deployment, or when suspecting issues.
---

# Health Check Skill

Perform a comprehensive health check of the entire Status Stock 4.0 stack.

## What this skill does:

1. Checks Backend API health endpoint
2. Checks Bot process status
3. Checks ngrok tunnel and public URL
4. Checks PostgreSQL connection
5. Checks port availability
6. Scans recent error logs
7. Generates health report

## Usage:

Say: **"health check"** or **"check everything"** or **"status"** or **"are we healthy"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "=== Health Check Report ==="
echo ""

# 1. Backend
echo "1. Backend (port 3000):"
if lsof -ti:3000 >/dev/null 2>&1; then
  if curl -s http://localhost:3000/health | grep -q "success"; then
    echo "   ✅ Healthy"
  else
    echo "   ⚠️  Running but health check failed"
  fi
else
  echo "   ❌ Not running"
fi

# 2. Telegram Bot
echo "2. Telegram Bot:"
if ps aux | grep "node.*bot.js" | grep -v grep >/dev/null; then
  echo "   ✅ Running"
else
  echo "   ❌ Not running"
fi

# 3. ngrok Tunnel
echo "3. ngrok Tunnel:"
if pgrep -x ngrok >/dev/null 2>&1; then
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$NGROK_URL" ]; then
    echo "   ✅ Active: $NGROK_URL"
  else
    echo "   ⚠️  Running but no tunnel URL found"
  fi
else
  echo "   ❌ Not running (CRITICAL - Mini App won't work!)"
fi

# 4. PostgreSQL
echo "4. PostgreSQL:"
if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "   ✅ Connected"
  # Test actual connection
  if psql -d telegram_shop -c "SELECT 1" >/dev/null 2>&1; then
    echo "   ✅ Database 'telegram_shop' accessible"
  else
    echo "   ⚠️  Connected but database not accessible"
  fi
else
  echo "   ❌ Not connected"
fi

# 5. Recent errors
echo "5. Recent errors (last 50 lines):"

# Backend errors (daily log with date)
backend_log="$PROJECT_DIR/backend/logs/error-$(date +%Y-%m-%d).log"
if [ -f "$backend_log" ]; then
  backend_errors=$(tail -50 "$backend_log" 2>/dev/null | grep -i error | wc -l | tr -d ' ')
  echo "   Backend: $backend_errors errors"
  if [ "$backend_errors" -gt 10 ]; then
    echo "     ⚠️  High error count!"
  fi
else
  echo "   Backend: No log file for today"
fi

# Bot errors (single error.log file)
bot_log="$PROJECT_DIR/bot/logs/error.log"
if [ -f "$bot_log" ]; then
  bot_errors=$(tail -50 "$bot_log" 2>/dev/null | grep -i error | wc -l | tr -d ' ')
  echo "   Bot: $bot_errors errors"
  if [ "$bot_errors" -gt 10 ]; then
    echo "     ⚠️  High error count!"
  fi
else
  echo "   Bot: No error log found"
fi

# 6. Port check
echo "6. Port availability:"
for port in 3000 5173 5432 4040; do
  if lsof -ti:$port >/dev/null 2>&1; then
    process=$(lsof -ti:$port | xargs ps -p | tail -1 | awk '{print $5}')
    echo "   Port $port: In use ($process)"
  else
    echo "   Port $port: Free"
  fi
done

echo ""
echo "=== End of Report ==="
```

## Health criteria:

- ✅ **Green:** All services running, ngrok active, no recent errors
- ⚠️ **Yellow:** Services running but have recent errors or ngrok inactive
- ❌ **Red:** One or more critical services down (Backend, Bot, PostgreSQL)

## Critical checks:

1. **ngrok MUST be running** - Without it, Telegram Mini App won't work
2. **Backend MUST respond to /health** - API must be functional
3. **PostgreSQL MUST be connected** - Database operations will fail otherwise
4. **Bot MUST be running** - Users can't interact with the shop

## Automatic actions:

If unhealthy, Claude will:

1. Show detailed error logs from appropriate log files
2. Identify missing services (ngrok, PostgreSQL, Backend, Bot)
3. Suggest specific fixes
4. Optionally restart services using ./stop.sh and ./start.sh

## When to use:

- 🏥 Before starting work (morning check)
- 🏥 After deployment or restart
- 🏥 When suspecting issues
- 🏥 Periodic monitoring (every 30 mins if working)
- 🏥 Before testing new features
- 🏥 After system wake from sleep (ngrok might expire)

## Quick fix commands:

If ngrok is down:

```bash
./stop.sh && ./start.sh  # Fresh restart with new ngrok
```

If PostgreSQL is down:

```bash
brew services start postgresql@14
```

If Backend/Bot down but ngrok OK:

```bash
cd backend && npm run dev  # Backend only
cd bot && npm start        # Bot only
```
