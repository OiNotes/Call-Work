/**
 * Integration tests for bulk order status update endpoint
 */

import request from 'supertest';
import app from '../../src/server.js';
import { getClient } from '../../src/config/database.js';

describe('POST /api/orders/bulk-status', () => {
  let client;
  let testUserId;
  let otherUserId;
  let shopId;
  let productId;
  let orderIds;

  beforeAll(async () => {
    client = await getClient();

    // Create test users
    const user1 = await client.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name)
       VALUES (888001, 'bulktest_seller', 'Bulk', 'Seller')
       RETURNING id`
    );
    testUserId = user1.rows[0].id;

    const user2 = await client.query(
      `INSERT INTO users (telegram_id, username, first_name, last_name)
       VALUES (888002, 'bulktest_buyer', 'Bulk', 'Buyer')
       RETURNING id`
    );
    otherUserId = user2.rows[0].id;

    // Create test shop
    const shop = await client.query(
      `INSERT INTO shops (owner_id, name, description, registration_paid)
       VALUES ($1, 'bulktest_shop', 'Test shop for bulk operations', true)
       RETURNING id`,
      [testUserId]
    );
    shopId = shop.rows[0].id;

    // Create test product
    const product = await client.query(
      `INSERT INTO products (shop_id, name, description, price, currency, stock_quantity)
       VALUES ($1, 'Test Product', 'Product for bulk test', 10.00, 'USD', 100)
       RETURNING id`,
      [shopId]
    );
    productId = product.rows[0].id;

    // Create 3 test orders
    const order1 = await client.query(
      `INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, status)
       VALUES ($1, $2, 1, 10.00, 'USD', 'pending')
       RETURNING id`,
      [otherUserId, productId]
    );

    const order2 = await client.query(
      `INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, status)
       VALUES ($1, $2, 2, 20.00, 'USD', 'pending')
       RETURNING id`,
      [otherUserId, productId]
    );

    const order3 = await client.query(
      `INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, status)
       VALUES ($1, $2, 1, 10.00, 'USD', 'confirmed')
       RETURNING id`,
      [otherUserId, productId]
    );

    orderIds = [
      order1.rows[0].id,
      order2.rows[0].id,
      order3.rows[0].id
    ];
  });

  afterAll(async () => {
    // Cleanup
    await client.query('DELETE FROM orders WHERE buyer_id = $1', [otherUserId]);
    await client.query('DELETE FROM products WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM shops WHERE id = $1', [shopId]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, otherUserId]);
    client.release();
  });

  describe('Authentication', () => {
    test('should return 401 when no token provided', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .send({
          order_ids: [1, 2],
          status: 'shipped'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No token provided');
    });

    test('should return 401 when invalid token provided', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          order_ids: [1, 2],
          status: 'shipped'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Validation', () => {
    test('should return 400 when order_ids is empty', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: [],
          status: 'shipped'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should return 400 when order_ids is not an array', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: 'not-an-array',
          status: 'shipped'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 when order_ids contains invalid values', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: [1, 'abc', -5],
          status: 'shipped'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 when status is invalid', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: [1, 2],
          status: 'invalid_status'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should accept all valid statuses', async () => {
      const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

      for (const status of validStatuses) {
        const response = await request(app)
          .post('/api/orders/bulk-status')
          .set('Authorization', `Bearer test_token_user_${testUserId}`)
          .send({
            order_ids: orderIds,
            status
          });

        // Should not be validation error (400)
        // May be 403/404/200 depending on data
        expect(response.status).not.toBe(400);
      }
    });
  });

  describe('Authorization', () => {
    test('should return 404 when orders do not exist', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: [999999, 999998],
          status: 'shipped'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('One or more orders not found');
    });

    test('should return 403 when user does not own the shop', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${otherUserId}`)
        .send({
          order_ids: orderIds,
          status: 'shipped'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permission');
    });
  });

  describe('Successful bulk update', () => {
    test('should successfully update multiple orders status', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: orderIds,
          status: 'shipped'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('updated_count');
      expect(response.body.data.updated_count).toBe(orderIds.length);
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data.orders).toHaveLength(orderIds.length);

      // Verify each order in response
      response.body.data.orders.forEach(order => {
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('status', 'shipped');
        expect(order).toHaveProperty('product_name', 'Test Product');
        expect(order).toHaveProperty('buyer_username', 'bulktest_buyer');
        expect(order).toHaveProperty('quantity');
        expect(order).toHaveProperty('total_price');
        expect(order).toHaveProperty('currency', 'USD');
      });
    });

    test('should update database records', async () => {
      // Update to delivered
      await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: orderIds,
          status: 'delivered'
        });

      // Verify in database
      const result = await client.query(
        'SELECT id, status FROM orders WHERE id = ANY($1::int[])',
        [orderIds]
      );

      expect(result.rows).toHaveLength(orderIds.length);
      result.rows.forEach(row => {
        expect(row.status).toBe('delivered');
      });
    });

    test('should handle partial order list', async () => {
      // Update only first 2 orders
      const partialIds = orderIds.slice(0, 2);

      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: partialIds,
          status: 'confirmed'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated_count).toBe(2);
      expect(response.body.data.orders).toHaveLength(2);
    });

    test('should handle single order', async () => {
      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: [orderIds[0]],
          status: 'pending'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.updated_count).toBe(1);
      expect(response.body.data.orders).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    test('should handle duplicate order IDs', async () => {
      const duplicateIds = [orderIds[0], orderIds[0], orderIds[1]];

      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: duplicateIds,
          status: 'confirmed'
        });

      expect(response.status).toBe(404);
      // Database won't find 3 orders because only 2 unique exist
    });

    test('should handle mix of valid and invalid order IDs', async () => {
      const mixedIds = [orderIds[0], 999999];

      const response = await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer test_token_user_${testUserId}`)
        .send({
          order_ids: mixedIds,
          status: 'shipped'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('One or more orders not found');
    });
  });
});
