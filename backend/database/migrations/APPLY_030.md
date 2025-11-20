# Migration 030: Shop Search Performance (Trigram Indexes)

## Overview

**File:** `030_add_shops_search_trigram_index.sql`
**Purpose:** Optimize ILIKE searches on shops.name and users.username
**Date:** 2025-11-06
**Status:** Ready to apply

## Problem Statement

The shop search endpoint (`GET /api/shops/search`) uses case-insensitive pattern matching:

```sql
SELECT s.*, u.username
FROM shops s
JOIN users u ON s.owner_id = u.id
WHERE s.is_active = true
  AND (s.name ILIKE '%keyword%' OR u.username ILIKE '%keyword%')
LIMIT 10;
```

**Current state:**

- Uses B-tree index `idx_shops_name` (cannot optimize ILIKE with wildcards)
- Full table scan on every search
- Slow performance on tables with 1000+ rows

**After migration:**

- GIN trigram indexes on `shops.name` and `users.username`
- Index scan instead of full table scan
- 5-100x faster searches (depending on table size)

## Dependencies

- **pg_trgm extension** - ALREADY INSTALLED (migration 008)
- No breaking changes
- Safe to apply in production

## How to Apply

### Quick Apply (Development)

```bash
cd backend
psql $DATABASE_URL -f database/migrations/030_add_shops_search_trigram_index.sql
```

### Production Deployment

```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migration (CONCURRENTLY = no locks)
psql $DATABASE_URL -f database/migrations/030_add_shops_search_trigram_index.sql

# 3. Verify indexes created
psql $DATABASE_URL -c "
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE indexname IN ('idx_shops_name_trgm', 'idx_users_username_trgm');
"
```

**Expected output:**

```
           indexname          |                                     indexdef
------------------------------+---------------------------------------------------------------------------------
 idx_shops_name_trgm          | CREATE INDEX idx_shops_name_trgm ON shops USING gin (name gin_trgm_ops)
 idx_users_username_trgm      | CREATE INDEX idx_users_username_trgm ON users USING gin (username gin_trgm_ops)
(2 rows)
```

## Testing Performance

### Before Migration (baseline)

```sql
EXPLAIN ANALYZE
SELECT s.*, u.username
FROM shops s
JOIN users u ON s.owner_id = u.id
WHERE s.is_active = true
  AND (s.name ILIKE '%test%' OR u.username ILIKE '%test%')
LIMIT 10;
```

**Expected:** `Seq Scan on shops` (full table scan)

### After Migration

Run same query and check:

```sql
EXPLAIN ANALYZE
SELECT s.*, u.username
FROM shops s
JOIN users u ON s.owner_id = u.id
WHERE s.is_active = true
  AND (s.name ILIKE '%test%' OR u.username ILIKE '%test%')
LIMIT 10;
```

**Expected:** `Bitmap Index Scan using idx_shops_name_trgm` (index scan)

## Rollback

If you need to rollback (e.g., disk space concerns):

```sql
BEGIN;
DROP INDEX CONCURRENTLY IF EXISTS idx_shops_name_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_username_trgm;
COMMIT;
```

**Note:** Using CONCURRENTLY for both create and drop ensures no table locks.

## Index Size Estimation

For typical table sizes:

| Shops Count | Index Size (shops.name) | Index Size (users.username) |
| ----------- | ----------------------- | --------------------------- |
| 100         | ~50 KB                  | ~50 KB                      |
| 1,000       | ~500 KB                 | ~500 KB                     |
| 10,000      | ~5 MB                   | ~5 MB                       |
| 100,000     | ~50 MB                  | ~50 MB                      |

Check actual size after creation:

```sql
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes
WHERE indexname IN ('idx_shops_name_trgm', 'idx_users_username_trgm');
```

## Performance Improvements

### Expected Results

| Table Size   | Before (ms) | After (ms) | Speedup |
| ------------ | ----------- | ---------- | ------- |
| 100 rows     | 5-10ms      | 2-3ms      | 2-3x    |
| 1,000 rows   | 20-50ms     | 3-5ms      | 5-10x   |
| 10,000 rows  | 100-300ms   | 5-10ms     | 20-30x  |
| 100,000 rows | 1-5s        | 10-50ms    | 100x+   |

### Test with Your Data

```bash
# Test search performance before/after
psql $DATABASE_URL -c "
\timing on
SELECT s.*, u.username
FROM shops s
JOIN users u ON s.owner_id = u.id
WHERE s.is_active = true
  AND (s.name ILIKE '%keyword%' OR u.username ILIKE '%keyword%')
LIMIT 10;
"
```

## Notes

- Migration uses `CREATE INDEX CONCURRENTLY` - safe for production
- No downtime during index creation
- Existing queries will work during migration
- pg_trgm extension enables fuzzy text search capabilities
- Indexes auto-update when data changes (no maintenance needed)

## Related Files

- **Query location:** `backend/src/models/db.js:136` (shopQueries.searchByName)
- **API endpoint:** `backend/src/routes/shops.js:42` (GET /api/shops/search)
- **Controller:** `backend/src/controllers/shopController.js:483` (search method)

## Questions?

Check PostgreSQL pg_trgm documentation: https://www.postgresql.org/docs/current/pgtrgm.html
