# Analyze Logs Skill

Intelligent analysis of error logs from Backend, Bot, and WebApp.

## What this skill does:

1. Reads error logs from all services
2. Categorizes errors by type
3. Finds most frequent errors
4. Identifies error patterns
5. Suggests fixes for common issues

## Usage:

Say: **"analyze logs"** or **"check errors"** or **"what's wrong"** or **"show errors"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "=== Log Analysis Report ==="
echo ""

# Backend errors
echo "1. Backend Errors (last 200 lines):"
backend_log="$PROJECT_DIR/backend/logs/error-$(date +%Y-%m-%d).log"
if [ -f "$backend_log" ]; then
  backend_count=$(tail -200 "$backend_log" | grep -c -E "(error|Error|ERROR)")
  echo "   Total: $backend_count errors"
  echo "   Top errors:"
  tail -200 "$backend_log" | grep -E "(error|Error|ERROR)" | \
    sed 's/.*error[:]* //' | \
    cut -d' ' -f1-10 | \
    sort | uniq -c | sort -rn | head -5 | \
    sed 's/^/     /'
else
  echo "   No error log file found for today"
fi

# Bot errors
echo ""
echo "2. Bot Errors (last 200 lines):"
bot_log="$PROJECT_DIR/bot/logs/error.log"
if [ -f "$bot_log" ]; then
  bot_count=$(tail -200 "$bot_log" | grep -c -E "(error|Error|ERROR)")
  echo "   Total: $bot_count errors"
  echo "   Top errors:"
  tail -200 "$bot_log" | grep -E "(error|Error|ERROR)" | \
    sed 's/.*error[:]* //' | \
    cut -d' ' -f1-10 | \
    sort | uniq -c | sort -rn | head -5 | \
    sed 's/^/     /'
else
  echo "   No error log file found"
fi

# Common error patterns
echo ""
echo "3. Common Error Patterns:"
{
  tail -200 "$backend_log" 2>/dev/null | grep -E "(error|Error|ERROR)"
  tail -200 "$bot_log" 2>/dev/null | grep -E "(error|Error|ERROR)"
} | \
  grep -oE "(ECONNREFUSED|EADDRINUSE|Cannot find module|undefined is not|syntax error|SequelizeDatabaseError|ValidationError)" | \
  sort | uniq -c | sort -rn | head -5 | \
  sed 's/^/   /'

echo ""
echo "=== End of Analysis ==="
```

## Error categories Claude recognizes:

- **Import/Export errors:** "Cannot find module", "default export not found"
- **Database errors:** "ECONNREFUSED", "relation does not exist"
- **Port conflicts:** "EADDRINUSE"
- **Runtime errors:** "undefined is not a function", "null is not an object"
- **Validation errors:** "ValidationError", "required field missing"

## Automatic actions:

After analysis, Claude will:
1. Identify the root cause
2. Suggest specific fixes
3. Optionally apply fixes automatically

## When to use:

- 🔍 When something broke
- 🔍 Periodic monitoring
- 🔍 After deployment
- 🔍 In CI/CD for failure analysis
- 🔍 Before fixing errors
