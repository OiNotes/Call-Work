# Fix Errors Skill

Automatically detect and fix common errors in the Status Stock 4.0 project.

## What this skill does:

1. Scans error logs
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
lsof -ti:3000 && {
  echo "🔧 Killing process on port 3000..."
  kill -9 $(lsof -ti:3000)
}

# Kill process on port 5173 (WebApp)
lsof -ti:5173 && {
  echo "🔧 Killing process on port 5173..."
  kill -9 $(lsof -ti:5173)
}
```

### 2. Database connection refused (ECONNREFUSED)

```bash
# Restart PostgreSQL
pg_isready -h localhost -p 5432 || {
  echo "🔧 Restarting PostgreSQL..."
  brew services restart postgresql@14
  sleep 2
}
```

### 3. Missing dependencies (Cannot find module)

```bash
# Reinstall dependencies
cd /Users/sile/Documents/Status\ Stock\ 4.0
echo "🔧 Reinstalling dependencies..."
npm run install:all
```

### 4. Database schema out of sync

```bash
# Run migrations
cd /Users/sile/Documents/Status\ Stock\ 4.0
echo "🔧 Running database migrations..."
npm run db:migrate
```

### 5. Import/Export errors

Claude will automatically:
- Read the problematic file
- Check exports
- Fix import statements
- Using MCP File System (Read, Edit)

## Automatic workflow:

1. ✅ Read error logs
2. ✅ Identify error type
3. ✅ Apply appropriate fix
4. ✅ Restart service
5. ✅ Check if error is gone
6. ✅ Repeat if new errors appear

## Safety:

- ✅ Makes backups before file edits
- ✅ Uses graceful shutdown for services
- ✅ Validates fixes before committing

## When to use:

- 🔧 After pulling new changes
- 🔧 First run on new machine
- 🔧 After merge conflicts
- 🔧 When "nothing works"
- 🔧 Quick emergency fix
