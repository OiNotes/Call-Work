-- ============================================
-- Migration 030: Add trigram indexes for shop search optimization
-- Created: 2025-11-06
-- Purpose: Optimize ILIKE searches on shops.name and users.username
-- Performance: Speeds up shopQueries.searchByName() with GIN trigram indexes
-- ============================================

-- UP Migration
-- Note: pg_trgm extension is already enabled in migration 008

-- Add GIN trigram index for shops.name (ILIKE search optimization)
-- This index dramatically improves performance for queries like:
--   WHERE shops.name ILIKE '%search_term%'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_name_trgm
ON shops USING gin (name gin_trgm_ops);

-- Add GIN trigram index for users.username (seller search optimization)
-- Used in shopQueries.searchByName() JOIN with:
--   WHERE users.username ILIKE '%search_term%'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_trgm
ON users USING gin (username gin_trgm_ops);

-- Optional: Add index for shop description if search will include it in future
-- Commented out for now, uncomment if needed:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_description_trgm
-- ON shops USING gin (description gin_trgm_ops);

-- Add comments for documentation
COMMENT ON INDEX idx_shops_name_trgm IS 'Trigram index for fast ILIKE search on shop names (case-insensitive)';
COMMENT ON INDEX idx_users_username_trgm IS 'Trigram index for fast ILIKE search on seller usernames (case-insensitive)';

-- ============================================
-- DOWN Migration (for rollback)
-- ============================================
-- To rollback, run:
--   DROP INDEX CONCURRENTLY IF EXISTS idx_shops_name_trgm;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_users_username_trgm;

-- ============================================
-- Performance Notes:
-- ============================================
-- 1. CONCURRENTLY flag ensures index creation doesn't block writes
-- 2. GIN (Generalized Inverted Index) is optimal for ILIKE with wildcards
-- 3. pg_trgm extension enables trigram matching for fuzzy search
-- 4. Before optimization: Full table scan on every search
-- 5. After optimization: Index scan with trigram matching
--
-- Expected improvements:
-- - Small tables (< 1000 rows): 2-5x faster
-- - Medium tables (1000-10k rows): 5-20x faster
-- - Large tables (> 10k rows): 20-100x faster
--
-- Query example that benefits:
--   SELECT s.*, u.username
--   FROM shops s
--   JOIN users u ON s.owner_id = u.id
--   WHERE s.is_active = true
--     AND (s.name ILIKE '%keyword%' OR u.username ILIKE '%keyword%')
--   LIMIT 10;
-- ============================================
