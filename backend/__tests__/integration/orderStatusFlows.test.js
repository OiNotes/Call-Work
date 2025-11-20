import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import orderRoutes from '../../src/routes/orders.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { config } from '../../src/config/env.js';
import {
  getTestPool,
  closeTestDb,
  cleanupTestData,
  createTestUser,
  createTestShop,
  createTestProduct,
  createTestOrder,
} from '../helpers/testDb.js';

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', orderRoutes);
  app.use(errorHandler);
  return app;
};

describe('Order status flows', () => {
  let app;
  let seller;
  let buyer;
  let shop;
  let product;
  let token;

  beforeAll(async () => {
    app = createTestApp();
    getTestPool();
  });

  beforeEach(async () => {
    await cleanupTestData();

    seller = await createTestUser({
      telegramId: '9100000001',
      username: 'selleruser',
      selectedRole: 'seller',
    });

    buyer = await createTestUser({
      telegramId: '9100000002',
      username: 'buyeruser',
      selectedRole: 'buyer',
    });

    shop = await createTestShop(seller.id, {
      name: 'Status Shop',
    });

    product = await createTestProduct(shop.id, {
      name: 'Premium Keyboard',
      price: '199.00',
      stock_quantity: 10,
    });

    token = jwt.sign({ id: seller.id, telegramId: seller.telegram_id }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    // confirmed order (active)
    await createTestOrder(buyer.id, product.id, shop.id, {
      status: 'confirmed',
      total_price: '199.00',
    });

    // shipped order
    await createTestOrder(buyer.id, product.id, shop.id, {
      status: 'shipped',
      total_price: '199.00',
    });

    // delivered order
    await createTestOrder(buyer.id, product.id, shop.id, {
      status: 'delivered',
      total_price: '199.00',
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeTestDb();
  });

  const authGet = (url) =>
    request(app).get(url).set('Authorization', `Bearer ${token}`).set('Accept', 'application/json');

  describe('GET /api/orders?shop_id', () => {
    it('returns only confirmed orders when filtered as active', async () => {
      const response = await authGet(`/api/orders?shop_id=${shop.id}&status=confirmed`).expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('confirmed');
    });

    it('understands delivered/completed aliases', async () => {
      const response = await authGet(
        `/api/orders?shop_id=${shop.id}&status=delivered,completed`
      ).expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('delivered');
    });
  });

  describe('GET /api/orders/active/count', () => {
    it('counts confirmed orders only', async () => {
      const response = await authGet(`/api/orders/active/count?shop_id=${shop.id}`).expect(200);

      expect(response.body.data.count).toBe(1);
    });
  });

  describe('POST /api/orders/bulk-status', () => {
    it('updates status and reflects changes in active count', async () => {
      const confirmedOrders = await authGet(`/api/orders?shop_id=${shop.id}&status=confirmed`);
      const orderIds = confirmedOrders.body.data.map((order) => order.id);

      expect(orderIds).toHaveLength(1);

      await request(app)
        .post('/api/orders/bulk-status')
        .set('Authorization', `Bearer ${token}`)
        .send({ order_ids: orderIds, status: 'shipped' })
        .expect(200);

      const updatedCount = await authGet(`/api/orders/active/count?shop_id=${shop.id}`);
      expect(updatedCount.body.data.count).toBe(0);
    });
  });
});
