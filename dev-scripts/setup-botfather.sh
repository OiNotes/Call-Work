#!/bin/bash

echo "🤖 BotFather Configuration Helper"
echo "================================="
echo ""
echo "📋 Steps to configure your bot:"
echo ""
echo "1. Open Telegram and find @BotFather"
echo "2. Send: /mybots"
echo "3. Select your bot"
echo "4. Choose: Bot Settings → Menu Button"
echo "5. Send button text: 📱 Открыть Menu"
echo ""
echo "6. Send WebApp URL (copy from below):"
echo ""

# Get webapp URL from .env
if [ -f "webapp/.env" ]; then
    WEBAPP_URL=$(grep VITE_API_URL webapp/.env | cut -d'=' -f2 | sed 's|/api||')
    echo "   ${WEBAPP_URL}"
    echo ""
    echo "   (This URL is from webapp/.env)"
else
    echo "   ⚠️  webapp/.env not found. Run 'npm run dev:ngrok' first"
fi

echo ""
echo "✅ After setting the menu button, test it:"
echo "   - Open your bot in Telegram"
echo "   - Click the menu button (bottom left)"
echo "   - WebApp should open"
echo ""
