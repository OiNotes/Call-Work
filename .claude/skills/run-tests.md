# Run Tests Skill

Execute all test suites (Backend, Bot) with detailed coverage reports.

## What this skill does:

1. Runs Backend tests with coverage
2. Runs Bot tests with coverage
3. Shows coverage summary
4. Highlights failing tests
5. Generates coverage badges

## Usage:

Say: **"run tests"** or **"test everything"** or **"check coverage"** or **"test all"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "=== Running All Tests ==="
echo ""

# Backend tests
echo "1. Backend Tests:"
cd "$PROJECT_DIR/backend"
if npm test -- --coverage --silent; then
  echo "  ✅ All backend tests passed"
else
  echo "  ❌ Some backend tests failed"
fi

# Show backend coverage
if [ -f "coverage/coverage-summary.json" ]; then
  echo "  Coverage:"
  cat coverage/coverage-summary.json | jq -r '.total | "    Lines: \(.lines.pct)% | Statements: \(.statements.pct)% | Branches: \(.branches.pct)%"'
fi

# Bot tests
echo ""
echo "2. Bot Tests:"
cd "$PROJECT_DIR/bot"
if npm test -- --coverage --silent; then
  echo "  ✅ All bot tests passed"
else
  echo "  ❌ Some bot tests failed"
fi

# Show bot coverage
if [ -f "coverage/coverage-summary.json" ]; then
  echo "  Coverage:"
  cat coverage/coverage-summary.json | jq -r '.total | "    Lines: \(.lines.pct)% | Statements: \(.statements.pct)% | Branches: \(.branches.pct)%"'
fi

echo ""
echo "=== Test Summary ==="
```

## Coverage thresholds:

- ✅ **Green:** >80% coverage
- ⚠️ **Yellow:** 60-80% coverage
- ❌ **Red:** <60% coverage

## Automatic actions:

If tests fail, Claude will:
1. Show failed test details
2. Identify the issue
3. Suggest fixes
4. Optionally fix and re-run

## Test types covered:

**Backend:**
- Unit tests (controllers, services, models)
- Integration tests (API endpoints)
- Database tests (queries, transactions)

**Bot:**
- Unit tests (handlers, helpers)
- Integration tests (full user flows)
- Mock Telegram API tests

## When to use:

- 🧪 Before commit
- 🧪 In CI/CD pipeline
- 🧪 After refactoring
- 🧪 Periodic quality check
- 🧪 Before production release
