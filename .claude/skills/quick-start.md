# Quick Start Skill

Instantly start the entire Status Stock 4.0 stack with automatic dependency checks.

## What this skill does:

1. Checks if node_modules exist, runs `npm run install:all` if missing
2. Checks if PostgreSQL is running, starts it if needed
3. Checks if database exists, creates it if missing
4. Starts Backend (port 3000), WebApp (port 5173), and Bot concurrently
5. Monitors logs for errors

## Usage:

Simply say: **"quick start"** or **"start everything"** or **"start project"**

## Commands:

```bash
cd /Users/sile/Documents/Status\ Stock\ 4.0

# Check dependencies
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm run install:all
fi

# Check PostgreSQL
pg_isready -h localhost -p 5432 || {
  echo "🗄️ Starting PostgreSQL..."
  brew services start postgresql@14
  sleep 2
}

# Check database
psql -l | grep telegram_shop || {
  echo "🗄️ Creating database..."
  npm run db:setup
}

# Start all services
echo "🚀 Starting all services..."
npm run dev:all
```

## Success indicators:

- ✅ **Backend:** "Server running on port 3000"
- ✅ **WebApp:** "Local: http://localhost:5173"
- ✅ **Bot:** "Bot started successfully"

## Automatic error handling:

If errors occur, Claude will:
1. Read error logs
2. Identify the issue
3. Fix it automatically
4. Restart the service

## When to use:

- ⚡ First launch after cloning
- ⚡ Morning startup
- ⚡ After `npm run clean`
- ⚡ After pulling new changes
