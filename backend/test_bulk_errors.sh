#!/bin/bash

# Test error scenarios for bulk order status endpoint

BASE_URL="http://localhost:3000/api"

echo "==================================="
echo "Testing Error Scenarios"
echo "==================================="
echo ""

# Use existing test data from previous test
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidGVsZWdyYW1faWQiOjc3NzAwMSwidXNlcm5hbWUiOiJidWxrX3Rlc3Rfc2VsbGVyIiwiaWF0IjoxNzYxNjUxNzA5LCJleHAiOjE3NjIyNTY1MDl9.YxU6t_rUOECDN65Os5khG2s1BzMLtkROGbAhg-MNKHY"

# Test 1: Empty order_ids array
echo "Test 1: Empty order_ids array (should return 400)"
curl -s -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order_ids": [],
    "status": "shipped"
  }' | jq '.'
echo ""

# Test 2: Invalid status
echo "Test 2: Invalid status (should return 400)"
curl -s -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order_ids": [1, 2],
    "status": "wrong_status"
  }' | jq '.'
echo ""

# Test 3: Non-existent order IDs
echo "Test 3: Non-existent orders (should return 404)"
curl -s -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order_ids": [99999, 99998],
    "status": "shipped"
  }' | jq '.'
echo ""

# Test 4: Invalid order ID type
echo "Test 4: Invalid order ID type (should return 400)"
curl -s -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order_ids": [1, "abc", 3],
    "status": "shipped"
  }' | jq '.'
echo ""

# Test 5: Negative order ID
echo "Test 5: Negative order ID (should return 400)"
curl -s -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order_ids": [1, -5],
    "status": "shipped"
  }' | jq '.'
echo ""

# Test 6: Unauthorized user trying to update orders
echo "Test 6: Unauthorized user (should return 403)"
# Create another user
OTHER_USER=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": 777003,
    "username": "unauthorized_user",
    "firstName": "Unauth",
    "lastName": "User"
  }')
OTHER_TOKEN=$(echo "$OTHER_USER" | jq -r '.token')

curl -s -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OTHER_TOKEN" \
  -d '{
    "order_ids": [1, 2, 3],
    "status": "delivered"
  }' | jq '.'
echo ""

# Test 7: Successfully update to different statuses
echo "Test 7: Update to 'delivered' status (should return 200)"
curl -s -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order_ids": [1, 2],
    "status": "delivered"
  }' | jq '.success, .data.updated_count'
echo ""

echo "Test 8: Update to 'cancelled' status (should return 200)"
curl -s -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order_ids": [3],
    "status": "cancelled"
  }' | jq '.success, .data.updated_count'
echo ""

echo "==================================="
echo "All error scenarios tested!"
echo "==================================="
