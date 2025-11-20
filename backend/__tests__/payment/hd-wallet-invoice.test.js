/**
 * HD Wallet Invoice Generation Test
 *
 * Tests P0-PAY-2: HD Wallet Implementation for unique invoice addresses
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '../../src/server.js';
import { pool } from '../../src/config/database.js';
import jwt from 'jsonwebtoken';

describe('HD Wallet Invoice Generation (P0-PAY-2)', () => {
  let authToken;
  let testUserId;
  let testShopId;
  let testProductId;
  let testOrderId;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (telegram_id, username, first_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [Math.floor(Math.random() * 1000000000), 'testbuyer', 'Test Buyer']
    );
    testUserId = userResult.rows[0].id;

    // Generate auth token
    authToken = jwt.sign(
      { id: testUserId, telegramId: userResult.rows[0].telegram_id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test shop
    const shopResult = await pool.query(
      `INSERT INTO shops (owner_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [testUserId, 'Test Shop', 'Test Description']
    );
    testShopId = shopResult.rows[0].id;

    // Create test product
    const productResult = await pool.query(
      `INSERT INTO products (shop_id, name, description, price, stock_quantity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [testShopId, 'Test Product', 'Test Description', 100.5, 10]
    );
    testProductId = productResult.rows[0].id;

    // Create test order
    const orderResult = await pool.query(
      `INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [testUserId, testProductId, 1, 100.5, 'USD', 'pending']
    );
    testOrderId = orderResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM invoices WHERE order_id = $1', [testOrderId]);
    await pool.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
    await pool.query('DELETE FROM products WHERE id = $1', [testProductId]);
    await pool.query('DELETE FROM shops WHERE id = $1', [testShopId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  beforeEach(async () => {
    // Clean up invoices before each test
    await pool.query('DELETE FROM invoices WHERE order_id = $1', [testOrderId]);
  });

  describe('POST /api/orders/:id/invoice', () => {
    it('should generate BTC invoice with unique HD wallet address', async () => {
      // Skip if HD_XPUB_BTC not configured
      if (!process.env.HD_XPUB_BTC) {
        console.warn('⚠️  HD_XPUB_BTC not configured, skipping test');
        return;
      }

      const response = await request(app)
        .post(`/api/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chain: 'BTC' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('address');
      expect(response.body.data).toHaveProperty('cryptoAmount');
      expect(response.body.data).toHaveProperty('chain', 'BTC');
      expect(response.body.data).toHaveProperty('usdAmount', 100.5);
      expect(response.body.data).toHaveProperty('cryptoPrice');
      expect(response.body.data).toHaveProperty('expiresAt');
      expect(response.body.data).toHaveProperty('status', 'pending');

      // Verify address format (Bitcoin starts with 1, 3, or bc1)
      const address = response.body.data.address;
      expect(address).toMatch(/^(1|3|bc1)/);

      // Verify crypto amount is reasonable
      const cryptoAmount = parseFloat(response.body.data.cryptoAmount);
      expect(cryptoAmount).toBeGreaterThan(0);
      expect(cryptoAmount).toBeLessThan(1); // $100 should be less than 1 BTC

      // Verify invoice was saved to database
      const dbResult = await pool.query('SELECT * FROM invoices WHERE order_id = $1', [
        testOrderId,
      ]);
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].address).toBe(address);
      expect(dbResult.rows[0].chain).toBe('BTC');
      expect(parseFloat(dbResult.rows[0].expected_amount)).toBe(cryptoAmount);
    }, 30000); // 30s timeout for API calls

    it('should generate ETH invoice with unique address', async () => {
      if (!process.env.HD_XPUB_ETH) {
        console.warn('⚠️  HD_XPUB_ETH not configured, skipping test');
        return;
      }

      const response = await request(app)
        .post(`/api/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chain: 'ETH' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chain).toBe('ETH');

      // Verify Ethereum address format (0x + 40 hex chars)
      const address = response.body.data.address;
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }, 30000);

    it('should generate unique addresses for different orders', async () => {
      if (!process.env.HD_XPUB_BTC) {
        console.warn('⚠️  HD_XPUB_BTC not configured, skipping test');
        return;
      }

      // Create second order
      const orderResult = await pool.query(
        `INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [testUserId, testProductId, 1, 50.0, 'USD', 'pending']
      );
      const secondOrderId = orderResult.rows[0].id;

      try {
        // Generate invoice for first order
        const response1 = await request(app)
          .post(`/api/orders/${testOrderId}/invoice`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ chain: 'BTC' })
          .expect(200);

        const address1 = response1.body.data.address;
        const index1 = response1.body.data.addressIndex;

        // Generate invoice for second order
        const response2 = await request(app)
          .post(`/api/orders/${secondOrderId}/invoice`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ chain: 'BTC' })
          .expect(200);

        const address2 = response2.body.data.address;

        // Addresses must be different
        expect(address1).not.toBe(address2);

        // Verify both saved to database with different addresses
        const dbResult = await pool.query(
          'SELECT address FROM invoices WHERE order_id IN ($1, $2)',
          [testOrderId, secondOrderId]
        );
        expect(dbResult.rows.length).toBe(2);
        expect(dbResult.rows[0].address).not.toBe(dbResult.rows[1].address);
      } finally {
        // Cleanup second order
        await pool.query('DELETE FROM invoices WHERE order_id = $1', [secondOrderId]);
        await pool.query('DELETE FROM orders WHERE id = $1', [secondOrderId]);
      }
    }, 30000);

    it('should return existing pending invoice if already generated', async () => {
      if (!process.env.HD_XPUB_BTC) {
        console.warn('⚠️  HD_XPUB_BTC not configured, skipping test');
        return;
      }

      // Generate invoice first time
      const response1 = await request(app)
        .post(`/api/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chain: 'BTC' })
        .expect(200);

      const address1 = response1.body.data.address;
      const invoiceId1 = response1.body.data.id;

      // Generate invoice second time (should return same)
      const response2 = await request(app)
        .post(`/api/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chain: 'BTC' })
        .expect(200);

      const address2 = response2.body.data.address;
      const invoiceId2 = response2.body.data.id;

      // Should return same invoice
      expect(invoiceId1).toBe(invoiceId2);
      expect(address1).toBe(address2);

      // Verify only one invoice in database
      const dbResult = await pool.query(
        'SELECT COUNT(*) as count FROM invoices WHERE order_id = $1',
        [testOrderId]
      );
      expect(parseInt(dbResult.rows[0].count)).toBe(1);
    }, 30000);

    it('should reject invalid chain', async () => {
      const response = await request(app)
        .post(`/api/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chain: 'INVALID_CHAIN' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid chain');
    });

    it('should reject unauthorized access', async () => {
      await request(app)
        .post(`/api/orders/${testOrderId}/invoice`)
        .send({ chain: 'BTC' })
        .expect(401);
    });

    it('should use real-time crypto prices', async () => {
      if (!process.env.HD_XPUB_BTC) {
        console.warn('⚠️  HD_XPUB_BTC not configured, skipping test');
        return;
      }

      const response = await request(app)
        .post(`/api/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chain: 'BTC' })
        .expect(200);

      const cryptoPrice = response.body.data.cryptoPrice;
      const cryptoAmount = response.body.data.cryptoAmount;
      const usdAmount = response.body.data.usdAmount;

      // Verify math: usdAmount / cryptoPrice ≈ cryptoAmount
      const calculatedAmount = usdAmount / cryptoPrice;
      expect(Math.abs(calculatedAmount - cryptoAmount)).toBeLessThan(0.00000001);

      // Verify reasonable BTC price (should be between $20k and $200k)
      expect(cryptoPrice).toBeGreaterThan(20000);
      expect(cryptoPrice).toBeLessThan(200000);
    }, 30000);

    it('should map USDT to USDT_ERC20 by default', async () => {
      if (!process.env.HD_XPUB_USDT) {
        console.warn('⚠️  HD_XPUB_USDT not configured, skipping test');
        return;
      }

      const response = await request(app)
        .post(`/api/orders/${testOrderId}/invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ chain: 'USDT' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.chain).toBe('USDT_ERC20');

      // USDT should be close to 1:1 with USD
      const cryptoAmount = response.body.data.cryptoAmount;
      expect(cryptoAmount).toBeGreaterThan(95);
      expect(cryptoAmount).toBeLessThan(105);
    }, 30000);
  });
});
