---
name: run-tests
description: Run Backend and Bot test suites with coverage reports. Use before commits, in CI/CD, or when validating changes.
---

# Run Tests Skill

Execute all test suites (Backend, Bot) with detailed coverage reports.

## What this skill does:

1. Runs Backend tests with coverage
2. Runs Bot tests with coverage
3. Shows coverage summary
4. Highlights failing tests
5. Reports overall status

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

# Run with coverage
if npm run test:coverage; then
  echo "  ✅ All backend tests passed"

  # Show coverage if available
  if [ -f "coverage/coverage-summary.json" ]; then
    echo "  📊 Coverage:"
    cat coverage/coverage-summary.json | jq -r '.total | "    Lines: \(.lines.pct)% | Statements: \(.statements.pct)% | Branches: \(.branches.pct)% | Functions: \(.functions.pct)%"' 2>/dev/null || echo "    (jq not installed - can't parse coverage)"
  fi
else
  echo "  ❌ Some backend tests failed"
  BACKEND_FAILED=1
fi

echo ""

# Bot tests
echo "2. Bot Tests:"
cd "$PROJECT_DIR/bot"

# Run with coverage
if npm run test:coverage; then
  echo "  ✅ All bot tests passed"

  # Show coverage if available
  if [ -f "coverage/coverage-summary.json" ]; then
    echo "  📊 Coverage:"
    cat coverage/coverage-summary.json | jq -r '.total | "    Lines: \(.lines.pct)% | Statements: \(.statements.pct)% | Branches: \(.branches.pct)% | Functions: \(.functions.pct)%"' 2>/dev/null || echo "    (jq not installed - can't parse coverage)"
  fi
else
  echo "  ❌ Some bot tests failed"
  BOT_FAILED=1
fi

echo ""
echo "=== Test Summary ==="

if [ -z "$BACKEND_FAILED" ] && [ -z "$BOT_FAILED" ]; then
  echo "✅ All tests passed!"
  exit 0
else
  echo "❌ Some tests failed. See details above."
  exit 1
fi
```

## Coverage thresholds:

- ✅ **Green:** >80% coverage
- ⚠️ **Yellow:** 60-80% coverage
- ❌ **Red:** <60% coverage

## Test types covered:

### Backend Tests:

- **Unit tests:** Controllers, services, models
- **Integration tests:** API endpoints with supertest
- **Database tests:** Queries, transactions

Located in: `backend/__tests__/`

### Bot Tests:

- **Unit tests:** Handlers, helpers, tools
- **Integration tests:** Full user flows
- **Mock tests:** Telegram API mocking

Located in: `bot/tests/`

## Available test commands:

### Backend:

```bash
npm test                    # Run all tests
npm run test:coverage       # Run with coverage
npm run test:watch          # Watch mode
npm run test:ci             # CI mode (with migrations)
```

### Bot:

```bash
npm test                    # Run all tests
npm run test:coverage       # Run with coverage
npm run test:watch          # Watch mode
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e            # E2E tests only
```

## Automatic actions:

If tests fail, Claude will:

1. Show failed test details
2. Read test file to understand what's being tested
3. Identify the issue (logic error, outdated test, API change)
4. Suggest fixes
5. Optionally fix and re-run

## Common test failure reasons:

1. **API contract changed** - Update test expectations
2. **Database state dirty** - Tests aren't cleaning up
3. **Mock outdated** - Update mocks to match real API
4. **Timeout** - Increase timeout for slow operations
5. **Environment** - Missing .env variables in test env

## Before commit workflow:

```bash
# 1. Run linters
cd backend && npm run lint:check
cd ../bot && npm run lint:check

# 2. Run tests (this skill)
"run tests"

# 3. Check UI (if frontend changes)
"ui check"

# 4. Check animations (if UI changes)
"animation check"

# 5. If all pass → commit!
git add .
git commit -m "feat: your changes"
```

## When to use:

- 🧪 Before every commit
- 🧪 After refactoring code
- 🧪 In CI/CD pipeline
- 🧪 Periodic quality check (daily)
- 🧪 Before production release
- 🧪 After fixing bugs (to prevent regression)

## Pro tips:

- Run tests in watch mode during development: `npm run test:watch`
- Focus on specific test: `npm test -- tests/unit/myfile.test.js`
- Update snapshots: `npm test -- -u` (if using snapshot testing)
- Check coverage report in browser: `open backend/coverage/lcov-report/index.html`
