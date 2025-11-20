---
name: restart-all
description: Safely restart Backend, Bot, WebApp, ngrok using stop.sh and start.sh scripts. Use after code changes or when services hang.
---

# Restart All Skill

Safely restart all services using the professional stop.sh and start.sh scripts.

## What this skill does:

1. Uses `./stop.sh` to gracefully stop all services
2. Waits 3 seconds for clean shutdown
3. Verifies all processes stopped
4. Uses `./start.sh` to restart everything with fresh ngrok tunnel

## Usage:

Say: **"restart all"** or **"restart everything"** or **"reboot"** or **"restart services"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "🔄 Restarting all services..."

# Stop all services
cd "$PROJECT_DIR"
./stop.sh

# Wait for clean shutdown
echo "⏳ Waiting 3 seconds for clean shutdown..."
sleep 3

# Verify ports are free
echo "✓ Checking ports..."
if lsof -ti:3000 >/dev/null 2>&1; then
  echo "⚠️  Warning: Port 3000 still occupied. Force killing..."
  lsof -ti:3000 | xargs kill -9
fi

# Restart everything
echo "🚀 Restarting with fresh ngrok tunnel..."
./start.sh
```

## What stop.sh does:

- Stops Backend (port 3000)
- Stops Bot processes
- Stops Webapp dev server
- Stops ngrok tunnel
- Uses SIGKILL (-9) for reliable cleanup

## What start.sh does:

- Starts fresh ngrok tunnel
- Updates all .env files with new URL
- Rebuilds webapp
- Starts Backend + Bot

## Safety features:

- ✅ Professional scripts with error handling
- ✅ Port verification before restart
- ✅ Fresh ngrok URL on each restart
- ✅ Automatic .env updates

## When to use:

- 🔄 After code changes (backend, bot, or webapp)
- 🔄 When services are unresponsive
- 🔄 After config changes (.env files)
- 🔄 When ngrok tunnel expired
- 🔄 After merge conflicts
- 🔄 Periodic restart for stability

## Verify restart:

After restart, check:

- Backend: `curl http://localhost:3000/health`
- ngrok: `curl -s http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'`
- Logs: `tail -f logs/backend.log logs/bot.log`
