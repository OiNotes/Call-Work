import { jest } from '@jest/globals';

// Mock environment variables
process.env.ETHERSCAN_API_KEY = 'mock-key';
process.env.BLOCKCYPHER_WEBHOOK_SECRET = 'mock-secret';

// Mock dependencies
jest.unstable_mockModule('../src/services/etherscanService.js', () => ({
    getAddressTransactions: jest.fn(),
    verifyEthPayment: jest.fn(),
    getTokenTransfers: jest.fn(),
    verifyUsdtPayment: jest.fn(),
}));

jest.unstable_mockModule('../src/services/tronService.js', () => ({
    getTrc20Transfers: jest.fn(),
    verifyPayment: jest.fn(),
}));

jest.unstable_mockModule('../src/services/blockCypherService.js', () => ({
    getAddressInfo: jest.fn(),
    verifyPayment: jest.fn(),
    parseWebhookPayload: jest.fn(),
    getTransaction: jest.fn(),
}));

jest.unstable_mockModule('../src/services/telegram.js', () => ({
    default: {
        notifySubscriptionActivated: jest.fn(),
        notifySubscriptionPendingSetup: jest.fn(),
    },
}));

jest.unstable_mockModule('../src/services/broadcastService.js', () => ({
    broadcastToUser: jest.fn(),
}));

// Mock handleSubscriptionPayment in pollingService
jest.unstable_mockModule('../src/services/pollingService.js', async () => {
    const originalModule = await import('../src/services/pollingService.js');
    return {
        ...originalModule,
        handleSubscriptionPayment: jest.fn().mockResolvedValue(true),
    };
});

jest.unstable_mockModule('../src/utils/logger.js', () => ({
    default: {
        info: jest.fn((msg, meta) => console.log('[INFO]', msg, meta || '')),
        warn: jest.fn((msg, meta) => console.warn('[WARN]', msg, meta || '')),
        error: jest.fn((msg, meta) => console.error('[ERROR]', msg, meta || '')),
        debug: jest.fn((msg, meta) => console.log('[DEBUG]', msg, meta || '')),
    },
}));

// Import modules
const pollingService = await import('../src/services/pollingService.js');
const webhookRoutes = await import('../src/routes/webhooks.js'); // We'll need to extract the handler logic or mock express
const { invoiceQueries, paymentQueries, shopQueries } = await import('../src/database/queries/index.js');
const { getClient } = await import('../src/config/database.js');
const etherscanService = await import('../src/services/etherscanService.js');
const tronService = await import('../src/services/tronService.js');
const blockCypherService = await import('../src/services/blockCypherService.js');

