#!/bin/bash

#############################################
# Telegram Shop - Full Stack Startup Script
# Автоматический запуск Backend + Bot + ngrok
#############################################

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create logs directory
mkdir -p "$LOG_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                    ║${NC}"
echo -e "${BLUE}║     🚀 Telegram Shop - Full Stack Startup         ║${NC}"
echo -e "${BLUE}║                                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

#############################################
# Step 1: Kill existing processes
#############################################
echo -e "${YELLOW}[1/6]${NC} Stopping existing processes..."

# Kill processes on port 3000
if lsof -ti:3000 >/dev/null 2>&1; then
  echo "  └─ Killing processes on port 3000..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

# Kill ngrok
if pgrep -x "ngrok" >/dev/null; then
  echo "  └─ Stopping ngrok..."
  pkill -x ngrok 2>/dev/null || true
  sleep 2
fi

echo -e "  ${GREEN}✓${NC} Cleanup complete"
echo ""

#############################################
# Step 2: Start ngrok tunnel
#############################################
echo -e "${YELLOW}[2/6]${NC} Starting ngrok tunnel..."

ngrok http 3000 --log=stdout > "$LOG_DIR/ngrok.log" 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start
echo "  └─ Waiting for ngrok to initialize..."
sleep 3

# Get ngrok URL
NGROK_URL=""
for i in {1..10}; do
  if NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4); then
    if [ -n "$NGROK_URL" ]; then
      echo -e "  ${GREEN}✓${NC} ngrok URL: ${GREEN}$NGROK_URL${NC}"
      break
    fi
  fi
  sleep 1
done

if [ -z "$NGROK_URL" ]; then
  echo -e "  ${RED}✗${NC} Failed to get ngrok URL"
  echo -e "  ${YELLOW}!${NC} Check if ngrok is installed: ${BLUE}brew install ngrok${NC}"
  exit 1
fi

echo ""

#############################################
# Step 3: Update .env files with ngrok URL
#############################################
echo -e "${YELLOW}[3/6]${NC} Updating configuration files..."

# Update backend/.env
if [ -f "$PROJECT_ROOT/backend/.env" ]; then
  sed -i '' "s|FRONTEND_URL=.*|FRONTEND_URL=$NGROK_URL|g" "$PROJECT_ROOT/backend/.env"
  sed -i '' "s|WEBAPP_URL=.*|WEBAPP_URL=$NGROK_URL|g" "$PROJECT_ROOT/backend/.env"
  echo -e "  ${GREEN}✓${NC} Updated backend/.env"
else
  echo -e "  ${RED}✗${NC} backend/.env not found"
  exit 1
fi

# Update bot/.env
if [ -f "$PROJECT_ROOT/bot/.env" ]; then
  sed -i '' "s|WEBAPP_URL=.*|WEBAPP_URL=$NGROK_URL|g" "$PROJECT_ROOT/bot/.env"
  echo -e "  ${GREEN}✓${NC} Updated bot/.env"
else
  echo -e "  ${RED}✗${NC} bot/.env not found"
  exit 1
fi

# Update webapp/.env
if [ -f "$PROJECT_ROOT/webapp/.env" ]; then
  sed -i '' "s|VITE_API_URL=.*|VITE_API_URL=$NGROK_URL/api|g" "$PROJECT_ROOT/webapp/.env"
  echo -e "  ${GREEN}✓${NC} Updated webapp/.env"
else
  echo -e "  ${RED}✗${NC} webapp/.env not found"
  exit 1
fi

echo ""

#############################################
# Step 4: Rebuild webapp with new URL
#############################################
echo -e "${YELLOW}[4/6]${NC} Rebuilding webapp..."

cd "$PROJECT_ROOT/webapp"
npm run build > "$LOG_DIR/webapp-build.log" 2>&1

if [ $? -eq 0 ]; then
  echo -e "  ${GREEN}✓${NC} Webapp built successfully"
else
  echo -e "  ${RED}✗${NC} Webapp build failed"
  echo -e "  ${YELLOW}!${NC} Check logs: ${BLUE}cat $LOG_DIR/webapp-build.log${NC}"
  exit 1
fi

echo ""

#############################################
# Step 5: Start Backend
#############################################
echo -e "${YELLOW}[5/6]${NC} Starting Backend..."

cd "$PROJECT_ROOT/backend"
npm run dev > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

echo "  └─ Waiting for backend to initialize..."
sleep 5

# Check if backend started successfully
if lsof -ti:3000 >/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} Backend running on port 3000"
else
  echo -e "  ${RED}✗${NC} Backend failed to start"
  echo -e "  ${YELLOW}!${NC} Check logs: ${BLUE}tail -f $LOG_DIR/backend.log${NC}"
  exit 1
fi

echo ""

#############################################
# Step 6: Start Telegram Bot
#############################################
echo -e "${YELLOW}[6/7]${NC} Starting Telegram Bot..."

cd "$PROJECT_ROOT/bot"
npm start > "$LOG_DIR/bot.log" 2>&1 &
BOT_PID=$!

echo "  └─ Waiting for bot to initialize..."
sleep 3

# Check logs for bot startup
if grep -q "Bot started successfully" "$LOG_DIR/bot.log" 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Telegram Bot started"
else
  echo -e "  ${YELLOW}!${NC} Bot may not have started - check logs"
fi

echo ""

#############################################
# Step 7: Summary
#############################################
echo -e "${YELLOW}[7/7]${NC} Startup complete!"
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   🎉 READY!                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Services:${NC}"
echo -e "  ├─ Backend API:     ${BLUE}http://localhost:3000/api${NC}"
echo -e "  ├─ WebApp (ngrok):  ${BLUE}$NGROK_URL${NC}"
echo -e "  ├─ Health Check:    ${BLUE}http://localhost:3000/health${NC}"
echo -e "  └─ ngrok Dashboard: ${BLUE}http://localhost:4040${NC}"
echo ""
echo -e "${GREEN}Logs:${NC}"
echo -e "  ├─ Backend: ${BLUE}tail -f $LOG_DIR/backend.log${NC}"
echo -e "  ├─ Bot:     ${BLUE}tail -f $LOG_DIR/bot.log${NC}"
echo -e "  ├─ Webapp:  ${BLUE}cat $LOG_DIR/webapp-build.log${NC}"
echo -e "  └─ ngrok:   ${BLUE}tail -f $LOG_DIR/ngrok.log${NC}"
echo ""
echo -e "${GREEN}Process IDs:${NC}"
echo -e "  ├─ ngrok:   ${BLUE}$NGROK_PID${NC}"
echo -e "  ├─ Backend: ${BLUE}$BACKEND_PID${NC}"
echo -e "  └─ Bot:     ${BLUE}$BOT_PID${NC}"
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo -e "  ${BLUE}./stop.sh${NC} or ${BLUE}lsof -ti:3000 | xargs kill -9 && pkill ngrok${NC}"
echo ""
echo -e "${GREEN}Telegram Bot:${NC}"
echo -e "  └─ Open Telegram → Find your bot → Click Menu Button${NC}"
echo ""
