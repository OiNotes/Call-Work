# Health Check Skill

Perform a comprehensive health check of the entire Status Stock 4.0 stack.

## What this skill does:

1. Checks Backend API health endpoint
2. Checks WebApp server
3. Checks Bot process status
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

# Backend
echo "1. Backend (port 3000):"
if curl -s http://localhost:3000/health | grep -q "success"; then
  echo "   ✅ Healthy"
else
  echo "   ❌ Down or unhealthy"
fi

# WebApp
echo "2. WebApp (port 5173):"
if lsof -ti:5173 >/dev/null 2>&1; then
  echo "   ✅ Running"
else
  echo "   ❌ Not running"
fi

# Bot
echo "3. Telegram Bot:"
if ps aux | grep "node.*bot.js" | grep -v grep >/dev/null; then
  echo "   ✅ Running"
else
  echo "   ❌ Not running"
fi

# PostgreSQL
echo "4. PostgreSQL:"
if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "   ✅ Connected"
else
  echo "   ❌ Not connected"
fi

# Recent errors
echo "5. Recent errors:"
backend_errors=$(tail -50 "$PROJECT_DIR/backend/logs/error-$(date +%Y-%m-%d).log" 2>/dev/null | wc -l | tr -d ' ')
bot_errors=$(tail -50 "$PROJECT_DIR/bot/logs/error.log" 2>/dev/null | grep "error" | wc -l | tr -d ' ')

echo "   Backend: $backend_errors errors in last 50 lines"
echo "   Bot: $bot_errors errors in last 50 lines"

echo ""
echo "=== End of Report ==="
```

## Health criteria:

- ✅ **Green:** All services running, no recent errors
- ⚠️ **Yellow:** Services running but have recent errors
- ❌ **Red:** One or more services down

## Automatic actions:

If unhealthy, Claude will:
1. Show detailed error logs
2. Suggest fixes
3. Optionally restart services

## When to use:

- 🏥 Before starting work
- 🏥 After deployment
- 🏥 When suspecting issues
- 🏥 In CI/CD pipelines
- 🏥 Periodic monitoring
