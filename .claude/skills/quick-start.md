---
name: quick-start
description: Start Backend, Bot, WebApp with ngrok tunnel using start.sh script. Use when starting project, after git pull, or morning startup.
---

# Quick Start Skill

Instantly start the entire Status Stock 4.0 stack using the professional start.sh script.

## What this skill does:

1. Stops all existing processes (backend, bot, webapp, ngrok)
2. Starts ngrok tunnel and gets public URL
3. Updates .env files in backend/bot/webapp with ngrok URL
4. Rebuilds webapp with new URL
5. Starts Backend on port 3000
6. Starts Telegram Bot
7. Monitors logs for errors

## Usage:

Simply say: **"quick start"** or **"start everything"** or **"start project"**

## Commands:

```bash
cd "/Users/sile/Documents/Status Stock 4.0"

# Use the professional start script
./start.sh
```

## Success indicators:

- ✅ **ngrok:** Public URL displayed (e.g., https://abc123.ngrok.io)
- ✅ **Backend:** "Server running on port 3000"
- ✅ **Bot:** "Bot started successfully"
- ✅ **Webapp:** Built successfully with new ngrok URL

## What start.sh does automatically:

1. **Cleanup:** Kills all existing processes on ports 3000, ngrok
2. **ngrok:** Starts tunnel and waits for public URL
3. **Config:** Updates WEBAPP_URL in backend/.env, bot/.env, webapp/.env
4. **Build:** Rebuilds webapp with new ngrok URL
5. **Backend:** Starts with nodemon on port 3000
6. **Bot:** Starts Telegram bot with new webapp URL
7. **Monitoring:** Creates logs in logs/ directory

## Logs location:

- Backend: `logs/backend.log`
- Bot: `logs/bot.log`
- Webapp build: `logs/webapp-build.log`
- ngrok: `logs/ngrok.log`

## Automatic error handling:

If errors occur, Claude will:

1. Read appropriate log file from logs/ directory
2. Identify the issue (PostgreSQL, ngrok, build error, etc.)
3. Fix it automatically (start PostgreSQL, restart ngrok, fix dependencies)
4. Restart the service using ./start.sh

## When to use:

- ⚡ First launch after cloning
- ⚡ Morning startup
- ⚡ After pulling new changes
- ⚡ After system reboot
- ⚡ When ngrok URL expired

## Important:

This project **REQUIRES ngrok** for Telegram Mini App to work. Never use `npm run dev:all` directly - always use `./start.sh` which handles ngrok tunnel automatically.
