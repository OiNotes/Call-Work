#!/bin/bash

# Manual test for bulk order status endpoint
# This creates real test data and tests the endpoint

BASE_URL="http://localhost:3000/api"

echo "==================================="
echo "Manual Bulk Status Update Test"
echo "==================================="
echo ""

# Step 1: Create test user
echo "Step 1: Creating test user..."
USER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": 777001,
    "username": "bulk_test_seller",
    "firstName": "Bulk",
    "lastName": "Seller"
  }')

echo "$USER_RESPONSE" | jq '.'
TOKEN=$(echo "$USER_RESPONSE" | jq -r '.token')
USER_ID=$(echo "$USER_RESPONSE" | jq -r '.user.id')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to create user or get token"
  exit 1
fi

echo ""
echo "User created. Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Create test shop
echo "Step 2: Creating test shop..."
SHOP_RESPONSE=$(curl -s -X POST "$BASE_URL/shops" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "bulk_test_shop",
    "description": "Test shop for bulk operations"
  }')

echo "$SHOP_RESPONSE" | jq '.'
SHOP_ID=$(echo "$SHOP_RESPONSE" | jq -r '.data.id')

if [ "$SHOP_ID" == "null" ] || [ -z "$SHOP_ID" ]; then
  echo "Failed to create shop"
  exit 1
fi

echo ""
echo "Shop created with ID: $SHOP_ID"
echo ""

# Step 3: Create test product
echo "Step 3: Creating test product..."
PRODUCT_RESPONSE=$(curl -s -X POST "$BASE_URL/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "shopId": '$SHOP_ID',
    "name": "Test Product for Bulk",
    "description": "Product for testing bulk operations",
    "price": 10.00,
    "currency": "USD",
    "stockQuantity": 100
  }')

echo "$PRODUCT_RESPONSE" | jq '.'
PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | jq -r '.data.id')

if [ "$PRODUCT_ID" == "null" ] || [ -z "$PRODUCT_ID" ]; then
  echo "Failed to create product"
  exit 1
fi

echo ""
echo "Product created with ID: $PRODUCT_ID"
echo ""

# Step 4: Create buyer user and orders
echo "Step 4: Creating buyer and orders..."
BUYER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "telegramId": 777002,
    "username": "bulk_test_buyer",
    "firstName": "Bulk",
    "lastName": "Buyer"
  }')

BUYER_TOKEN=$(echo "$BUYER_RESPONSE" | jq -r '.token')

# Create 3 orders
ORDER_IDS=()
for i in {1..3}; do
  ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $BUYER_TOKEN" \
    -d '{
      "productId": '$PRODUCT_ID',
      "quantity": 1
    }')

  ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.data.id')
  ORDER_IDS+=("$ORDER_ID")
  echo "Created order $i with ID: $ORDER_ID"
done

echo ""
echo "Created 3 orders: ${ORDER_IDS[@]}"
echo ""

# Step 5: Test bulk status update
echo "Step 5: Testing bulk status update..."
BULK_UPDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/orders/bulk-status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order_ids": ['"${ORDER_IDS[0]}, ${ORDER_IDS[1]}, ${ORDER_IDS[2]}"'],
    "status": "shipped"
  }')

echo "$BULK_UPDATE_RESPONSE" | jq '.'

echo ""
echo "==================================="
echo "Test completed!"
echo "==================================="
echo ""
echo "Summary:"
echo "- User ID: $USER_ID"
echo "- Shop ID: $SHOP_ID"
echo "- Product ID: $PRODUCT_ID"
echo "- Order IDs: ${ORDER_IDS[@]}"
echo ""
echo "Bulk update response:"
echo "$BULK_UPDATE_RESPONSE" | jq '.data.updated_count, .data.orders[].status'
