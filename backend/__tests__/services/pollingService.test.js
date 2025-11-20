import { jest } from '@jest/globals';
import { amountsMatchWithTolerance } from '../../src/utils/paymentTolerance.js';

// Mock dependencies
jest.unstable_mockModule('../../src/database/queries/index.js', () => ({
    paymentQueries: {
        findByTxHash: jest.fn(),
        create: jest.fn(),
        updateStatus: jest.fn(),
    },
    invoiceQueries: {
        findPendingByChains: jest.fn(),
        updateStatus: jest.fn(),
        findExpired: jest.fn(),
    },
    orderQueries: {
        updateStatus: jest.fn(),
        findById: jest.fn(),
    },
    orderItemQueries: {
        findByOrderIdWithStock: jest.fn(),
    },
    productQueries: {
        findById: jest.fn(),
        updateStock: jest.fn(),
    },
    shopQueries: {
        findById: jest.fn(),
    },
    userQueries: {
        findById: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/config/database.js', () => ({
    getClient: jest.fn(),
}));

jest.unstable_mockModule('../../src/services/etherscanService.js', () => ({
    getAddressTransactions: jest.fn(),
    verifyEthPayment: jest.fn(),
    getTokenTransfers: jest.fn(),
    verifyUsdtPayment: jest.fn(),
}));

jest.unstable_mockModule('../../src/services/tronService.js', () => ({
    getTrc20Transfers: jest.fn(),
    verifyPayment: jest.fn(),
}));

jest.unstable_mockModule('../../src/services/blockCypherService.js', () => ({
    getAddressInfo: jest.fn(),
    verifyPayment: jest.fn(),
}));

jest.unstable_mockModule('../../src/services/telegram.js', () => ({
    default: {
        notifyPaymentConfirmed: jest.fn(),
        notifyPaymentConfirmedSeller: jest.fn(),
        notifyOrderCancelled: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.unstable_mockModule('../../src/services/broadcastService.js', () => ({
    broadcastToUser: jest.fn(),
}));

// Import module under test
const pollingService = await import('../../src/services/pollingService.js');
const { invoiceQueries, paymentQueries } = await import('../../src/database/queries/index.js');
const etherscanService = await import('../../src/services/etherscanService.js');

describe('Polling Service - Grace Period Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Should verify payment for invoice expired within 24h grace period', async () => {
        // Arrange
        const now = new Date();
        const expired1HourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

        const invoice = {
            id: 1,
            order_id: 100,
            chain: 'ETH',
            currency: 'ETH',
            address: '0x123',
            crypto_amount: '0.1',
            expires_at: expired1HourAgo, // Expired!
        };

        // Mock pending invoices to return our expired invoice
        // (In reality, findPendingByChains might filter these out, but we assume
        // the query is updated or we are testing processInvoice directly via checkPendingPayments)
        invoiceQueries.findPendingByChains.mockResolvedValue([invoice]);

        // Mock Etherscan to find a matching payment
        etherscanService.getAddressTransactions.mockResolvedValue([
            {
                hash: '0xtxhash',
                to: '0x123',
                value: '100000000000000000', // 0.1 ETH
                isError: false,
            },
        ]);

        etherscanService.verifyEthPayment.mockResolvedValue({
            verified: true,
            amount: 0.1,
            confirmations: 12,
            status: 'confirmed',
        });

        paymentQueries.findByTxHash.mockResolvedValue(null); // New payment
        paymentQueries.create.mockResolvedValue({ id: 500, status: 'confirmed' });

        // Mock DB client for transaction
        const mockClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        const { getClient } = await import('../../src/config/database.js');
        getClient.mockResolvedValue(mockClient);

        // Act
        // We can't call processInvoice directly as it's not exported, so we call checkPendingPayments
        // via manualPoll or startPolling (but startPolling is async loop).
        // manualPoll exposes the logic.
        await pollingService.manualPoll();

        // Assert
        expect(etherscanService.verifyEthPayment).toHaveBeenCalled();
        expect(paymentQueries.create).toHaveBeenCalled();
        expect(invoiceQueries.updateStatus).toHaveBeenCalledWith(1, 'paid', '0xtxhash');
    });

    test('Should SKIP payment verification for invoice expired > 24h ago', async () => {
        // Arrange
        const now = new Date();
        const expired25HoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString();

        const invoice = {
            id: 2,
            order_id: 101,
            chain: 'ETH',
            currency: 'ETH',
            address: '0x456',
            crypto_amount: '0.1',
            expires_at: expired25HoursAgo, // Expired > 24h
        };

        invoiceQueries.findPendingByChains.mockResolvedValue([invoice]);

        // Act
        await pollingService.manualPoll();

        // Assert
        expect(etherscanService.getAddressTransactions).not.toHaveBeenCalled();
        expect(paymentQueries.create).not.toHaveBeenCalled();
    });
});
