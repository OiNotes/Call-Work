#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Verifying ngrok setup..."
echo ""

# Check ngrok
if command -v ngrok &> /dev/null; then
    echo -e "${GREEN}✅ ngrok installed${NC}"
    ngrok version
else
    echo -e "${RED}❌ ngrok not installed${NC}"
    echo "   Install: brew install ngrok"
fi

echo ""

# Check PostgreSQL
if pg_isready -q; then
    echo -e "${GREEN}✅ PostgreSQL running${NC}"
    psql --version
else
    echo -e "${RED}❌ PostgreSQL not running${NC}"
    echo "   Start: brew services start postgresql@15"
fi

echo ""

# Check node-fetch
if [ -d "node_modules/node-fetch" ]; then
    echo -e "${GREEN}✅ node-fetch installed${NC}"
else
    echo -e "${RED}❌ node-fetch not installed${NC}"
    echo "   Install: npm install"
fi

echo ""

# Check .env files
echo "📋 Checking .env files:"

if [ -f "backend/.env" ]; then
    echo -e "   ${GREEN}✅ backend/.env${NC}"
else
    echo -e "   ${YELLOW}⚠️  backend/.env (use .env.development.example)${NC}"
fi

if [ -f "bot/.env" ]; then
    echo -e "   ${GREEN}✅ bot/.env${NC}"
else
    echo -e "   ${YELLOW}⚠️  bot/.env (use .env.development.example)${NC}"
fi

if [ -f "webapp/.env" ]; then
    echo -e "   ${GREEN}✅ webapp/.env${NC}"
else
    echo -e "   ${YELLOW}⚠️  webapp/.env (use .env.development.example)${NC}"
fi

echo ""

# Check scripts executable
echo "🔧 Checking script permissions:"

for script in dev-scripts/*.sh; do
    if [ -x "$script" ]; then
        echo -e "   ${GREEN}✅ $(basename $script)${NC}"
    else
        echo -e "   ${YELLOW}⚠️  $(basename $script) (not executable)${NC}"
        echo "      Fix: chmod +x $script"
    fi
done

echo ""
echo "🎉 Setup verification complete!"
echo ""
echo "Next steps:"
echo "1. Create .env files from .env.development.example"
echo "2. Make scripts executable: chmod +x dev-scripts/*.sh"
echo "3. Run: npm run dev:ngrok"