// Mock Express Request/Response for Webhook
const mockReq = (body, query = {}) => ({
    body,
    query,
    headers: {},
    ip: '127.0.0.1',
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('Full Payment System Verification', () => {
    let client;

    beforeAll(async () => {
        // Get real DB client to create test data
        client = await getClient();

        // Create test user
        await client.query(`
          INSERT INTO users (id, telegram_id, username, first_name)
          VALUES (999901, '999901', 'testuser1', 'Test User 1')
          ON CONFLICT (id) DO NOTHING
        `);
        await client.query(`
          INSERT INTO users (id, telegram_id, username, first_name)
          VALUES (999902, '999902', 'testuser2', 'Test User 2')
          ON CONFLICT (id) DO NOTHING
        `);
        await client.query(`
          INSERT INTO users (id, telegram_id, username, first_name)
          VALUES (999903, '999903', 'testuser3', 'Test User 3')
          ON CONFLICT (id) DO NOTHING
        `);
    });

    afterAll(async () => {
        // Clean up users
        await client.query('DELETE FROM users WHERE id IN (999901, 999902, 999903)');
        client.release();
    });

    test('ETH Subscription Payment (Polling)', async () => {
        console.log('\n--- Testing ETH Subscription Payment ---');

        // 1. Create Test Data
        const userId = 999901;
        const subId = 999901;
        const invoiceId = 999901;
        const address = '0xTestEthAddress';

        // Clean up previous run
        await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
        await client.query('DELETE FROM shop_subscriptions WHERE id = $1', [subId]);

        // Insert Subscription
        await client.query(`
      INSERT INTO shop_subscriptions (id, user_id, tier, status, amount, tx_hash, currency, period_start, period_end)
      VALUES ($1, $2, 'pro', 'pending', 35.0, 'pending_tx_eth', 'ETH', NOW(), NOW() + INTERVAL '1 month')
    `, [subId, userId]);

        // Insert Invoice
        await client.query(`
      INSERT INTO invoices (id, subscription_id, chain, currency, address, crypto_amount, status, expires_at, address_index, expected_amount)
      VALUES ($1, $2, 'ETH', 'ETH', $3, 0.1, 'pending', NOW() + INTERVAL '1 hour', 0, 0.1)
    `, [invoiceId, subId, address]);

        // 2. Mock Blockchain Response
        etherscanService.getAddressTransactions.mockResolvedValue([{
            hash: '0xEthTxHash',
            to: address,
            value: '100000000000000000', // 0.1 ETH
            isError: false
        }]);

        etherscanService.verifyEthPayment.mockResolvedValue({
            verified: true,
            amount: 0.1,
            confirmations: 10,
            status: 'confirmed'
        });

        // 3. Run Polling
        await pollingService.manualPoll();

        // 4. Verify DB Updates
        const subResult = await client.query('SELECT status FROM shop_subscriptions WHERE id = $1', [subId]);
        const invoiceResult = await client.query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);

        console.log('Subscription Status:', subResult.rows[0].status);
        console.log('Invoice Status:', invoiceResult.rows[0].status);

        if (subResult.rows[0].status === 'active' && invoiceResult.rows[0].status === 'paid') {
            console.log('✅ ETH Payment Verified');
        } else {
            console.error('❌ ETH Payment Failed');
            throw new Error('ETH Payment Failed');
        }
    });

    test('USDT TRC20 Subscription Payment (Polling)', async () => {
        console.log('\n--- Testing USDT TRC20 Subscription Payment ---');

        const userId = 999902;
        const subId = 999902;
        const invoiceId = 999902;
        const address = 'TTestTronAddress';

        await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
        await client.query('DELETE FROM shop_subscriptions WHERE id = $1', [subId]);

        await client.query(`
      INSERT INTO shop_subscriptions (id, user_id, tier, status, amount, tx_hash, currency, period_start, period_end)
      VALUES ($1, $2, 'pro', 'pending', 35.0, 'pending_tx_usdt', 'USDT', NOW(), NOW() + INTERVAL '1 month')
    `, [subId, userId]);

        await client.query(`
      INSERT INTO invoices (id, subscription_id, chain, currency, address, crypto_amount, status, expires_at, address_index, expected_amount)
      VALUES ($1, $2, 'USDT_TRC20', 'USDT', $3, 35.0, 'pending', NOW() + INTERVAL '1 hour', 0, 35.0)
    `, [invoiceId, subId, address]);

        // Mock Tron Response
        tronService.getTrc20Transfers.mockResolvedValue([{
            transactionId: 'TronTxHash',
            to: address,
            value: '35000000', // 35 USDT (6 decimals)
            tokenInfo: { decimals: 6 }
        }]);

        tronService.verifyPayment.mockResolvedValue({
            verified: true,
            amount: 35.0,
            confirmations: 20,
            status: 'confirmed'
        });

        await pollingService.manualPoll();

        const subResult = await client.query('SELECT status FROM shop_subscriptions WHERE id = $1', [subId]);
        const invoiceResult = await client.query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);

        console.log('Subscription Status:', subResult.rows[0].status);
        console.log('Invoice Status:', invoiceResult.rows[0].status);

        if (subResult.rows[0].status === 'active' && invoiceResult.rows[0].status === 'paid') {
            console.log('✅ USDT TRC20 Payment Verified');
        } else {
            console.error('❌ USDT TRC20 Payment Failed');
            throw new Error('USDT TRC20 Payment Failed');
        }
    });

    // Note: For Webhooks, we need to simulate the route handler logic. 
    // Since we can't easily spin up the full express app with mocks in this script without more setup,
    // we will rely on the fact that pollingService ALSO has a fallback for BTC/LTC.
    // But let's try to test the polling fallback for BTC which is safer.

    test('BTC Subscription Payment (Polling Fallback)', async () => {
        console.log('\n--- Testing BTC Subscription Payment (Polling Fallback) ---');

        const userId = 999903;
        const subId = 999903;
        const invoiceId = 999903;
        const address = 'bc1TestBtcAddress';

        await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
        await client.query('DELETE FROM shop_subscriptions WHERE id = $1', [subId]);

        await client.query(`
      INSERT INTO shop_subscriptions (id, user_id, tier, status, amount, tx_hash, currency, period_start, period_end)
      VALUES ($1, $2, 'pro', 'pending', 35.0, 'pending_tx_btc', 'BTC', NOW(), NOW() + INTERVAL '1 month')
    `, [subId, userId]);

        await client.query(`
      INSERT INTO invoices (id, subscription_id, chain, currency, address, crypto_amount, status, expires_at, address_index, expected_amount)
      VALUES ($1, $2, 'BTC', 'BTC', $3, 0.001, 'pending', NOW() + INTERVAL '1 hour', 0, 0.001)
    `, [invoiceId, subId, address]);

        // Mock BlockCypher Response
        blockCypherService.getAddressInfo.mockResolvedValue({
            txrefs: [{
                tx_hash: 'BtcTxHash',
                value: 100000, // 0.001 BTC (satoshis)
                confirmations: 3
            }]
        });

        blockCypherService.verifyPayment.mockResolvedValue({
            verified: true,
            amount: 0.001,
            confirmations: 3,
            status: 'confirmed'
        });

        await pollingService.manualPoll();

        const subResult = await client.query('SELECT status FROM shop_subscriptions WHERE id = $1', [subId]);
        const invoiceResult = await client.query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);

        console.log('Subscription Status:', subResult.rows[0].status);
        console.log('Invoice Status:', invoiceResult.rows[0].status);

        if (subResult.rows[0].status === 'active' && invoiceResult.rows[0].status === 'paid') {
            console.log('✅ BTC Payment Verified');
        } else {
            console.error('❌ BTC Payment Failed');
            throw new Error('BTC Payment Failed');
        }
    });
});
