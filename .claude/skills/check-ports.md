# Check Ports Skill

Check which ports are in use and manage port conflicts.

## What this skill does:

1. Checks ports 3000 (Backend), 5173 (WebApp), 5432 (PostgreSQL)
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

# Port 5173 (WebApp)
echo ""
echo "Port 5173 (WebApp):"
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
  echo "  Status: OCCUPIED ⚠️"
  echo "  Process:"
  lsof -i :5432 | grep -v COMMAND | sed 's/^/    /'
else
  echo "  Status: FREE ✅"
fi

echo ""
echo "=== End of Check ==="
```

## Actions Claude can take:

If a port is occupied by wrong process:

```bash
# Kill process on port 3000
if lsof -ti:3000 >/dev/null 2>&1; then
  echo "Freeing port 3000..."
  lsof -ti:3000 | xargs kill -9
  echo "✅ Port 3000 freed"
else
  echo "Port 3000 is already free"
fi

# Kill process on port 5173
if lsof -ti:5173 >/dev/null 2>&1; then
  echo "Freeing port 5173..."
  lsof -ti:5173 | xargs kill -9
  echo "✅ Port 5173 freed"
else
  echo "Port 5173 is already free"
fi
```

## When to use:

- 🔌 Before starting services
- 🔌 When getting "port already in use" errors
- 🔌 After crashed services
- 🔌 Cleanup after tests
- 🔌 When services won't start

## Common scenarios:

**Scenario 1:** Backend won't start
```
❌ Error: listen EADDRINUSE: address already in use :::3000
→ Run "check ports" to see what's using port 3000
→ Claude will offer to kill the process
```

**Scenario 2:** Multiple instances running
```
⚠️ Found 2 processes on port 3000
→ Claude will show both processes
→ Kill all and restart cleanly
```
