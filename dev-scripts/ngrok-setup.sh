#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Status Stock 4.0 with ngrok...${NC}\n"

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}❌ ngrok is not installed!${NC}"
    echo "Install it: brew install ngrok (macOS) or https://ngrok.com/download"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo -e "${YELLOW}⚠️  PostgreSQL is not running. Starting it...${NC}"
    if command -v brew &> /dev/null; then
        brew services start postgresql@15
        sleep 2
    else
        echo -e "${RED}❌ Please start PostgreSQL manually${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ PostgreSQL is running${NC}\n"

# Create logs directory if it doesn't exist
mkdir -p logs

# Start backend in background
echo -e "${BLUE}📦 Starting backend (port 3000)...${NC}"
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 3

# Start webapp in background
echo -e "${BLUE}🎨 Starting webapp (port 5173)...${NC}"
cd webapp
npm run dev > ../logs/webapp.log 2>&1 &
WEBAPP_PID=$!
cd ..
sleep 3

# Start ngrok for backend
echo -e "${BLUE}🌐 Starting ngrok tunnel for backend...${NC}"
ngrok http 3000 --log=stdout > logs/ngrok-backend.log 2>&1 &
NGROK_BACKEND_PID=$!
sleep 3

# Start ngrok for webapp
echo -e "${BLUE}🌐 Starting ngrok tunnel for webapp...${NC}"
ngrok http 5173 --log=stdout > logs/ngrok-webapp.log 2>&1 &
NGROK_WEBAPP_PID=$!
sleep 3

# Update .env files with ngrok URLs
echo -e "${BLUE}📝 Updating .env files with ngrok URLs...${NC}"
node dev-scripts/update-env.js

# Show status
echo -e "\n${GREEN}✅ All services started!${NC}\n"
echo -e "${YELLOW}📊 Process IDs:${NC}"
echo "   Backend:       $BACKEND_PID"
echo "   WebApp:        $WEBAPP_PID"
echo "   Ngrok Backend: $NGROK_BACKEND_PID"
echo "   Ngrok WebApp:  $NGROK_WEBAPP_PID"

echo -e "\n${YELLOW}📋 Logs:${NC}"
echo "   Backend: tail -f logs/backend.log"
echo "   WebApp:  tail -f logs/webapp.log"
echo "   Ngrok:   http://localhost:4040 (web interface)"

# Trap to cleanup on exit
function cleanup {
    echo -e "\n${YELLOW}🛑 Stopping all services...${NC}"
    kill $BACKEND_PID $WEBAPP_PID $NGROK_BACKEND_PID $NGROK_WEBAPP_PID 2>/dev/null
    echo -e "${GREEN}✅ All services stopped${NC}"
}

trap cleanup EXIT

# Wait for user interrupt
echo -e "\n${BLUE}Press Ctrl+C to stop all services${NC}\n"
wait
