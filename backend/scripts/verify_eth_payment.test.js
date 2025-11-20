import { jest } from '@jest/globals';

// Mock environment variables
process.env.ETHERSCAN_API_KEY = 'mock-key';

// Mock dependencies
jest.unstable_mockModule('../src/services/etherscanService.js', () => ({
    getAddressTransactions: jest.fn(),
    verifyEthPayment: jest.fn(),
    getTokenTransfers: jest.fn(),
    verifyUsdtPayment: jest.fn(),
}));

jest.unstable_mockModule('../src/services/tronService.js', () => ({}));
jest.unstable_mockModule('../src/services/blockCypherService.js', () => ({}));

jest.unstable_mockModule('../src/services/telegram.js', () => ({
    default: {
        notifySubscriptionActivated: jest.fn(),
        notifySubscriptionPendingSetup: jest.fn(),
    },
}));

jest.unstable_mockModule('../src/services/broadcastService.js', () => ({
    broadcastToUser: jest.fn(),
}));

jest.unstable_mockModule('../src/utils/logger.js', () => ({
    default: {
        info: jest.fn((msg, meta) => console.log('[INFO]', msg, meta || '')),
        warn: jest.fn((msg, meta) => console.warn('[WARN]', msg, meta || '')),
        error: jest.fn((msg, meta) => console.error('[ERROR]', msg, meta || '')),
        debug: jest.fn((msg, meta) => console.log('[DEBUG]', msg, meta || '')),
    },
}));

// Mock getClient
jest.unstable_mockModule('../src/config/database.js', () => ({
    getClient: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
    }),
    pool: {
        connect: jest.fn(),
        query: jest.fn(),
    },
}));

// Mock database queries
const mockInvoiceQueries = {
    findPendingByChains: jest.fn(),
    updateStatus: jest.fn(),
};

const mockPaymentQueries = {
    findByTxHash: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
};

const mockOrderQueries = {};
const mockOrderItemQueries = {};
const mockProductQueries = {};
const mockShopQueries = {};
const mockUserQueries = {};

jest.unstable_mockModule('../src/database/queries/index.js', () => ({
    invoiceQueries: mockInvoiceQueries,
    paymentQueries: mockPaymentQueries,
    orderQueries: mockOrderQueries,
    orderItemQueries: mockOrderItemQueries,
    productQueries: mockProductQueries,
    shopQueries: mockShopQueries,
    userQueries: mockUserQueries,
}));

// Import modules
const pollingService = await import('../src/services/pollingService.js');
const etherscanService = await import('../src/services/etherscanService.js');

describe('ETH Payment Verification', () => {
    // We don't need real DB client anymore for the polling logic, 
    // but we might want it to verify end state if we weren't mocking queries.
    // Since we are mocking queries, we verify the mocks were called correctly.

    test('ETH Subscription Payment (Polling)', async () => {
        console.log('\n--- Testing ETH Subscription Payment ---');

        const invoice = {
            id: 999901,
            subscription_id: 999901,
            chain: 'ETH',
            currency: 'ETH',
            address: '0xTestEthAddress',
            crypto_amount: 0.1,
            status: 'pending',
            expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            expected_amount: 0.1
        };

        // Setup mocks
        mockInvoiceQueries.findPendingByChains.mockResolvedValue([invoice]);
        mockInvoiceQueries.updateStatus.mockResolvedValue({ ...invoice, status: 'paid' });

        mockPaymentQueries.findByTxHash.mockResolvedValue(null); // No existing payment
        mockPaymentQueries.create.mockResolvedValue({ id: 1, status: 'confirmed' });
        mockPaymentQueries.updateStatus.mockResolvedValue({ id: 1, status: 'confirmed' });

        etherscanService.getAddressTransactions.mockResolvedValue([{
            hash: '0xEthTxHash',
            to: invoice.address,
            value: '100000000000000000', // 0.1 ETH
            isError: false
        }]);

        etherscanService.verifyEthPayment.mockResolvedValue({
            verified: true,
            amount: 0.1,
            confirmations: 10,
            status: 'confirmed'
        });

        // Run polling
        await pollingService.manualPoll();

        // Verify results
        expect(mockInvoiceQueries.updateStatus).toHaveBeenCalledWith(
            invoice.id,
            'paid',
            '0xEthTxHash'
        );

        console.log('✅ ETH Payment Verified (Mocked)');
    });
});
