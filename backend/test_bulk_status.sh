#!/bin/bash

# Test script for bulk order status update endpoint
# This tests the new POST /api/orders/bulk-status endpoint

BASE_URL="http://localhost:3000/api"

echo "==================================="
echo "Testing Bulk Order Status Update"
echo "==================================="
echo ""

# Test 1: Missing JWT token (401)
echo "Test 1: Missing authentication (should return 401)"
curl -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -d '{
    "order_ids": [1, 2],
    "status": "shipped"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 2: Invalid token (401)
echo "Test 2: Invalid token (should return 401)"
curl -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token" \
  -d '{
    "order_ids": [1, 2],
    "status": "shipped"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 3: Validation error - empty array (400)
echo "Test 3: Empty order_ids array (should return 400)"
curl -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test_token_user_1" \
  -d '{
    "order_ids": [],
    "status": "shipped"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 4: Validation error - invalid status (400)
echo "Test 4: Invalid status (should return 400)"
curl -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test_token_user_1" \
  -d '{
    "order_ids": [1, 2],
    "status": "invalid_status"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 5: Validation error - invalid order ID (400)
echo "Test 5: Invalid order ID format (should return 400)"
curl -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test_token_user_1" \
  -d '{
    "order_ids": [1, "abc", 3],
    "status": "shipped"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

# Test 6: Orders not found (404)
echo "Test 6: Non-existent orders (should return 404)"
curl -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test_token_user_1" \
  -d '{
    "order_ids": [99999, 99998],
    "status": "shipped"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "==================================="
echo "Basic validation tests completed!"
echo "==================================="
echo ""
echo "Note: For full testing with actual data:"
echo "1. Create a test shop and products"
echo "2. Create test orders"
echo "3. Test bulk status update with real order IDs"
echo "4. Verify authorization (user must own the shop)"
