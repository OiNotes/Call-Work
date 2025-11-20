/**
 * Test: Multi-Item Cart Support
 *
 * This test verifies that the backend can now handle orders with multiple products.
 *
 * Before fix: Only first item from cart was ordered
 * After fix: All items are stored in order_items table
 */

import { getClient } from './src/config/database.js';
import {
  orderQueries,
  orderItemQueries,
  productQueries,
  userQueries,
  shopQueries,
} from './src/database/queries/index.js';

async function setupTestData() {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Create test user
    const user = await userQueries.create({
      telegram_id: 999999999,
      username: 'test_buyer',
      first_name: 'Test',
      last_name: 'Buyer',
    });

    // Create test shop
    const shop = await shopQueries.create({
      ownerId: user.id,
      name: 'Test Shop',
      description: 'Test shop for multi-item cart',
      tier: 'basic',
    });

    // Create 3 test products
    const products = [];
    for (let i = 1; i <= 3; i++) {
      const product = await productQueries.create({
        shopId: shop.id,
        name: `Test Product ${i}`,
        description: `Description ${i}`,
        price: 10 * i,
        currency: 'USD',
        stockQuantity: 100,
        isPreorder: false,
      });
      products.push(product);
    }

    await client.query('COMMIT');
    return { user, shop, products };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupTestData(userId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function testMultiItemCart() {
  console.log('🧪 Testing Multi-Item Cart Support\n');

  let testData;

  try {
    // Setup test data
    console.log('📦 Setting up test data...');
    testData = await setupTestData();
    const { user, products } = testData;
    console.log(`  ✅ Created user ID ${user.id}`);
    console.log(`  ✅ Created ${products.length} test products`);

    // Test 1: Create order with 3 items
    console.log('\n📊 Test 1: Creating order with 3 items');
    console.log('─'.repeat(50));

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Calculate total price
      const items = [
        { productId: products[0].id, quantity: 2 }, // Product 1: $10 x 2 = $20
        { productId: products[1].id, quantity: 1 }, // Product 2: $20 x 1 = $20
        { productId: products[2].id, quantity: 3 }, // Product 3: $30 x 3 = $90
      ];
      const expectedTotal = 10 * 2 + 20 * 1 + 30 * 3; // $130

      console.log(`\nOrdering:`);
      items.forEach((item, idx) => {
        const product = products.find((p) => p.id === item.productId);
        const itemTotal = parseFloat(product.price) * item.quantity;
        console.log(`  - ${product.name}: ${item.quantity} x $${product.price} = $${itemTotal}`);
      });
      console.log(`  Expected total: $${expectedTotal}`);

      // Create order
      const order = await orderQueries.create(
        {
          buyerId: user.id,
          productId: products[0].id, // First product for backward compatibility
          quantity: items.reduce((sum, item) => sum + item.quantity, 0), // Total quantity
          totalPrice: expectedTotal,
          currency: 'USD',
          deliveryAddress: null,
        },
        client
      );

      console.log(`\n✅ Order created: ID ${order.id}, Total: $${order.total_price}`);

      // Create order items
      const orderItems = items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          price: product.price,
          currency: product.currency,
        };
      });

      const createdItems = await orderItemQueries.createBatch(order.id, orderItems, client);
      console.log(`✅ Order items created: ${createdItems.length} items`);

      // Reserve stock
      for (const item of items) {
        await productQueries.reserveStock(item.productId, item.quantity, client);
      }
      console.log(`✅ Stock reserved for all items`);

      await client.query('COMMIT');

      // Test 2: Verify order_items table
      console.log('\n📊 Test 2: Verifying order_items table');
      console.log('─'.repeat(50));

      const savedItems = await orderItemQueries.findByOrderId(order.id);
      console.log(`\nFound ${savedItems.length} items in database:`);

      let calculatedTotal = 0;
      savedItems.forEach((item, idx) => {
        const itemTotal = parseFloat(item.price) * item.quantity;
        calculatedTotal += itemTotal;
        console.log(
          `  ${idx + 1}. ${item.product_name}: ${item.quantity} x $${item.price} = $${itemTotal.toFixed(2)}`
        );
      });

      console.log(`\nCalculated total from items: $${calculatedTotal.toFixed(2)}`);
      console.log(`Order total_price: $${parseFloat(order.total_price).toFixed(2)}`);

      // Validation
      const isValid =
        savedItems.length === 3 && Math.abs(calculatedTotal - parseFloat(order.total_price)) < 0.01;

      if (isValid) {
        console.log('\n✅ All items saved correctly!');
        console.log('✅ Total price matches!');
        return true;
      } else {
        console.log('\n❌ Validation failed!');
        if (savedItems.length !== 3) {
          console.log(`  Expected 3 items, got ${savedItems.length}`);
        }
        if (Math.abs(calculatedTotal - parseFloat(order.total_price)) >= 0.01) {
          console.log(
            `  Total mismatch: calculated $${calculatedTotal}, expected $${order.total_price}`
          );
        }
        return false;
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    // Cleanup
    if (testData) {
      console.log('\n🧹 Cleaning up test data...');
      await cleanupTestData(testData.user.id);
      console.log('  ✅ Test data cleaned up');
    }
  }
}

// Run test
console.log('═'.repeat(60));
console.log('  MULTI-ITEM CART SUPPORT TEST');
console.log('═'.repeat(60));

testMultiItemCart()
  .then((success) => {
    console.log('\n' + '═'.repeat(60));
    if (success) {
      console.log('✅ TEST PASSED - Multi-item cart works!');
      console.log('   Backend now supports orders with multiple products');
      process.exit(0);
    } else {
      console.log('❌ TEST FAILED - Multi-item cart broken!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Test error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
