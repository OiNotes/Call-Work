#!/bin/bash
# ============================================
# Database Backup Script
# ============================================
# Creates a backup before running cleanup_all_data.sql
# Usage: ./backup_before_cleanup.sh
# ============================================

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/telegram_shop_backup_$TIMESTAMP.sql"

# Create backups directory if not exists
mkdir -p "$BACKUP_DIR"

echo "Creating backup: $BACKUP_FILE"
pg_dump telegram_shop > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully: $BACKUP_FILE"
    echo ""
    echo "To restore this backup, run:"
    echo "  psql telegram_shop < $BACKUP_FILE"
    echo ""
    echo "Backup size:"
    ls -lh "$BACKUP_FILE" | awk '{print $5}'
else
    echo "❌ Backup failed!"
    exit 1
fi
