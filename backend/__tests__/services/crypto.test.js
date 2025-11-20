/**
 * @fileoverview CRITICAL: Crypto Payment Verification Tests
 * @description Tests для payment verification logic
 * Эти тесты проверяют что мы корректно верифицируем платежи
 * и НЕ принимаем неправильные транзакции.
 *
 * ВАЖНОСТЬ: crypto.js верифицирует РЕАЛЬНЫЕ платежи пользователей.
 * Отсутствие тестов = риск финансовых потерь.
 */

import { jest } from '@jest/globals';

// Mock axios ПЕРЕД импортом crypto service
jest.unstable_mockModule('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock logger
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import после всех mocks
const axios = (await import('axios')).default;
const cryptoService = (await import('../../src/services/crypto.js')).default;

describe('Bitcoin Transaction Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    test('should verify valid BTC payment with exact amount', async () => {
      // Mock blockchain.info API response
      const mockTx = {
        hash: 'abc123txhash',
        block_height: 800000,
        out: [
          {
            addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            value: 100000000, // 1 BTC in satoshis
          },
        ],
      };

      // Mock current block height
      axios.get.mockImplementation((url) => {
        if (url.includes('latestblock')) {
          return Promise.resolve({ data: { height: 800002 } }); // 3 confirmations
        }
        return Promise.resolve({ data: mockTx });
      });

      const result = await cryptoService.verifyBitcoinTransaction(
        'abc123txhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(1.0);
      expect(result.confirmations).toBe(3);
      expect(result.status).toBe('confirmed'); // >= 3 confirmations
    });

    test('should verify BTC payment with amount exceeding required (overpayment)', async () => {
      const mockTx = {
        hash: 'abc123txhash',
        block_height: 800000,
        out: [
          {
            addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            value: 150000000, // 1.5 BTC in satoshis
          },
        ],
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('latestblock')) {
          return Promise.resolve({ data: { height: 800006 } }); // 7 confirmations
        }
        return Promise.resolve({ data: mockTx });
      });

      const result = await cryptoService.verifyBitcoinTransaction(
        'abc123txhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(1.5); // Actual amount sent
      expect(result.confirmations).toBe(7);
    });

    test('should verify payment within tolerance bounds (0.5% default)', async () => {
      const mockTx = {
        hash: 'abc123txhash',
        block_height: 800000,
        out: [
          {
            addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            value: 99500000, // 0.995 BTC (within 0.5% tolerance of 1.0 BTC)
          },
        ],
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('latestblock')) {
          return Promise.resolve({ data: { height: 800003 } });
        }
        return Promise.resolve({ data: mockTx });
      });

      const result = await cryptoService.verifyBitcoinTransaction(
        'abc123txhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(0.995);
    });

    test('should handle pending transaction (0 confirmations)', async () => {
      const mockTx = {
        hash: 'abc123txhash',
        block_height: null, // Not yet in block
        out: [
          {
            addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            value: 100000000,
          },
        ],
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('latestblock')) {
          return Promise.resolve({ data: { height: 800000 } });
        }
        return Promise.resolve({ data: mockTx });
      });

      const result = await cryptoService.verifyBitcoinTransaction(
        'abc123txhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(true);
      expect(result.confirmations).toBe(0);
      expect(result.status).toBe('pending'); // < 3 confirmations
    });
  });

  describe('Failure Cases - CRITICAL Security', () => {
    test('should REJECT payment with insufficient amount', async () => {
      const mockTx = {
        hash: 'abc123txhash',
        block_height: 800000,
        out: [
          {
            addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            value: 50000000, // 0.5 BTC - INSUFFICIENT!
          },
        ],
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('latestblock')) {
          return Promise.resolve({ data: { height: 800003 } });
        }
        return Promise.resolve({ data: mockTx });
      });

      const result = await cryptoService.verifyBitcoinTransaction(
        'abc123txhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0 // Required 1.0 BTC
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/amount mismatch/i);
    });

    test('should REJECT payment to wrong address', async () => {
      const mockTx = {
        hash: 'abc123txhash',
        block_height: 800000,
        out: [
          {
            addr: '1WrongAddressXXXXXXXXXXXXXXXXXXX', // WRONG ADDRESS!
            value: 100000000,
          },
        ],
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('latestblock')) {
          return Promise.resolve({ data: { height: 800003 } });
        }
        return Promise.resolve({ data: mockTx });
      });

      const result = await cryptoService.verifyBitcoinTransaction(
        'abc123txhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Expected address
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/address not found/i);
    });

    test('should REJECT when transaction not found', async () => {
      axios.get.mockImplementation((url) => {
        if (url.includes('latestblock')) {
          return Promise.resolve({ data: { height: 800000 } });
        }
        return Promise.resolve({ data: null }); // Transaction not found
      });

      const result = await cryptoService.verifyBitcoinTransaction(
        'nonexistenttxhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });

    test('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('Blockchain API error: Rate limit exceeded'));

      const result = await cryptoService.verifyBitcoinTransaction(
        'abc123txhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/blockchain api error/i);
    });

    test('should REJECT amount outside tolerance bounds', async () => {
      const mockTx = {
        hash: 'abc123txhash',
        block_height: 800000,
        out: [
          {
            addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            value: 99000000, // 0.99 BTC - outside 0.5% tolerance
          },
        ],
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('latestblock')) {
          return Promise.resolve({ data: { height: 800003 } });
        }
        return Promise.resolve({ data: mockTx });
      });

      const result = await cryptoService.verifyBitcoinTransaction(
        'abc123txhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/amount mismatch/i);
    });
  });

  describe('Retry Logic', () => {
    test('should retry on network errors and eventually succeed', async () => {
      let attempts = 0;
      const mockTx = {
        hash: 'abc123txhash',
        block_height: 800000,
        out: [
          {
            addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            value: 100000000,
          },
        ],
      };

      axios.get.mockImplementation((url) => {
        if (url.includes('latestblock')) {
          return Promise.resolve({ data: { height: 800003 } });
        }

        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({ data: mockTx });
      });

      const result = await cryptoService.verifyBitcoinTransaction(
        'abc123txhash',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(true);
      expect(attempts).toBe(3); // Failed 2 times, succeeded on 3rd
    });
  });
});

