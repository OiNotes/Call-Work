---
name: check-ports
description: Check and free ports 3000, 5173, 5432, 4040 used by Backend, WebApp, PostgreSQL, ngrok. Use when getting EADDRINUSE errors.
---

# Check Ports Skill

Check which ports are in use and manage port conflicts.

## What this skill does:

1. Checks critical ports: 3000 (Backend), 5173 (WebApp), 5432 (PostgreSQL), 4040 (ngrok)
2. Shows which processes are using them
3. Optionally kills processes
4. Verifies ports are free

## Usage:

Say: **"check ports"** or **"port status"** or **"what's using my ports"** or **"free ports"**

## Commands:

```bash
echo "=== Port Status Check ==="
echo ""

# Port 3000 (Backend)
echo "Port 3000 (Backend):"
if lsof -ti:3000 >/dev/null 2>&1; then
  echo "  Status: OCCUPIED ⚠️"
  echo "  Process:"
  lsof -i :3000 | grep -v COMMAND | sed 's/^/    /'
else
  echo "  Status: FREE ✅"
fi

# Port 5173 (WebApp dev server - Vite)
echo ""
echo "Port 5173 (WebApp - Vite):"
if lsof -ti:5173 >/dev/null 2>&1; then
  echo "  Status: OCCUPIED ⚠️"
  echo "  Process:"
  lsof -i :5173 | grep -v COMMAND | sed 's/^/    /'
else
  echo "  Status: FREE ✅"
fi

# Port 5432 (PostgreSQL)
echo ""
echo "Port 5432 (PostgreSQL):"
if lsof -ti:5432 >/dev/null 2>&1; then
  echo "  Status: OCCUPIED ✅ (should be PostgreSQL)"
  echo "  Process:"
  lsof -i :5432 | grep -v COMMAND | sed 's/^/    /'
else
  echo "  Status: FREE ⚠️ (PostgreSQL should be running!)"
fi

# Port 4040 (ngrok dashboard)
echo ""
echo "Port 4040 (ngrok dashboard):"
if lsof -ti:4040 >/dev/null 2>&1; then
  echo "  Status: OCCUPIED ✅ (ngrok running)"
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$NGROK_URL" ]; then
    echo "  ngrok URL: $NGROK_URL"
  fi
else
  echo "  Status: FREE ⚠️ (ngrok not running - Mini App won't work!)"
fi

echo ""
echo "=== End of Check ==="
```

## Actions Claude can take:

If a port is occupied by wrong process:

```bash
# Free port 3000 (Backend)
if lsof -ti:3000 >/dev/null 2>&1; then
  echo "Freeing port 3000..."
  lsof -ti:3000 | xargs kill -9
  sleep 1
  echo "✅ Port 3000 freed"
fi

# Free port 5173 (WebApp)
if lsof -ti:5173 >/dev/null 2>&1; then
  echo "Freeing port 5173..."
  lsof -ti:5173 | xargs kill -9
  sleep 1
  echo "✅ Port 5173 freed"
fi
```

## Expected port status:

When system is healthy:
- ✅ Port 3000: Backend (node)
- ✅ Port 5173: FREE (only used during webapp dev)
- ✅ Port 5432: PostgreSQL (postgres)
- ✅ Port 4040: ngrok (ngrok)

## When to use:

- 🔌 Before starting services (with quick-start)
- 🔌 When getting "port already in use" errors (EADDRINUSE)
- 🔌 After crashed services (zombie processes)
- 🔌 Cleanup after tests
- 🔌 When services won't start
- 🔌 After system wake from sleep

## Common scenarios:

### Scenario 1: Backend won't start
```
❌ Error: listen EADDRINUSE: address already in use :::3000
→ Run "check ports" to see what's using port 3000
→ Kill the process: lsof -ti:3000 | xargs kill -9
→ Restart: cd backend && npm run dev
```

### Scenario 2: ngrok not running
```
⚠️ Port 4040 FREE - ngrok not running
→ Start everything: ./start.sh
```

### Scenario 3: PostgreSQL not running
```
⚠️ Port 5432 FREE - PostgreSQL should be running!
→ Start PostgreSQL: brew services start postgresql@14
```

## Pro tips:

- Use ./stop.sh for clean shutdown (kills all ports)
- After ./stop.sh, all ports except 5432 should be free
- Port 5432 (PostgreSQL) should ALWAYS be occupied
- Port 4040 (ngrok) is CRITICAL for this project - Mini App won't work without it
