#!/bin/bash

#############################################
# Telegram Shop - Stop All Services
# Останавливает Backend + Bot + Webapp + ngrok
#############################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                    ║${NC}"
echo -e "${BLUE}║     🛑 Telegram Shop - Stopping All Services      ║${NC}"
echo -e "${BLUE}║                                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}Stopping processes...${NC}"

# Kill backend processes
echo "  ├─ Backend processes..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "nodemon.*server" 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Kill bot processes
echo "  ├─ Bot processes..."
pkill -f "node.*bot.js" 2>/dev/null || true
pkill -f "nodemon.*bot" 2>/dev/null || true

# Kill webapp dev server
echo "  ├─ Webapp processes..."
pkill -f "vite" 2>/dev/null || true

# Kill ngrok
echo "  └─ ngrok..."
pkill -x ngrok 2>/dev/null || true

sleep 2

echo ""

# Verify cleanup
REMAINING=$(ps aux | grep -E "node.*(server|bot)|nodemon|vite|ngrok" | grep -v grep | grep -v mcp-server | wc -l)
if [ "$REMAINING" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Warning: $REMAINING project processes still running${NC}"
  echo ""
  echo -e "${BLUE}Active processes:${NC}"
  ps aux | grep -E "node.*(server|bot)|nodemon|vite|ngrok" | grep -v grep | grep -v mcp-server
  echo ""
  echo -e "${YELLOW}Tip: Try running this script again or manually kill with:${NC}"
  echo -e "  ${BLUE}kill -9 <PID>${NC}"
else
  echo -e "${GREEN}✅ All Telegram Shop processes stopped${NC}"
  echo ""
  echo -e "${BLUE}Verify with:${NC}"
  echo -e "  ${BLUE}lsof -ti:3000${NC}  # Should return nothing"
  echo -e "  ${BLUE}pgrep ngrok${NC}    # Should return nothing"
fi

echo ""
