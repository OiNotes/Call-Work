---
name: fix-errors
description: Auto-fix port conflicts, database connection issues, missing dependencies, ngrok problems, schema errors. Use when services fail to start or throw errors.
---

# Fix Errors Skill

Automatically detect and fix common errors in the Status Stock 4.0 project.

## What this skill does:

1. Scans error logs using analyze-logs skill
2. Identifies fixable errors
3. Applies automatic fixes
4. Restarts affected services
5. Verifies fixes worked

## Usage:

Say: **"fix errors"** or **"auto fix"** or **"fix all issues"** or **"repair"**

## Common errors this skill fixes:

### 1. Port already in use (EADDRINUSE)

```bash
# Kill process on port 3000 (Backend)
if lsof -ti:3000 >/dev/null 2>&1; then
  echo "🔧 Killing process on port 3000..."
  lsof -ti:3000 | xargs kill -9
  sleep 1
  echo "✅ Port 3000 freed"
fi

# Restart backend
cd "/Users/sile/Documents/Status Stock 4.0/backend"
npm run dev > ../logs/backend.log 2>&1 &
echo "✅ Backend restarted"
```

### 2. Database connection refused (ECONNREFUSED)

```bash
# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "🔧 Starting PostgreSQL..."
  brew services start postgresql@14
  sleep 3

  # Verify
  if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "✅ PostgreSQL started"
  else
    echo "❌ Failed to start PostgreSQL. Check: brew services list"
    exit 1
  fi
else
  echo "✅ PostgreSQL already running"
fi

# Test database connection
if psql -d telegram_shop -c "SELECT 1" >/dev/null 2>&1; then
  echo "✅ Database 'telegram_shop' accessible"
else
  echo "⚠️  Database exists but not accessible. Try: psql telegram_shop"
fi
```

### 3. Missing dependencies (Cannot find module)

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "🔧 Reinstalling dependencies..."

# Backend
cd "$PROJECT_DIR/backend"
if npm install; then
  echo "✅ Backend dependencies installed"
else
  echo "❌ Backend npm install failed"
  exit 1
fi

# Bot
cd "$PROJECT_DIR/bot"
if npm install; then
  echo "✅ Bot dependencies installed"
else
  echo "❌ Bot npm install failed"
  exit 1
fi

# Webapp
cd "$PROJECT_DIR/webapp"
if npm install; then
  echo "✅ Webapp dependencies installed"
else
  echo "❌ Webapp npm install failed"
  exit 1
fi

echo "✅ All dependencies installed. Restart with: ./start.sh"
```

### 4. ngrok tunnel expired or not running

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "🔧 Fixing ngrok tunnel..."

# Stop everything cleanly
cd "$PROJECT_DIR"
./stop.sh

sleep 2

# Restart with fresh ngrok tunnel
./start.sh

# Verify ngrok is working
sleep 5
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$NGROK_URL" ]; then
  echo "✅ ngrok tunnel active: $NGROK_URL"
else
  echo "❌ ngrok tunnel failed. Check: http://localhost:4040"
  exit 1
fi
```

### 5. Database schema out of sync

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "🔧 Running database migrations..."

cd "$PROJECT_DIR"
if npm run db:migrate; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migrations failed. Check logs for details."
  exit 1
fi

# Verify tables exist
echo "Verifying database schema..."
psql telegram_shop -c "\dt" -t | grep -E "users|shops|products|orders" && echo "✅ Core tables exist"
```

### 6. Import/Export errors

Claude will automatically:

- Read the problematic file using MCP File System
- Check exports and imports
- Fix import statements (e.g., add .js extension for ES modules)
- Update file if needed

Example fix:

```javascript
// ❌ Wrong (ES modules need .js extension)
import { db } from './database';

// ✅ Fixed
import { db } from './database.js';
```

### 7. Webapp build errors

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "🔧 Rebuilding webapp..."

cd "$PROJECT_DIR/webapp"

# Clear vite cache
rm -rf node_modules/.vite

# Rebuild
if npm run build; then
  echo "✅ Webapp built successfully"
else
  echo "❌ Webapp build failed. Check logs/webapp-build.log"
  exit 1
fi
```

### 8. Bot not responding (stuck session)

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "🔧 Restarting bot with session cleanup..."

# Stop bot
pkill -f "node.*bot.js"
sleep 2

# Start fresh
cd "$PROJECT_DIR/bot"
npm start > ../logs/bot.log 2>&1 &

sleep 3

# Verify
if ps aux | grep "node.*bot.js" | grep -v grep >/dev/null; then
  echo "✅ Bot restarted"

  # Check logs for successful start
  if grep -q "Bot started successfully" ../logs/bot.log; then
    echo "✅ Bot initialized successfully"
  else
    echo "⚠️  Bot running but check logs: tail -f logs/bot.log"
  fi
else
  echo "❌ Bot failed to start"
  exit 1
fi
```

## Automatic workflow:

1. ✅ Run analyze-logs to identify errors
2. ✅ Match error pattern to fix strategy
3. ✅ Apply appropriate fix
4. ✅ Restart affected service
5. ✅ Verify fix worked (re-run health-check)
6. ✅ Repeat if new errors appear

## Safety:

- ✅ Always uses graceful shutdown (./stop.sh) when restarting all services
- ✅ Validates fixes before marking as complete
- ✅ Logs all actions to stdout for transparency
- ✅ Never deletes data without backup (for db operations)

## When to use:

- 🔧 After pulling new changes
- 🔧 First run on new machine
- 🔧 After merge conflicts
- 🔧 When "nothing works"
- 🔧 Quick emergency fix
- 🔧 After system reboot (ngrok tunnel expires)
- 🔧 When logs show repeated errors

## After fixing:

Always verify with health-check skill:

```
"health check"
```

If errors persist:

1. Check specific log file
2. Read full error stack trace
3. Google error message
4. Ask Claude for help with full error text
