---
name: analyze-logs
description: Analyze Backend and Bot error logs with categorization and pattern detection. Use when debugging errors or monitoring system health.
---

# Analyze Logs Skill

Intelligent analysis of error logs from Backend and Bot with pattern detection.

## What this skill does:

1. Reads Backend error logs (daily files: error-YYYY-MM-DD.log)
2. Reads Bot error logs (single file: error.log)
3. Categorizes errors by type
4. Finds most frequent errors
5. Identifies error patterns
6. Suggests fixes for common issues

## Usage:

Say: **"analyze logs"** or **"check errors"** or **"what's wrong"** or **"show errors"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "=== Log Analysis Report ==="
echo ""

# Backend errors (daily log with date)
echo "1. Backend Errors (last 200 lines):"
backend_log="$PROJECT_DIR/backend/logs/error-$(date +%Y-%m-%d).log"
if [ -f "$backend_log" ]; then
  backend_count=$(tail -200 "$backend_log" | grep -c -E "(error|Error|ERROR)")
  echo "   Total: $backend_count errors"

  if [ "$backend_count" -gt 0 ]; then
    echo "   Top 5 errors:"
    tail -200 "$backend_log" | grep -E "(error|Error|ERROR)" | \
      sed 's/.*error[:]* //' | \
      cut -d' ' -f1-10 | \
      sort | uniq -c | sort -rn | head -5 | \
      sed 's/^/     /'
  else
    echo "   ✅ No errors in last 200 lines"
  fi
else
  echo "   ℹ️  No error log file found for today"
fi

# Bot errors (single error.log)
echo ""
echo "2. Bot Errors (last 200 lines):"
bot_log="$PROJECT_DIR/bot/logs/error.log"
if [ -f "$bot_log" ]; then
  bot_count=$(tail -200 "$bot_log" | grep -c -E "(error|Error|ERROR)")
  echo "   Total: $bot_count errors"

  if [ "$bot_count" -gt 0 ]; then
    echo "   Top 5 errors:"
    tail -200 "$bot_log" | grep -E "(error|Error|ERROR)" | \
      sed 's/.*error[:]* //' | \
      cut -d' ' -f1-10 | \
      sort | uniq -c | sort -rn | head -5 | \
      sed 's/^/     /'
  else
    echo "   ✅ No errors in last 200 lines"
  fi
else
  echo "   ℹ️  No error log file found"
fi

# Common error patterns across both logs
echo ""
echo "3. Common Error Patterns:"
{
  tail -200 "$backend_log" 2>/dev/null | grep -E "(error|Error|ERROR)"
  tail -200 "$bot_log" 2>/dev/null | grep -E "(error|Error|ERROR)"
} | \
  grep -oE "(ECONNREFUSED|EADDRINUSE|Cannot find module|undefined is not|syntax error|SequelizeDatabaseError|ValidationError|ETIMEDOUT|ENOTFOUND|401|403|404|500)" | \
  sort | uniq -c | sort -rn | head -5 | \
  sed 's/^/   /'

# ngrok-specific errors (important for this project!)
echo ""
echo "4. ngrok-related issues:"
ngrok_log="$PROJECT_DIR/logs/ngrok.log"
if [ -f "$ngrok_log" ]; then
  ngrok_errors=$(tail -100 "$ngrok_log" 2>/dev/null | grep -i -c "error\|failed\|timeout")
  if [ "$ngrok_errors" -gt 0 ]; then
    echo "   ⚠️  Found $ngrok_errors ngrok errors/warnings"
    tail -100 "$ngrok_log" | grep -i "error\|failed\|timeout" | tail -3 | sed 's/^/     /'
  else
    echo "   ✅ ngrok tunnel healthy"
  fi
else
  echo "   ℹ️  No ngrok log found"
fi

echo ""
echo "=== End of Analysis ==="
```

## Error categories Claude recognizes:

### Network Errors:

- **ECONNREFUSED:** Backend/Database not running
- **ETIMEDOUT:** Request timeout (slow response)
- **ENOTFOUND:** DNS lookup failed
- **EADDRINUSE:** Port already in use

### Application Errors:

- **Cannot find module:** Missing dependency or wrong import path
- **undefined is not:** Runtime error (accessing property on undefined)
- **syntax error:** Code syntax issue
- **ValidationError:** Data validation failed

### HTTP Errors:

- **401:** Unauthorized (JWT token issue)
- **403:** Forbidden (permission denied)
- **404:** Not found (wrong endpoint)
- **500:** Internal server error

### Database Errors:

- **SequelizeDatabaseError:** SQL query failed (but this project uses pg, not Sequelize)
- **relation does not exist:** Table/column not found

## Log file locations:

- **Backend errors:** `backend/logs/error-YYYY-MM-DD.log` (daily rotation)
- **Backend combined:** `backend/logs/combined-YYYY-MM-DD.log` (all logs)
- **Bot errors:** `bot/logs/error.log` (single file)
- **Bot combined:** `bot/logs/combined.log` (all logs)
- **ngrok:** `logs/ngrok.log`
- **Backend startup:** `logs/backend.log`
- **Bot startup:** `logs/bot.log`

## Automatic actions:

After analysis, Claude will:

1. Identify the root cause
2. Check if error is in top 5 patterns
3. Suggest specific fixes based on error type:
   - EADDRINUSE → use check-ports skill
   - ECONNREFUSED → check if PostgreSQL running
   - ngrok errors → restart with ./start.sh
   - Module errors → npm install
4. Optionally apply fixes automatically using fix-errors skill

## When to use:

- 🔍 When something broke
- 🔍 Periodic monitoring (every hour during development)
- 🔍 After deployment
- 🔍 In CI/CD for failure analysis
- 🔍 Before fixing errors (to understand scope)
- 🔍 After user reports issue

## Pro tips:

- Check combined.log for full context: `tail -f backend/logs/combined-YYYY-MM-DD.log`
- Bot error.log can grow large (90MB+ seen!). Rotate if needed: `> bot/logs/error.log`
- ngrok errors often mean tunnel expired - just restart with ./start.sh
