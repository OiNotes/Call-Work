---
name: test-integration
description: Run Bot integration tests with full user flow testing. Use before deploying bot changes or when testing end-to-end scenarios.
---

# Test Integration Skill

Run Telegram Bot integration tests with detailed reporting.

## What this skill does:

1. Checks if Backend is running (required for tests)
2. Runs bot integration tests
3. Shows test results
4. Reports failures with details

## Usage:

Say: **"test bot"** or **"integration tests"** or **"test telegram"** or **"bot tests"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "=== Bot Integration Tests ==="
echo ""

# Check if backend is running (required for API calls in tests)
if ! curl -s http://localhost:3000/health >/dev/null 2>&1; then
  echo "⚠️  Backend is not running. Starting backend for tests..."

  cd "$PROJECT_DIR/backend"
  npm run dev > ../logs/backend.log 2>&1 &
  BACKEND_PID=$!

  echo "Waiting for backend to start..."
  sleep 5

  if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "✅ Backend started"
  else
    echo "❌ Failed to start backend. Tests may fail."
  fi
else
  echo "✅ Backend already running"
fi

echo ""

# Run integration tests
echo "Running bot integration tests..."
cd "$PROJECT_DIR/bot"

if npm run test:integration; then
  echo ""
  echo "✅ All integration tests passed"
  TEST_SUCCESS=1
else
  echo ""
  echo "❌ Some integration tests failed"
  TEST_FAILED=1
fi

# Cleanup if we started backend
if [ -n "$BACKEND_PID" ]; then
  echo ""
  echo "Cleaning up test backend..."
  kill $BACKEND_PID 2>/dev/null || true
fi

echo ""
echo "=== Test Complete ==="

if [ -n "$TEST_SUCCESS" ]; then
  exit 0
else
  exit 1
fi
```

## Test scenarios covered:

### User flows:

- 👤 User registration and authentication
- 🏪 Shop creation and management
- 📦 Product CRUD operations
- 🛒 Order placement
- 💰 Payment verification
- 🔔 Subscription management

### Bot interactions:

- Button clicks (callback queries)
- Text input handling
- Scene transitions
- Session management
- Error handling
- WebApp button functionality

## Test data:

Tests use fixtures from:

- `bot/tests/fixtures/` (if exists)
- Mock data generated in test files

## When to use:

- 🤖 After changes in bot handlers
- 🤖 Before release
- 🤖 After Telegraf.js updates
- 🤖 Regression testing
- 🤖 When user reports bot issues
- 🤖 In CI/CD pipeline

## Available bot test commands:

```bash
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests (this skill)
npm run test:e2e            # E2E tests
npm run test:coverage       # With coverage
npm run test:watch          # Watch mode
```

## Pro tips:

- Integration tests require Backend running
- Tests may take 30-60 seconds (they hit real API endpoints)
- Use `npm run test:unit` for faster feedback during development
- Check test logs if failures: `bot/tests/integration/*.test.js`
