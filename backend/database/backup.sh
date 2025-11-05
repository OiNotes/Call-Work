#!/bin/bash
# ============================================
# Database Backup Script
# Issue: P1-DB-006 (No Database Backup Strategy)
# Date: 2025-11-05
# ============================================
#
# Usage:
#   ./backup.sh           - Create backup with auto-generated name
#   ./backup.sh daily     - Daily backup (keeps 7 days)
#   ./backup.sh weekly    - Weekly backup (keeps 4 weeks)
#   ./backup.sh manual    - Manual backup (never auto-deleted)
#
# Schedule with cron:
#   0 2 * * * /path/to/backup.sh daily    # Daily at 2 AM
#   0 3 * * 0 /path/to/backup.sh weekly   # Weekly on Sunday at 3 AM

set -e  # Exit on any error

# ============================================
# Configuration
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups"
BACKUP_TYPE="${1:-manual}"  # daily, weekly, manual
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/telegram_shop_${BACKUP_TYPE}_${TIMESTAMP}.sql"

# Load environment variables
if [ -f "$PROJECT_ROOT/backend/.env" ]; then
  source "$PROJECT_ROOT/backend/.env"
else
  echo "❌ Error: .env file not found at $PROJECT_ROOT/backend/.env"
  exit 1
fi

# Extract database connection info from DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_URL="${DATABASE_URL}"
DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# ============================================
# Validate Configuration
# ============================================
if [ -z "$DB_NAME" ]; then
  echo "❌ Error: Could not parse database name from DATABASE_URL"
  echo "DATABASE_URL format: postgresql://user:password@host:port/database"
  exit 1
fi

# ============================================
# Create Backup Directory
# ============================================
mkdir -p "$BACKUP_DIR"

# ============================================
# Backup Database
# ============================================
echo "🔄 Starting database backup..."
echo "   Type: $BACKUP_TYPE"
echo "   Database: $DB_NAME"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   Output: $BACKUP_FILE"

# Export password for pg_dump
export PGPASSWORD="$DB_PASSWORD"

# Create backup with compression
pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-acl \
  --verbose \
  --file="$BACKUP_FILE" \
  2>&1 | grep -v "^pg_dump: reading" || true  # Suppress verbose output

# Compress backup
echo "🔄 Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Unset password
unset PGPASSWORD

# ============================================
# Verify Backup
# ============================================
if [ -f "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup completed successfully!"
  echo "   File: $BACKUP_FILE"
  echo "   Size: $BACKUP_SIZE"
else
  echo "❌ Error: Backup file not created"
  exit 1
fi

# ============================================
# Cleanup Old Backups
# ============================================
echo "🔄 Cleaning up old backups..."

case "$BACKUP_TYPE" in
  daily)
    # Keep last 7 daily backups
    KEEP_COUNT=7
    find "$BACKUP_DIR" -name "telegram_shop_daily_*.sql.gz" -type f | sort -r | tail -n +$((KEEP_COUNT + 1)) | xargs -r rm -f
    echo "   Kept last $KEEP_COUNT daily backups"
    ;;
  weekly)
    # Keep last 4 weekly backups
    KEEP_COUNT=4
    find "$BACKUP_DIR" -name "telegram_shop_weekly_*.sql.gz" -type f | sort -r | tail -n +$((KEEP_COUNT + 1)) | xargs -r rm -f
    echo "   Kept last $KEEP_COUNT weekly backups"
    ;;
  manual)
    # Never delete manual backups
    echo "   Manual backups are never auto-deleted"
    ;;
esac

# ============================================
# Backup Summary
# ============================================
echo ""
echo "📊 Backup Summary:"
echo "   Total backups: $(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null | wc -l)"
echo "   Daily backups: $(ls -1 "$BACKUP_DIR"/telegram_shop_daily_*.sql.gz 2>/dev/null | wc -l)"
echo "   Weekly backups: $(ls -1 "$BACKUP_DIR"/telegram_shop_weekly_*.sql.gz 2>/dev/null | wc -l)"
echo "   Manual backups: $(ls -1 "$BACKUP_DIR"/telegram_shop_manual_*.sql.gz 2>/dev/null | wc -l)"
echo "   Total size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"

# ============================================
# Restore Instructions
# ============================================
echo ""
echo "💡 To restore this backup:"
echo "   gunzip $BACKUP_FILE"
echo "   psql \$DATABASE_URL < ${BACKUP_FILE%.gz}"

echo ""
echo "✅ Database backup complete!"
