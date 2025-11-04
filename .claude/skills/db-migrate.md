---
name: db-migrate
description: Run PostgreSQL migrations with automatic backup and rollback on errors. Use when updating database schema.
---

# DB Migrate Skill

Run database migrations safely with automatic backups and rollback capability.

## What this skill does:

1. Checks PostgreSQL is running
2. Creates automatic backup before migration
3. Runs migrations from backend/database/migrations.js
4. Verifies schema changes
5. Rolls back on errors (restores from backup)
6. Reports migration status

## Usage:

Say: **"migrate db"** or **"run migrations"** or **"update database"** or **"db migrate"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"
BACKUP_DIR="$PROJECT_DIR/backend/database/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== Database Migration ==="
echo ""

# 0. Create backup directory if doesn't exist
mkdir -p "$BACKUP_DIR"

# 1. Check PostgreSQL
echo "1. Checking PostgreSQL..."
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "❌ PostgreSQL is not running"
  echo "Starting PostgreSQL..."
  brew services start postgresql@14
  sleep 3
  
  if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "✅ PostgreSQL started"
  else
    echo "❌ Failed to start PostgreSQL"
    exit 1
  fi
else
  echo "✅ PostgreSQL is running"
fi

# 2. Create backup
echo ""
echo "2. Creating backup..."
BACKUP_FILE="$BACKUP_DIR/telegram_shop_backup_$TIMESTAMP.sql"

if pg_dump telegram_shop > "$BACKUP_FILE" 2>/dev/null; then
  backup_size=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup created: $backup_size"
  echo "   Location: $BACKUP_FILE"
else
  echo "❌ Backup failed. Aborting migration."
  echo "   Make sure database 'telegram_shop' exists"
  exit 1
fi

# 3. Run migrations
echo ""
echo "3. Running migrations..."
cd "$PROJECT_DIR"

if npm run db:migrate; then
  echo "✅ Migrations completed successfully"
  MIGRATION_SUCCESS=1
else
  echo "❌ Migrations failed"
  echo ""
  echo "Rolling back from backup..."
  
  if psql telegram_shop < "$BACKUP_FILE" >/dev/null 2>&1; then
    echo "✅ Database restored from backup"
  else
    echo "❌ Restore failed! Manual intervention needed"
    echo "   Backup location: $BACKUP_FILE"
  fi
  exit 1
fi

# 4. Verify schema (only if migration succeeded)
if [ -n "$MIGRATION_SUCCESS" ]; then
  echo ""
  echo "4. Verifying schema..."
  echo "   Current tables:"
  psql telegram_shop -c "\dt" -t | sed 's/^/     /'
  
  # Check core tables exist
  CORE_TABLES="users shops products orders payments"
  for table in $CORE_TABLES; do
    if psql telegram_shop -c "\d $table" >/dev/null 2>&1; then
      echo "   ✅ Table '$table' exists"
    else
      echo "   ⚠️  Table '$table' not found"
    fi
  done
fi

echo ""
echo "=== Migration Complete ==="

if [ -n "$MIGRATION_SUCCESS" ]; then
  echo "✅ Database schema updated successfully"
  echo "   Backup saved: $BACKUP_FILE"
  echo "   Safe to delete old backups after verifying"
else
  exit 1
fi
```

## Safety features:

- ✅ **Automatic backup** before every migration
- ✅ **Rollback on errors** - restores from backup
- ✅ **Schema verification** after migration
- ✅ **Backup retention** - keeps all backups (manual cleanup)

## Migration file location:

- **Migrations:** `backend/database/migrations.js`
- **Schema:** `backend/database/schema.sql`
- **Backups:** `backend/database/backups/telegram_shop_backup_YYYYMMDD_HHMMSS.sql`

## Tables in database:

Core tables:
- `users` - User accounts
- `shops` - Shop information
- `products` - Product listings
- `orders` - Order records
- `payments` - Payment transactions
- `shop_follows` - Shop subscriptions
- `product_sync` - Synced products

## Rollback manually:

If you need to rollback to a specific backup:

```bash
# List backups
ls -lh backend/database/backups/

# Restore from backup
psql telegram_shop < backend/database/backups/telegram_shop_backup_20251104_120000.sql
```

## When to use:

- 🗄️ After adding new tables/columns in schema.sql
- 🗄️ After pulling schema changes from git
- 🗄️ Before deploy to production
- 🗄️ When database structure needs update
- 🗄️ After modifying migrations.js

## Pro tips:

- Backups are stored in `backend/database/backups/` - delete old ones manually
- Migrations are idempotent (safe to run multiple times)
- Test migrations on development database first
- Always verify schema after migration with `\d tablename` in psql
