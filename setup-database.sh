#!/bin/bash

set -e  # Exit on error

echo "🚀 PostgreSQL Database Setup for Telegram E-Commerce Platform"
echo "=============================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check PostgreSQL status
echo "📋 Step 1: Checking PostgreSQL status..."
if ! pg_isready >/dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running!${NC}"
    echo ""
    echo "To start PostgreSQL on macOS:"
    echo "  brew services start postgresql@14"
    echo "  OR"
    echo "  brew services start postgresql"
    exit 1
else
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
fi

# Step 2: Check if database exists
echo ""
echo "📋 Step 2: Checking if database 'telegram_shop' exists..."
if psql -U sile -lqt | cut -d \| -f 1 | grep -qw telegram_shop; then
    echo -e "${YELLOW}⚠️  Database 'telegram_shop' already exists${NC}"
    echo ""
    read -p "Do you want to DROP and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Dropping existing database..."
        dropdb -U sile telegram_shop --if-exists
        echo -e "${GREEN}✅ Database dropped${NC}"
    else
        echo "⏭️  Skipping database creation..."
    fi
fi

# Step 3: Create database
echo ""
echo "📋 Step 3: Creating database 'telegram_shop'..."
if ! psql -U sile -lqt | cut -d \| -f 1 | grep -qw telegram_shop; then
    createdb -U sile telegram_shop
    echo -e "${GREEN}✅ Database 'telegram_shop' created${NC}"
else
    echo -e "${YELLOW}⚠️  Database already exists (continuing with migration)${NC}"
fi

# Step 4: Apply migrations
echo ""
echo "📋 Step 4: Applying schema migrations..."
cd "$(dirname "$0")/backend"
node database/migrations.js

# Step 5: Verify setup
echo ""
echo "📋 Step 5: Verification..."
echo ""
psql -U sile -d telegram_shop -c "\dt" | head -20

echo ""
echo -e "${GREEN}✅ Database setup complete!${NC}"
echo ""
echo "Connection string: postgresql://sile@localhost:5432/telegram_shop"
echo ""