describe('Ethereum Transaction Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    test('should verify valid ETH payment', async () => {
      const mockTx = {
        hash: '0xabc123',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        value: '0xde0b6b3a7640000', // 1 ETH in wei (hex)
        blockNumber: '0xC35000', // hex
      };

      const mockReceipt = {
        status: '0x1', // Success
        blockNumber: '0xC35000',
      };

      const mockCurrentBlock = '0xC3500C'; // 12 blocks later

      axios.get.mockImplementation((url, config) => {
        const action = config.params.action;

        if (action === 'eth_getTransactionByHash') {
          return Promise.resolve({ data: { result: mockTx } });
        }
        if (action === 'eth_getTransactionReceipt') {
          return Promise.resolve({ data: { result: mockReceipt } });
        }
        if (action === 'eth_blockNumber') {
          return Promise.resolve({ data: { result: mockCurrentBlock } });
        }
      });

      const result = await cryptoService.verifyEthereumTransaction(
        '0xabc123',
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        1.0
      );

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(1.0);
      expect(result.confirmations).toBe(13); // Current - tx block + 1
      expect(result.status).toBe('confirmed'); // >= 12 confirmations
    });

    test('should verify ETH payment with case-insensitive address matching', async () => {
      const mockTx = {
        hash: '0xabc123',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        to: '0x742d35cc6634c0532925a3b844bc9e7595f0beb', // lowercase
        value: '0xde0b6b3a7640000',
        blockNumber: '0xC35000',
      };

      const mockReceipt = {
        status: '0x1',
        blockNumber: '0xC35000',
      };

      const mockCurrentBlock = '0xC3500C';

      axios.get.mockImplementation((url, config) => {
        const action = config.params.action;

        if (action === 'eth_getTransactionByHash') {
          return Promise.resolve({ data: { result: mockTx } });
        }
        if (action === 'eth_getTransactionReceipt') {
          return Promise.resolve({ data: { result: mockReceipt } });
        }
        if (action === 'eth_blockNumber') {
          return Promise.resolve({ data: { result: mockCurrentBlock } });
        }
      });

      const result = await cryptoService.verifyEthereumTransaction(
        '0xabc123',
        '0x742D35CC6634C0532925A3B844BC9E7595F0BEB', // UPPERCASE expected
        1.0
      );

      expect(result.verified).toBe(true);
    });
  });

  describe('Failure Cases - CRITICAL Security', () => {
    test('should REJECT ETH payment with insufficient amount', async () => {
      const mockTx = {
        hash: '0xabc123',
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        value: '0x6f05b59d3b20000', // 0.5 ETH
        blockNumber: '0xC35000',
      };

      const mockReceipt = {
        status: '0x1',
        blockNumber: '0xC35000',
      };

      const mockCurrentBlock = '0xC3500C';

      axios.get.mockImplementation((url, config) => {
        const action = config.params.action;

        if (action === 'eth_getTransactionByHash') {
          return Promise.resolve({ data: { result: mockTx } });
        }
        if (action === 'eth_getTransactionReceipt') {
          return Promise.resolve({ data: { result: mockReceipt } });
        }
        if (action === 'eth_blockNumber') {
          return Promise.resolve({ data: { result: mockCurrentBlock } });
        }
      });

      const result = await cryptoService.verifyEthereumTransaction(
        '0xabc123',
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        1.0 // Required 1.0 ETH
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/amount mismatch/i);
    });

    test('should REJECT transaction that was reverted (status = 0x0)', async () => {
      const mockTx = {
        hash: '0xabc123',
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        value: '0xde0b6b3a7640000',
        blockNumber: '0xC35000',
      };

      const mockReceipt = {
        status: '0x0', // FAILED/REVERTED!
        blockNumber: '0xC35000',
      };

      axios.get.mockImplementation((url, config) => {
        const action = config.params.action;

        if (action === 'eth_getTransactionByHash') {
          return Promise.resolve({ data: { result: mockTx } });
        }
        if (action === 'eth_getTransactionReceipt') {
          return Promise.resolve({ data: { result: mockReceipt } });
        }
      });

      const result = await cryptoService.verifyEthereumTransaction(
        '0xabc123',
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/failed|reverted/i);
    });

    test('should REJECT when transaction not found', async () => {
      axios.get.mockImplementation((url, config) => {
        return Promise.resolve({ data: { result: null } });
      });

      const result = await cryptoService.verifyEthereumTransaction(
        '0xnonexistent',
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/transaction not found/i);
    });

    test('should REJECT payment to wrong address', async () => {
      const mockTx = {
        hash: '0xabc123',
        to: '0xWRONGADDRESSXXXXXXXXXXXXXXXXXXXX', // WRONG!
        value: '0xde0b6b3a7640000',
        blockNumber: '0xC35000',
      };

      const mockReceipt = {
        status: '0x1',
        blockNumber: '0xC35000',
      };

      axios.get.mockImplementation((url, config) => {
        const action = config.params.action;

        if (action === 'eth_getTransactionByHash') {
          return Promise.resolve({ data: { result: mockTx } });
        }
        if (action === 'eth_getTransactionReceipt') {
          return Promise.resolve({ data: { result: mockReceipt } });
        }
      });

      const result = await cryptoService.verifyEthereumTransaction(
        '0xabc123',
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Expected
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/address mismatch/i);
    });
  });
});

