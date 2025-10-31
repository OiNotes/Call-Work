# Restart All Skill

Safely restart Backend, WebApp, and Bot with graceful shutdown.

## What this skill does:

1. Gracefully stops all running services
2. Waits for clean shutdown
3. Clears port locks
4. Restarts all services
5. Monitors startup logs

## Usage:

Say: **"restart all"** or **"restart everything"** or **"reboot"** or **"restart services"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "🔄 Stopping services gracefully..."

# Backend (port 3000)
if lsof -ti:3000 >/dev/null 2>&1; then
  echo "  ⏹️ Stopping Backend..."
  lsof -ti:3000 | xargs kill -15
fi

# WebApp (port 5173)
if lsof -ti:5173 >/dev/null 2>&1; then
  echo "  ⏹️ Stopping WebApp..."
  lsof -ti:5173 | xargs kill -15
fi

# Bot
if ps aux | grep "node.*bot.js" | grep -v grep >/dev/null; then
  echo "  ⏹️ Stopping Bot..."
  pkill -f "node.*bot.js"
fi

# Wait for clean shutdown
echo "⏳ Waiting for clean shutdown..."
sleep 3

# Verify all stopped
echo "✓ Verifying shutdown..."
lsof -ti:3000 && echo "⚠️ Backend still running" || echo "✅ Backend stopped"
lsof -ti:5173 && echo "⚠️ WebApp still running" || echo "✅ WebApp stopped"

# Restart
echo "🚀 Starting all services..."
cd "$PROJECT_DIR"
npm run dev:all
```

## Safety features:

- ✅ Graceful shutdown (SIGTERM, not SIGKILL)
- ✅ 3 second wait for cleanup
- ✅ Verification before restart
- ✅ Monitors startup logs

## When to use:

- 🔄 After code changes
- 🔄 When services are unresponsive
- 🔄 After config changes (.env)
- 🔄 When logs show weird behavior
- 🔄 Periodic restart for stability
