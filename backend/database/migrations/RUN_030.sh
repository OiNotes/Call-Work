#!/bin/bash

# ============================================
# Quick Apply Migration 030: Shop Search Performance
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load DATABASE_URL
if [ -f ../../.env ]; then
  export $(cat ../../.env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Migration 030: Shop Search Trigram Indexes${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Apply migration
echo -e "${YELLOW}Applying migration...${NC}"
psql "$DATABASE_URL" -f 030_add_shops_search_trigram_index.sql

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✓ Migration applied successfully${NC}"

  # Verify indexes
  echo ""
  echo -e "${YELLOW}Verifying indexes...${NC}"
  psql "$DATABASE_URL" -c "
    SELECT indexname,
           pg_size_pretty(pg_relation_size(indexname::regclass)) as size
    FROM pg_indexes
    WHERE indexname IN ('idx_shops_name_trgm', 'idx_users_username_trgm');
  "

  # Record in schema_migrations
  echo ""
  echo -e "${YELLOW}Recording migration...${NC}"
  psql "$DATABASE_URL" -c "
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (30, 'add_shops_search_trigram_index', NOW())
    ON CONFLICT (version) DO NOTHING;
  "

  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  Migration 030 completed successfully!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "${BLUE}Next steps:${NC}"
  echo "1. Test search performance with EXPLAIN ANALYZE"
  echo "2. Check APPLY_030.md for performance testing guide"
else
  echo -e "${RED}✗ Migration failed${NC}"
  exit 1
fi