describe('USDT TRC-20 Transaction Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    test('should verify valid USDT TRC-20 payment', async () => {
      // TRC-20 transfer encoding:
      // Method: a9059cbb (transfer)
      // Recipient: padded address (64 chars)
      // Amount: hex value in 6 decimals
      const recipientHex = '742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'; // 40 hex chars (20 bytes)
      const recipientPadded = '000000000000000000000000' + recipientHex;
      const amountHex = (100 * 1e6).toString(16).padStart(64, '0'); // 100 USDT

      // IMPORTANT: tronAddressFromHex in crypto.js is simplified - returns hex as-is
      // So we need to use hex format for both contract and recipient
      const USDT_CONTRACT_HEX = '4154524137486a514b516a4b5178475443693871385a593470';

      const mockTx = {
        ret: [{ contractRet: 'SUCCESS' }],
        raw_data: {
          contract: [
            {
              type: 'TriggerSmartContract',
              parameter: {
                value: {
                  contract_address: USDT_CONTRACT_HEX,
                  data: `a9059cbb${recipientPadded}${amountHex}`,
                },
              },
            },
          ],
        },
      };

      const mockInfo = {
        data: {
          blockNumber: 50000000,
        },
      };

      axios.post.mockImplementation((url, data) => {
        if (url.includes('gettransactionbyid')) {
          return Promise.resolve({ data: mockTx });
        }
        if (url.includes('gettransactioninfobyid')) {
          return Promise.resolve(mockInfo);
        }
      });

      const result = await cryptoService.verifyUSDTTRC20Transaction(
        'abc123txhash',
        recipientHex, // Use hex format since tronAddressFromHex is simplified
        100
      );

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(100);
      expect(result.confirmations).toBe(20); // Simplified
    });
  });

  describe('Failure Cases - CRITICAL Security', () => {
    test('should REJECT when transaction not found', async () => {
      axios.post.mockResolvedValue({ data: {} }); // No transaction

      const result = await cryptoService.verifyUSDTTRC20Transaction(
        'nonexistent',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        100
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/transaction not found/i);
    });

    test('should REJECT failed USDT transaction', async () => {
      const mockTx = {
        ret: [{ contractRet: 'REVERT' }], // FAILED!
        raw_data: {
          contract: [
            {
              type: 'TriggerSmartContract',
              parameter: {
                value: {
                  contract_address: '4154524137486a514b516a4b5178475443693871385a593470',
                  data: 'a9059cbb...',
                },
              },
            },
          ],
        },
      };

      axios.post.mockResolvedValue({ data: mockTx });

      const result = await cryptoService.verifyUSDTTRC20Transaction(
        'abc123',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        100
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/transaction failed/i);
    });

    test('should REJECT non-USDT contract transaction', async () => {
      const mockTx = {
        ret: [{ contractRet: 'SUCCESS' }],
        raw_data: {
          contract: [
            {
              type: 'TriggerSmartContract',
              parameter: {
                value: {
                  contract_address: 'WRONGCONTRACTADDRESS', // Not USDT!
                  data: 'a9059cbb...',
                },
              },
            },
          ],
        },
      };

      axios.post.mockResolvedValue({ data: mockTx });

      const result = await cryptoService.verifyUSDTTRC20Transaction(
        'abc123',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        100
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/not a usdt/i);
    });
  });
});

