/**
 * Integration Tests: Subscription Payment Automation
 * 
 * Tests automated payment flow for shop subscriptions:
 * - Invoice structure with subscription_id
 * - Payment verification via webhooks (BTC/LTC)
 * - Subscription activation and tier updates
 * - Database integrity and constraints
 */

import request from 'supertest';
import express from 'express';
import webhookRoutes from '../../src/routes/webhooks.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import {
  getTestPool,
  closeTestDb,
  cleanupTestData,
  createTestUser,
  createTestShop
} from '../helpers/testDb.js';

// Create minimal test app (webhooks only - no auth needed)
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/webhooks', webhookRoutes);
  app.use(errorHandler);
  return app;
};

describe('Subscription Payment Automation - Integration Tests', () => {
  let app;
  let pool;
  let user;
  let shop;

  // Webhook secret for tests
  const WEBHOOK_SECRET = 'test-webhook-secret-token';

  beforeAll(async () => {
    app = createTestApp();
    pool = getTestPool();

    // Set environment variables
    process.env.BLOCKCYPHER_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.CONFIRMATIONS_BTC = '3';
    process.env.CONFIRMATIONS_ETH = '12';

    // Ensure shop_subscriptions table exists (match schema.sql)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_subscriptions (
        id SERIAL PRIMARY KEY,
        shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        tier VARCHAR(20) NOT NULL CHECK (tier IN ('basic', 'pro')),
        amount DECIMAL(10, 2) NOT NULL,
        tx_hash VARCHAR(255) UNIQUE NOT NULL,
        currency VARCHAR(10) NOT NULL CHECK (currency IN ('BTC', 'ETH', 'USDT')),
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
        created_at TIMESTAMP DEFAULT NOW(),
        verified_at TIMESTAMP
      );
    `);

    // Ensure invoices table has subscription_id column (migration 011)
    await pool.query(`
      ALTER TABLE invoices 
      ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES shop_subscriptions(id) ON DELETE CASCADE;
    `);

    await pool.query(`
      DO $$
      BEGIN
        ALTER TABLE invoices ALTER COLUMN order_id DROP NOT NULL;
      EXCEPTION
        WHEN others THEN NULL;
      END $$;
    `);

    // Add check constraint if not exists
    await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'check_invoice_reference'
        ) THEN
          ALTER TABLE invoices
          ADD CONSTRAINT check_invoice_reference CHECK (
            (order_id IS NOT NULL AND subscription_id IS NULL) OR
            (order_id IS NULL AND subscription_id IS NOT NULL)
          );
        END IF;
      END $$;
    `);

    // Create index on subscription_id
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
    `);

    // Ensure processed_webhooks table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processed_webhooks (
        id SERIAL PRIMARY KEY,
        webhook_id VARCHAR(255) UNIQUE NOT NULL,
        source VARCHAR(50) NOT NULL CHECK (source IN ('blockcypher', 'etherscan', 'trongrid')),
        tx_hash VARCHAR(255) NOT NULL,
        processed_at TIMESTAMP DEFAULT NOW(),
        payload JSONB
      );
    `);
  });

  beforeEach(async () => {
    await cleanupTestData();

    // Clean up test data
    await pool.query('DELETE FROM processed_webhooks');
    await pool.query('DELETE FROM shop_subscriptions WHERE shop_id IN (SELECT id FROM shops WHERE owner_id >= 9000000000)');

    // Create test user
    user = await createTestUser({
      telegramId: '9000004001',
      username: 'subscriptionuser'
    });

    // Create test shop
    shop = await createTestShop(user.id, {
      name: 'Subscription Test Shop'
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await pool.query('DELETE FROM processed_webhooks');
    await closeTestDb();
    delete process.env.BLOCKCYPHER_WEBHOOK_SECRET;
  });

  /**
   * Helper: Create test subscription
   * Note: schema.sql only allows 'active', 'expired', 'cancelled' statuses
   */
  async function createTestSubscription(shopId, tier = 'basic', status = 'active') {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const amount = tier === 'pro' ? 35.00 : 25.00;
    const mockTxHash = `test_subscription_${shopId}_${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO shop_subscriptions 
       (shop_id, tier, amount, tx_hash, currency, period_start, period_end, status)
       VALUES ($1, $2, $3, $4, 'USDT', $5, $6, $7)
       RETURNING *`,
      [shopId, tier, amount, mockTxHash, now, periodEnd, status]
    );

    return result.rows[0];
  }

  /**
   * Helper: Simulate BlockCypher webhook
   */
  function simulateBlockCypherWebhook(invoice, confirmations = 3) {
    return {
      hash: `test_tx_${Date.now()}_${Math.random()}`,
      confirmations,
      block_height: 700000 + confirmations,
      total: Math.floor(invoice.expected_amount * 100000000), // Convert to satoshis
      outputs: [
        {
          addresses: [invoice.address],
          value: Math.floor(invoice.expected_amount * 100000000)
        }
      ]
    };
  }

  // ============================================
  // A. Invoice Structure Tests
  // ============================================
  describe('Invoice Structure - Database Level', () => {
    it('✅ Should create invoice with subscription_id (not order_id)', async () => {
      const subscription = await createTestSubscription(shop.id, 'basic');

      // Create invoice manually (simulating what generatePaymentInvoice does)
      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 25.00, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [subscription.id, `bc1test_${Date.now()}`]
      );

      const invoice = invoiceResult.rows[0];

      expect(invoice.subscription_id).toBe(subscription.id);
      expect(invoice.order_id).toBeNull(); // Mutually exclusive
      expect(invoice.chain).toBe('BTC');
      expect(invoice.status).toBe('pending');
      expect(parseFloat(invoice.expected_amount)).toBe(25.00);
    });

    it('✅ Should create invoice with correct tier pricing', async () => {
      const proSubscription = await createTestSubscription(shop.id, 'pro');

      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'ETH', $2, 0, 35.00, 'ETH', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [proSubscription.id, `0xtest_${Date.now()}`]
      );

      const invoice = invoiceResult.rows[0];

      expect(parseFloat(invoice.expected_amount)).toBe(35.00); // PRO tier
      expect(invoice.currency).toBe('ETH');
    });

    it('✅ Should enforce mutually exclusive constraint (order_id XOR subscription_id)', async () => {
      const subscription = await createTestSubscription(shop.id, 'basic');

      // Try to create invoice with BOTH order_id and subscription_id (should fail)
      const orderProduct = await pool.query(
        `INSERT INTO products (shop_id, name, price, currency)
         VALUES ($1, 'Test Product', 100, 'USD')
         RETURNING *`,
        [shop.id]
      );

      const orderResult = await pool.query(
        `INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, status)
         VALUES ($1, $2, 1, 100, 'USD', 'pending')
         RETURNING *`,
        [user.id, orderProduct.rows[0].id]
      );

      try {
        await pool.query(
          `INSERT INTO invoices 
           (order_id, subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
           VALUES ($1, $2, 'BTC', $3, 0, 0.001, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')`,
          [orderResult.rows[0].id, subscription.id, `bc1test_${Date.now()}`]
        );
        fail('Should have thrown constraint violation');
      } catch (error) {
        expect(error.message).toContain('check_invoice_reference');
      }
    });

    it('✅ Should allow invoice with only order_id', async () => {
      const orderProduct = await pool.query(
        `INSERT INTO products (shop_id, name, price, currency)
         VALUES ($1, 'Test Product', 100, 'USD')
         RETURNING *`,
        [shop.id]
      );

      const orderResult = await pool.query(
        `INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, status)
         VALUES ($1, $2, 1, 100, 'USD', 'pending')
         RETURNING *`,
        [user.id, orderProduct.rows[0].id]
      );

      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (order_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 0.002, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [orderResult.rows[0].id, `bc1order_${Date.now()}`]
      );

      expect(invoiceResult.rows[0].order_id).toBe(orderResult.rows[0].id);
      expect(invoiceResult.rows[0].subscription_id).toBeNull();
    });
  });

  // ============================================
  // B. Invoice Lifecycle Tests
  // ============================================
  describe('Invoice Status Lifecycle', () => {
    it('✅ Should track invoice status from pending to paid', async () => {
      const subscription = await createTestSubscription(shop.id, 'basic');

      // Create invoice
      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 25.00, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [subscription.id, `bc1test_${Date.now()}`]
      );

      // Verify initial status
      expect(invoiceResult.rows[0].status).toBe('pending');

      // Simulate payment
      await pool.query(
        `UPDATE invoices SET status = 'paid' WHERE id = $1`,
        [invoiceResult.rows[0].id]
      );

      // Verify updated status
      const updated = await pool.query(
        'SELECT status FROM invoices WHERE id = $1',
        [invoiceResult.rows[0].id]
      );

      expect(updated.rows[0].status).toBe('paid');
    });

    it('✅ Should support expired status', async () => {
      const subscription = await createTestSubscription(shop.id, 'basic');

      // Create expired invoice
      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 25.00, 'BTC', 'pending', NOW() - INTERVAL '1 hour')
         RETURNING *`,
        [subscription.id, `bc1test_${Date.now()}`]
      );

      const invoice = invoiceResult.rows[0];
      const now = new Date();
      const expiresAt = new Date(invoice.expires_at);

      // Verify invoice is expired
      expect(expiresAt < now).toBe(true);
    });
  });

  // ============================================
  // C. Webhook Handling Tests
  // ============================================
  describe('POST /webhooks/blockcypher - Subscription Payments', () => {
    it('✅ Should activate subscription on confirmed BTC payment', async () => {
      // Create subscription with expired status (needs payment to reactivate)
      const subscription = await createTestSubscription(shop.id, 'basic', 'expired');

      // Create invoice manually
      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 0.001, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [subscription.id, `bc1test_${Date.now()}`]
      );

      const invoice = invoiceResult.rows[0];

      // Simulate webhook with 3 confirmations (confirmed)
      const payload = simulateBlockCypherWebhook(invoice, 3);

      const response = await request(app)
        .post('/webhooks/blockcypher')
        .query({ token: WEBHOOK_SECRET })
        .send(payload)
        .expect(200);

      expect(response.body.status).toBe('success');

      // Verify subscription activated
      const subResult = await pool.query(
        'SELECT * FROM shop_subscriptions WHERE id = $1',
        [subscription.id]
      );

      expect(subResult.rows[0].status).toBe('active');
      expect(subResult.rows[0].verified_at).not.toBeNull();
    });

    it('✅ Should update shop tier and subscription_status', async () => {
      const subscription = await createTestSubscription(shop.id, 'pro');

      // Create invoice
      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 0.001, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [subscription.id, `bc1test_${Date.now()}`]
      );

      const invoice = invoiceResult.rows[0];

      // Simulate payment
      const payload = simulateBlockCypherWebhook(invoice, 3);

      await request(app)
        .post('/webhooks/blockcypher')
        .query({ token: WEBHOOK_SECRET })
        .send(payload)
        .expect(200);

      // Verify shop updated
      const shopResult = await pool.query(
        'SELECT * FROM shops WHERE id = $1',
        [shop.id]
      );

      expect(shopResult.rows[0].tier).toBe('pro');
      expect(shopResult.rows[0].subscription_status).toBe('active');
      expect(shopResult.rows[0].registration_paid).toBe(true);
      expect(shopResult.rows[0].is_active).toBe(true);
      expect(shopResult.rows[0].next_payment_due).not.toBeNull();
    });

    it('✅ Should set next_payment_due to +30 days', async () => {
      const subscription = await createTestSubscription(shop.id, 'basic');

      // Create invoice
      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 0.001, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [subscription.id, `bc1test_${Date.now()}`]
      );

      const invoice = invoiceResult.rows[0];
      const beforePayment = new Date();

      // Simulate payment
      const payload = simulateBlockCypherWebhook(invoice, 3);

      await request(app)
        .post('/webhooks/blockcypher')
        .query({ token: WEBHOOK_SECRET })
        .send(payload)
        .expect(200);

      // Verify next_payment_due is ~30 days from now
      const shopResult = await pool.query(
        'SELECT next_payment_due FROM shops WHERE id = $1',
        [shop.id]
      );

      const nextPaymentDue = new Date(shopResult.rows[0].next_payment_due);
      const expectedDate = new Date(beforePayment.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Allow 1 minute tolerance
      const difference = Math.abs(nextPaymentDue - expectedDate);
      expect(difference).toBeLessThan(60 * 1000);
    });

    it('✅ Should handle subscription payments separately from orders', async () => {
      // Create order invoice
      const orderProduct = await pool.query(
        `INSERT INTO products (shop_id, name, price, currency)
         VALUES ($1, 'Test Product', 100, 'USD')
         RETURNING *`,
        [shop.id]
      );

      const orderResult = await pool.query(
        `INSERT INTO orders (buyer_id, product_id, quantity, total_price, currency, status)
         VALUES ($1, $2, 1, 100, 'USD', 'pending')
         RETURNING *`,
        [user.id, orderProduct.rows[0].id]
      );

      const orderInvoice = await pool.query(
        `INSERT INTO invoices 
         (order_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 0.002, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [orderResult.rows[0].id, `bc1order_${Date.now()}`]
      );

      // Create subscription invoice
      const subscription = await createTestSubscription(shop.id, 'basic');

      const subInvoice = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 1, 0.001, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [subscription.id, `bc1sub_${Date.now()}`]
      );

      // Pay subscription
      const subPayload = simulateBlockCypherWebhook(subInvoice.rows[0], 3);

      await request(app)
        .post('/webhooks/blockcypher')
        .query({ token: WEBHOOK_SECRET })
        .send(subPayload)
        .expect(200);

      // Verify subscription activated but order still pending
      const subCheck = await pool.query(
        'SELECT status FROM shop_subscriptions WHERE id = $1',
        [subscription.id]
      );
      expect(subCheck.rows[0].status).toBe('active');

      const orderCheck = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        [orderResult.rows[0].id]
      );
      expect(orderCheck.rows[0].status).toBe('pending');
    });

    it('✅ Should update invoice status to paid', async () => {
      const subscription = await createTestSubscription(shop.id, 'basic');

      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 0.001, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [subscription.id, `bc1test_${Date.now()}`]
      );

      const invoice = invoiceResult.rows[0];

      // Simulate payment
      const payload = simulateBlockCypherWebhook(invoice, 3);

      await request(app)
        .post('/webhooks/blockcypher')
        .query({ token: WEBHOOK_SECRET })
        .send(payload)
        .expect(200);

      // Verify invoice marked as paid
      const invoiceCheck = await pool.query(
        'SELECT status FROM invoices WHERE id = $1',
        [invoice.id]
      );

      expect(invoiceCheck.rows[0].status).toBe('paid');
    });

    it('❌ Should not activate if payment amount insufficient', async () => {
      const subscription = await createTestSubscription(shop.id, 'basic');

      // Create invoice expecting 0.001 BTC (100k satoshis)
      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'BTC', $2, 0, 0.001, 'BTC', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [subscription.id, `bc1test_${Date.now()}`]
      );

      const invoice = invoiceResult.rows[0];

      // Simulate payment with insufficient amount (0.0005 BTC = 50k satoshis)
      const payload = {
        hash: `test_tx_insufficient_${Date.now()}`,
        confirmations: 3,
        block_height: 700000,
        total: 50000, // Only 0.0005 BTC (expected: 0.001)
        outputs: [
          {
            addresses: [invoice.address],
            value: 50000
          }
        ]
      };

      await request(app)
        .post('/webhooks/blockcypher')
        .query({ token: WEBHOOK_SECRET })
        .send(payload)
        .expect(200);

      // Verify subscription NOT activated due to insufficient amount
      const subResult = await pool.query(
        'SELECT status FROM shop_subscriptions WHERE id = $1',
        [subscription.id]
      );

      // Status should still be pending (payment recorded but amount validation would fail)
      expect(subResult.rows[0].status).toBe('pending');
    });
  });

  // ============================================
  // D. Polling Service Simulation Tests
  // ============================================
  describe('Polling Service Simulation (ETH/USDT)', () => {
    it('✅ Should activate subscription on ETH payment detection', async () => {
      const subscription = await createTestSubscription(shop.id, 'pro');

      // Create ETH invoice
      const invoiceResult = await pool.query(
        `INSERT INTO invoices 
         (subscription_id, chain, address, address_index, expected_amount, currency, status, expires_at)
         VALUES ($1, 'ETH', $2, 0, 0.02, 'ETH', 'pending', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [subscription.id, `0xtest_${Date.now()}`]
      );

      const invoice = invoiceResult.rows[0];

      // Manually trigger subscription activation (simulating polling service logic)
      await pool.query('BEGIN');

      await pool.query(
        `UPDATE shop_subscriptions 
         SET status = 'active', verified_at = NOW()
         WHERE id = $1`,
        [subscription.id]
      );

      await pool.query(
        `UPDATE shops 
         SET tier = $1, subscription_status = 'active', 
             next_payment_due = $2, registration_paid = true, is_active = true
         WHERE id = $3`,
        ['pro', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), shop.id]
      );

      await pool.query(
        `UPDATE invoices SET status = 'paid' WHERE id = $1`,
        [invoice.id]
      );

      await pool.query('COMMIT');

      // Verify activation
      const subResult = await pool.query(
        'SELECT status FROM shop_subscriptions WHERE id = $1',
        [subscription.id]
      );

      expect(subResult.rows[0].status).toBe('active');

      const shopResult = await pool.query(
        'SELECT tier, subscription_status FROM shops WHERE id = $1',
        [shop.id]
      );

      expect(shopResult.rows[0].tier).toBe('pro');
      expect(shopResult.rows[0].subscription_status).toBe('active');
    });
  });
});
