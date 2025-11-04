---
name: production-deploy
description: Pre-deployment checklist - run tests, check UI, verify build, check errors. Use before production release or major deployment.
---

# Production Deploy Skill

Comprehensive pre-deployment checklist to ensure production readiness.

## What this skill does:

1. Runs all tests (backend + bot) with coverage
2. Checks UI/UX compliance (design system)
3. Validates animations performance
4. Analyzes error logs
5. Checks database schema
6. Verifies build succeeds
7. Generates deployment report

## Usage:

Say: **"production check"** or **"deploy check"** or **"pre-deployment"** or **"ready for prod"**

## Full deployment checklist:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║     🚀 Production Deployment Checklist                ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Track failures
FAILED_CHECKS=""

# 1. Health Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1/8: Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check PostgreSQL
if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "✅ PostgreSQL running"
else
  echo "❌ PostgreSQL not running"
  FAILED_CHECKS="$FAILED_CHECKS PostgreSQL"
fi

# Check database exists
if psql -d telegram_shop -c "SELECT 1" >/dev/null 2>&1; then
  echo "✅ Database accessible"
else
  echo "❌ Database not accessible"
  FAILED_CHECKS="$FAILED_CHECKS Database"
fi

echo ""

# 2. Tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2/8: Running Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend tests
cd "$PROJECT_DIR/backend"
if npm run test:coverage >/dev/null 2>&1; then
  coverage=$(cat coverage/coverage-summary.json 2>/dev/null | jq -r '.total.lines.pct' 2>/dev/null)
  echo "✅ Backend tests passed (coverage: ${coverage}%)"
else
  echo "❌ Backend tests failed"
  FAILED_CHECKS="$FAILED_CHECKS BackendTests"
fi

# Bot tests
cd "$PROJECT_DIR/bot"
if npm run test:coverage >/dev/null 2>&1; then
  coverage=$(cat coverage/coverage-summary.json 2>/dev/null | jq -r '.total.lines.pct' 2>/dev/null)
  echo "✅ Bot tests passed (coverage: ${coverage}%)"
else
  echo "❌ Bot tests failed"
  FAILED_CHECKS="$FAILED_CHECKS BotTests"
fi

echo ""

# 3. Linting
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3/8: Code Quality (Linting)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend lint
cd "$PROJECT_DIR/backend"
if npm run lint:check >/dev/null 2>&1; then
  echo "✅ Backend linting passed"
else
  echo "⚠️  Backend linting warnings"
fi

# Bot lint
cd "$PROJECT_DIR/bot"
if npm run lint:check >/dev/null 2>&1; then
  echo "✅ Bot linting passed"
else
  echo "⚠️  Bot linting warnings"
fi

echo ""

# 4. Error Logs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4/8: Error Log Analysis"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

backend_log="$PROJECT_DIR/backend/logs/error-$(date +%Y-%m-%d).log"
bot_log="$PROJECT_DIR/bot/logs/error.log"

backend_errors=$(tail -100 "$backend_log" 2>/dev/null | grep -i error | wc -l | tr -d ' ')
bot_errors=$(tail -100 "$bot_log" 2>/dev/null | grep -i error | wc -l | tr -d ' ')

if [ "$backend_errors" -eq 0 ] && [ "$bot_errors" -eq 0 ]; then
  echo "✅ No recent errors in logs"
elif [ "$backend_errors" -lt 5 ] && [ "$bot_errors" -lt 5 ]; then
  echo "⚠️  Few errors detected (Backend: $backend_errors, Bot: $bot_errors)"
else
  echo "❌ High error count (Backend: $backend_errors, Bot: $bot_errors)"
  FAILED_CHECKS="$FAILED_CHECKS ErrorLogs"
fi

echo ""

# 5. UI/UX Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5/8: UI/UX Design Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

webapp_src="$PROJECT_DIR/webapp/src"

