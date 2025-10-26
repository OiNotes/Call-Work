#!/bin/bash

#############################################
# Telegram Shop - Stop Script
# Остановка всех сервисов
#############################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                    ║${NC}"
echo -e "${RED}║     🛑 Telegram Shop - Stopping Services          ║${NC}"
echo -e "${RED}║                                                    ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Stop processes on port 3000
if lsof -ti:3000 >/dev/null 2>&1; then
  echo -e "${YELLOW}Stopping Backend...${NC}"
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} Backend stopped"
else
  echo -e "  ${BLUE}ℹ${NC} No backend process running"
fi

# Stop ngrok
if pgrep -x "ngrok" >/dev/null; then
  echo -e "${YELLOW}Stopping ngrok...${NC}"
  pkill -x ngrok 2>/dev/null || true
  echo -e "  ${GREEN}✓${NC} ngrok stopped"
else
  echo -e "  ${BLUE}ℹ${NC} No ngrok process running"
fi

echo ""
echo -e "${GREEN}✓ All services stopped${NC}"
echo ""
