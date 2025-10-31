# Test Integration Skill

Run Telegram Bot integration tests with detailed reporting.

## What this skill does:

1. Sets up test database
2. Runs integration tests
3. Shows test results
4. Cleans up test data
5. Reports failures

## Usage:

Say: **"test bot"** or **"integration tests"** or **"test telegram"** or **"bot tests"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0"

echo "=== Bot Integration Tests ==="
echo ""

cd "$PROJECT_DIR/bot"

# Check if backend is running
if ! curl -s http://localhost:3000/health >/dev/null; then
  echo "⚠️ Warning: Backend is not running"
  echo "Starting backend for tests..."
  cd "$PROJECT_DIR/backend"
  npm start &
  BACKEND_PID=$!
  sleep 3
  cd "$PROJECT_DIR/bot"
fi

# Run integration tests
echo "Running integration tests..."
if npm run test:integration; then
  echo "✅ All integration tests passed"
else
  echo "❌ Some integration tests failed"
fi

# Cleanup
if [ -n "$BACKEND_PID" ]; then
  echo "Stopping test backend..."
  kill $BACKEND_PID
fi

echo ""
echo "=== Test Complete ==="
```

## Test scenarios covered:

**User flows:**
- 👤 User registration flow
- 🏪 Shop creation flow
- 📦 Product CRUD operations
- 🛒 Order placement
- 💰 Payment verification
- 🔔 Subscription management

**Bot interactions:**
- Button clicks (callback queries)
- Text input handling
- Scene transitions
- Session management
- Error handling

## Automatic cleanup:

- ✅ Test database is reset
- ✅ Test users are removed
- ✅ Mock data is cleared

## Test data:

Tests use predefined test data from:
- `bot/__tests__/fixtures/users.js`
- `bot/__tests__/fixtures/shops.js`
- `bot/__tests__/fixtures/products.js`

## When to use:

- 🤖 After changes in bot handlers
- 🤖 Before release
- 🤖 In CI/CD
- 🤖 Regression testing
- 🤖 After Telegraf.js updates
