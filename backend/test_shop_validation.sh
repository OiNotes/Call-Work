#!/bin/bash

# Shop Name Validation Test Script
# Tests alphanumeric validation and uniqueness check

set -e

# Configuration
API_URL="http://localhost:3000"
TOKEN="your_jwt_token_here"  # Replace with actual JWT token

echo "=========================================="
echo "Shop Name Validation Test Suite"
echo "=========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Helper: Make API request
test_shop_creation() {
  local name="$1"
  local expected_status="$2"
  local test_description="$3"

  echo -n "TEST: $test_description ... "

  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/shops" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"description\":\"Test shop\"}")

  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)

  if [ "$http_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $http_code)"
    echo "Response: $body"
    ((FAILED++))
  fi
  echo ""
}

echo "=== Alphanumeric Validation Tests ==="
echo ""

# Valid shop names (should pass: 201)
test_shop_creation "test_shop_123" 201 "Valid name (letters, numbers, underscore)"
test_shop_creation "MyShop" 201 "Valid name (letters only)"
test_shop_creation "shop123" 201 "Valid name (alphanumeric)"

# Invalid shop names (should fail: 400)
test_shop_creation "test shop" 400 "Invalid name (contains space)"
test_shop_creation "test-shop" 400 "Invalid name (contains dash)"
test_shop_creation "test@shop" 400 "Invalid name (contains special char)"
test_shop_creation "ab" 400 "Invalid name (too short, <3 chars)"
test_shop_creation "test_shop_with_very_long_name_exceeding_30_chars" 400 "Invalid name (too long, >30 chars)"

echo "=== Uniqueness Validation Tests ==="
echo ""

# Create shop with unique name
test_shop_creation "unique_shop_test" 201 "Create shop with unique name"

# Try to create duplicate (should fail: 409)
test_shop_creation "unique_shop_test" 409 "Reject exact duplicate name"
test_shop_creation "UNIQUE_SHOP_TEST" 409 "Reject case-insensitive duplicate"
test_shop_creation "Unique_Shop_Test" 409 "Reject mixed-case duplicate"

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