describe('Litecoin Transaction Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    test('should verify valid LTC payment', async () => {
      const mockResponse = {
        data: {
          data: {
            abc123txhash: {
              transaction: {
                block_id: 2500000,
              },
              outputs: [
                {
                  recipient: 'LTC1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
                  value: 100000000, // 1 LTC in litoshi
                },
              ],
              context: {
                state: 12, // confirmations
              },
            },
          },
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await cryptoService.verifyLitecoinTransaction(
        'abc123txhash',
        'LTC1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(1.0);
      expect(result.confirmations).toBe(12);
      expect(result.status).toBe('confirmed'); // >= 6 confirmations
    });
  });

  describe('Failure Cases - CRITICAL Security', () => {
    test('should REJECT LTC payment with insufficient amount', async () => {
      const mockResponse = {
        data: {
          data: {
            abc123txhash: {
              transaction: {
                block_id: 2500000,
              },
              outputs: [
                {
                  recipient: 'LTC1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
                  value: 50000000, // 0.5 LTC - INSUFFICIENT!
                },
              ],
              context: {
                state: 12,
              },
            },
          },
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await cryptoService.verifyLitecoinTransaction(
        'abc123txhash',
        'LTC1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/amount mismatch/i);
    });

    test('should REJECT when LTC transaction not found', async () => {
      axios.get.mockResolvedValue({ data: { data: {} } });

      const result = await cryptoService.verifyLitecoinTransaction(
        'nonexistent',
        'LTC1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/transaction not found/i);
    });

    test('should REJECT LTC payment to wrong address', async () => {
      const mockResponse = {
        data: {
          data: {
            abc123txhash: {
              transaction: {
                block_id: 2500000,
              },
              outputs: [
                {
                  recipient: 'LTCWRONGADDRESSXXXXXXXXXXXXXXXXX', // WRONG!
                  value: 100000000,
                },
              ],
              context: {
                state: 12,
              },
            },
          },
        },
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await cryptoService.verifyLitecoinTransaction(
        'abc123txhash',
        'LTC1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Expected
        1.0
      );

      expect(result.verified).toBe(false);
      expect(result.error).toMatch(/address not found/i);
    });
  });
});

describe('Universal verifyTransaction() - Currency Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should route BTC verification correctly', async () => {
    const mockTx = {
      hash: 'abc123',
      block_height: 800000,
      out: [
        {
          addr: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          value: 100000000,
        },
      ],
    };

    axios.get.mockImplementation((url) => {
      if (url.includes('latestblock')) {
        return Promise.resolve({ data: { height: 800003 } });
      }
      return Promise.resolve({ data: mockTx });
    });

    const result = await cryptoService.verifyTransaction(
      'abc123',
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      1.0,
      'BTC'
    );

    expect(result.verified).toBe(true);
  });

  test('should route ETH verification correctly', async () => {
    const mockTx = {
      hash: '0xabc123',
      to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      value: '0xde0b6b3a7640000',
      blockNumber: '0xC35000',
    };

    const mockReceipt = {
      status: '0x1',
      blockNumber: '0xC35000',
    };

    const mockCurrentBlock = '0xC3500C';

    axios.get.mockImplementation((url, config) => {
      const action = config.params.action;

      if (action === 'eth_getTransactionByHash') {
        return Promise.resolve({ data: { result: mockTx } });
      }
      if (action === 'eth_getTransactionReceipt') {
        return Promise.resolve({ data: { result: mockReceipt } });
      }
      if (action === 'eth_blockNumber') {
        return Promise.resolve({ data: { result: mockCurrentBlock } });
      }
    });

    const result = await cryptoService.verifyTransaction(
      '0xabc123',
      '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      1.0,
      'ETH'
    );

    expect(result.verified).toBe(true);
  });

  test('should REJECT unsupported currency', async () => {
    const result = await cryptoService.verifyTransaction(
      'abc123',
      'address',
      1.0,
      'DOGE' // Unsupported!
    );

    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/unsupported currency/i);
  });
});
