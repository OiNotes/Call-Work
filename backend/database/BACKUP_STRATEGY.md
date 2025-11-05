# Database Backup Strategy

> **P1-DB-006** - Automated PostgreSQL backup solution

## Overview

This backup strategy provides:
- ✅ **Automated daily backups** (kept for 7 days)
- ✅ **Automated weekly backups** (kept for 4 weeks)
- ✅ **Manual backups** (never auto-deleted)
- ✅ **Compressed storage** (gzip compression)
- ✅ **Easy restore** (single command)

## Backup Script

**Location:** `backend/database/backup.sh`

**Features:**
- Reads `DATABASE_URL` from `.env`
- Creates compressed `.sql.gz` backups
- Auto-cleanup of old backups
- Verbose logging
- Error handling

## Usage

### Manual Backup

```bash
cd backend/database
./backup.sh manual
```

**Output:** `backups/telegram_shop_manual_YYYYMMDD_HHMMSS.sql.gz`

### Daily Backup

```bash
./backup.sh daily
```

**Retention:** Last 7 daily backups (older ones auto-deleted)

### Weekly Backup

```bash
./backup.sh weekly
```

**Retention:** Last 4 weekly backups (older ones auto-deleted)

## Automated Scheduling (Cron)

Add to crontab:

```bash
crontab -e
```

```cron
# Daily backup at 2 AM
0 2 * * * /path/to/Status\ Stock\ 4.0/backend/database/backup.sh daily

# Weekly backup on Sunday at 3 AM
0 3 * * 0 /path/to/Status\ Stock\ 4.0/backend/database/backup.sh weekly
```

**Verify cron jobs:**
```bash
crontab -l
```

## Restore Backup

### Step 1: List Available Backups

```bash
ls -lh backups/
```

### Step 2: Choose Backup File

```bash
# Example: Restore from daily backup
BACKUP_FILE="backups/telegram_shop_daily_20250105_020000.sql.gz"
```

### Step 3: Decompress Backup

```bash
gunzip "$BACKUP_FILE"
```

### Step 4: Restore to Database

```bash
# Load environment
source backend/.env

# Restore (WARNING: This will OVERWRITE current database!)
psql $DATABASE_URL < "${BACKUP_FILE%.gz}"
```

**Alternative (with confirmation):**

```bash
# Drop existing database (if needed)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore
psql $DATABASE_URL < backups/telegram_shop_daily_20250105_020000.sql
```

## Backup Testing

**Test backup script:**

```bash
# Create test backup
./backup.sh manual

# Verify backup was created
ls -lh backups/telegram_shop_manual_*.sql.gz

# Test decompression
gunzip -t backups/telegram_shop_manual_*.sql.gz

# Output should be: "OK" (no errors)
```

## Storage Management

**Check backup directory size:**

```bash
du -sh backups/
```

**Expected sizes:**
- Daily backup: ~5-10 MB (compressed)
- Weekly backup: ~5-10 MB (compressed)
- Total storage (7 daily + 4 weekly + manual): ~50-100 MB

**Manual cleanup (if needed):**

```bash
# Remove all backups older than 30 days
find backups/ -name "*.sql.gz" -mtime +30 -delete

# Keep only last 5 backups
ls -t backups/*.sql.gz | tail -n +6 | xargs rm -f
```

## Disaster Recovery Plan

### Scenario 1: Accidental Data Deletion

1. Stop all services:
   ```bash
   ./stop.sh
   ```

2. Restore from latest daily backup:
   ```bash
   cd backend/database
   LATEST_BACKUP=$(ls -t backups/telegram_shop_daily_*.sql.gz | head -1)
   gunzip "$LATEST_BACKUP"
   psql $DATABASE_URL < "${LATEST_BACKUP%.gz}"
   ```

3. Restart services:
   ```bash
   ./start.sh
   ```

### Scenario 2: Database Corruption

1. Create emergency backup of current state:
   ```bash
   ./backup.sh manual
   ```

2. Restore from last known good backup (weekly):
   ```bash
   WEEKLY_BACKUP=$(ls -t backups/telegram_shop_weekly_*.sql.gz | head -1)
   gunzip "$WEEKLY_BACKUP"
   psql $DATABASE_URL < "${WEEKLY_BACKUP%.gz}"
   ```

### Scenario 3: Server Migration

1. Create manual backup on old server:
   ```bash
   ./backup.sh manual
   ```

2. Copy backup to new server:
   ```bash
   scp backups/telegram_shop_manual_*.sql.gz user@new-server:/path/
   ```

3. Restore on new server:
   ```bash
   gunzip telegram_shop_manual_*.sql.gz
   psql $DATABASE_URL < telegram_shop_manual_*.sql
   ```

## Security Recommendations

### Backup Encryption (Optional)

Encrypt backups for extra security:

```bash
# Encrypt backup
gpg --symmetric --cipher-algo AES256 backups/telegram_shop_daily_*.sql.gz

# Decrypt backup
gpg --decrypt backups/telegram_shop_daily_*.sql.gz.gpg > backup.sql.gz
```

### Off-site Backups (Recommended)

**Option 1: Cloud Storage (AWS S3)**

```bash
# Upload to S3 (requires aws-cli)
aws s3 cp backups/ s3://your-bucket/telegram-shop-backups/ --recursive
```

**Option 2: Remote Server**

```bash
# Sync to remote server (requires ssh access)
rsync -avz backups/ user@backup-server:/backups/telegram-shop/
```

**Option 3: Google Drive (rclone)**

```bash
# Upload to Google Drive (requires rclone)
rclone sync backups/ gdrive:telegram-shop-backups/
```

## Monitoring

**Verify backups are being created:**

```bash
# Check last backup time
ls -lt backups/ | head -5

# Check backup script logs (if using cron)
grep "backup.sh" /var/log/cron.log
```

**Alert if backup fails:**

Add email notification to backup script:

```bash
# At end of backup.sh
echo "Database backup completed at $(date)" | mail -s "Backup Success" admin@example.com
```

## Troubleshooting

### Error: "pg_dump: command not found"

**Solution:** Install PostgreSQL client tools:

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client
```

### Error: "FATAL: password authentication failed"

**Solution:** Check `DATABASE_URL` in `.env`:

```bash
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL -c "SELECT version();"
```

### Error: "Permission denied"

**Solution:** Make script executable:

```bash
chmod +x backend/database/backup.sh
```

## Best Practices

1. ✅ **Test restores regularly** - Verify backups are not corrupted
2. ✅ **Monitor backup size** - Large increases may indicate data issues
3. ✅ **Keep off-site backups** - Protect against server failure
4. ✅ **Document restore procedures** - Train team on recovery process
5. ✅ **Automate with cron** - Never rely on manual backups

## Performance Impact

**Backup duration:**
- Small database (<100 MB): ~5-10 seconds
- Medium database (100 MB - 1 GB): ~30-60 seconds
- Large database (1 GB+): ~2-5 minutes

**Impact on database:**
- Minimal (read-only operation)
- No locks acquired
- No performance degradation during backup

## Version History

- **2025-11-05**: Initial backup strategy (P1-DB-006)
- Retention: 7 daily + 4 weekly backups
- Compression: gzip
- Format: SQL plain text

---

**Related Issues:**
- P1-DB-006: No Database Backup Strategy (FIXED)

**Next Steps:**
- Set up cron jobs for automated backups
- Configure off-site backup storage
- Document disaster recovery procedures
