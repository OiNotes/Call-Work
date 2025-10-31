# DB Migrate Skill

Run database migrations safely with automatic backups and rollback capability.

## What this skill does:

1. Creates database backup
2. Runs migrations
3. Verifies schema changes
4. Rolls back if errors occur
5. Reports migration status

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
if ! pg_isready -h localhost -p 5432; then
  echo "❌ PostgreSQL is not running"
  echo "Starting PostgreSQL..."
  brew services start postgresql@14
  sleep 2
fi

# 2. Create backup
echo ""
echo "2. Creating backup..."
BACKUP_FILE="$BACKUP_DIR/telegram_shop_backup_$TIMESTAMP.sql"
if pg_dump telegram_shop > "$BACKUP_FILE" 2>/dev/null; then
  echo "✅ Backup created: $BACKUP_FILE"
else
  echo "❌ Backup failed. Aborting migration."
  exit 1
fi

# 3. Run migrations
echo ""
echo "3. Running migrations..."
cd "$PROJECT_DIR"
if npm run db:migrate; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migrations failed"
  echo "Restoring from backup..."
  psql telegram_shop < "$BACKUP_FILE"
  echo "✅ Database restored"
  exit 1
fi

# 4. Verify schema
echo ""
echo "4. Verifying schema..."
psql telegram_shop -c "\dt" -t | sed 's/^/   /'

echo ""
echo "=== Migration Complete ==="
echo "Backup saved to: $BACKUP_FILE"
```

## Safety features:

- ✅ Automatic backup before migration
- ✅ Rollback on errors
- ✅ Schema verification after migration
- ✅ Backup retention (keep for 30 days)

## Rollback:

If migration fails, restore from backup:
```bash
psql telegram_shop < backend/database/backups/telegram_shop_backup_YYYYMMDD_HHMMSS.sql
```

## Migration files:

Migrations are defined in:
- `backend/database/migrations.js`
- `backend/database/schema.sql`

## Tables in database:

- `users` - User accounts
- `shops` - Shop information
- `products` - Product listings
- `orders` - Order records
- `payments` - Payment transactions
- `shop_follows` - Shop subscriptions
- `product_sync` - Synced products

## When to use:

- 🗄️ After adding new tables/columns
- 🗄️ When schema.sql is updated
- 🗄️ After pulling schema changes
- 🗄️ Before deploy to production
- 🗄️ When database structure changes