# Check glassmorphism
glass_count=$(grep -r "glass-card\|glass-elevated" "$webapp_src" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$glass_count" -gt 10 ]; then
  echo "✅ Glassmorphism design system used ($glass_count components)"
else
  echo "⚠️  Limited glassmorphism usage ($glass_count components)"
fi

# Check brand color
orange_count=$(grep -r "#FF6B00" "$webapp_src" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$orange_count" -gt 5 ]; then
  echo "✅ Brand color present"
else
  echo "⚠️  Brand color underused"
fi

echo ""

# 6. Animation Performance
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6/8: Animation Performance"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for performance anti-patterns
width_anim=$(grep -r "animate.*width\|animate.*height" "$webapp_src" --include="*.jsx" 2>/dev/null | grep -v "transform" | wc -l | tr -d ' ')
if [ "$width_anim" -eq 0 ]; then
  echo "✅ No width/height animations (good performance)"
else
  echo "⚠️  Found $width_anim non-GPU-accelerated animations"
fi

echo ""

# 7. Build Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7/8: Production Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$PROJECT_DIR/webapp"
if npm run build >/dev/null 2>&1; then
  build_size=$(du -sh dist 2>/dev/null | cut -f1)
  echo "✅ Webapp builds successfully (size: $build_size)"
else
  echo "❌ Webapp build failed"
  FAILED_CHECKS="$FAILED_CHECKS WebappBuild"
fi

echo ""

# 8. Security Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8/8: Security Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for exposed secrets in code
secrets_found=$(grep -r "sk_\|pk_\|api_key\|password.*=.*['\"]" "$PROJECT_DIR" --include="*.js" --include="*.jsx" --exclude-dir=node_modules 2>/dev/null | grep -v "process.env" | wc -l | tr -d ' ')

if [ "$secrets_found" -eq 0 ]; then
  echo "✅ No hardcoded secrets detected"
else
  echo "⚠️  Possible hardcoded secrets found ($secrets_found occurrences)"
  echo "   Review carefully before deploying!"
fi

# Check .env files exist
if [ -f "$PROJECT_DIR/backend/.env" ] && [ -f "$PROJECT_DIR/bot/.env" ] && [ -f "$PROJECT_DIR/webapp/.env" ]; then
  echo "✅ All .env files present"
else
  echo "❌ Missing .env files"
  FAILED_CHECKS="$FAILED_CHECKS EnvFiles"
fi

echo ""

# Final Report
echo "╔════════════════════════════════════════════════════════╗"
echo "║                 Deployment Report                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

if [ -z "$FAILED_CHECKS" ]; then
  echo "🎉 ALL CHECKS PASSED!"
  echo ""
  echo "✅ Ready for production deployment"
  echo ""
  echo "Next steps:"
  echo "  1. Commit changes: git add . && git commit"
  echo "  2. Push to repo: git push origin main"
  echo "  3. Deploy to production server"
  echo "  4. Run health-check on production"
  echo "  5. Monitor logs for first 30 minutes"
  exit 0
else
  echo "❌ DEPLOYMENT BLOCKED - Failed checks:"
  echo ""
  for check in $FAILED_CHECKS; do
    echo "  ❌ $check"
  done
  echo ""
  echo "Fix these issues before deploying!"
  exit 1
fi
```

## What this skill checks:

### ✅ Must Pass:
1. **PostgreSQL** - Running and accessible
2. **Database** - telegram_shop exists and accessible
3. **Backend Tests** - All passing
4. **Bot Tests** - All passing
5. **Webapp Build** - Builds without errors
6. **No Critical Errors** - Error logs clean

### ⚠️ Warnings (can deploy with caution):
1. **Linting** - Code style warnings
2. **UI Design** - Design system usage
3. **Animation Performance** - Non-GPU animations
4. **Secrets Check** - Possible exposed secrets

## Pre-deployment manual checks:

Before running this skill, manually verify:

1. **Environment Variables**
   - [ ] All .env files have production values
   - [ ] Database credentials correct
   - [ ] Bot token is production token (not test)
   - [ ] API keys are production keys

2. **Database**
   - [ ] Migrations applied
   - [ ] Backup created
   - [ ] Schema matches production

3. **Bot Configuration**
   - [ ] Webhook URL set (if using webhooks)
   - [ ] Bot commands updated (@BotFather)
   - [ ] Mini App URL configured

4. **ngrok Alternative**
   - [ ] Production uses real domain (not ngrok!)
   - [ ] SSL certificate valid
   - [ ] DNS configured

## When to use:

- 🚀 Before every production deploy
- 🚀 Before major release
- 🚀 After significant refactoring
- 🚀 Before demo/presentation
- 🚀 Weekly quality check

## After deployment:

1. Run health-check on production server
2. Monitor logs: `tail -f backend/logs/combined.log`
3. Test critical user flows manually
4. Check payment processing
5. Monitor error rates

## Pro tips:

- Run this skill 1 hour before actual deployment
- Fix all ❌ failures before deploying
- Warnings (⚠️) can be accepted if understood
- Always have database backup before deploy
- Test on staging environment first if available
