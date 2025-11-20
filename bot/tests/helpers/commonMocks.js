/**
 * Common Mock Helpers for Bot Tests
 *
 * Provides reusable mock functions for frequently used API endpoints
 */

/**
 * Mock shop validation endpoint (required by validateShopBeforeScene middleware)
 *
 * @param {MockAdapter} mock - axios-mock-adapter instance
 * @param {number} shopId - Shop ID to mock
 * @param {object} shopData - Additional shop data to include
 */
export function mockShopValidation(mock, shopId = 1, shopData = {}) {
  mock.onGet(`/shops/${shopId}`).reply(200, {
    data: {
      id: shopId,
      name: shopData.name || 'Test Shop',
      tier: shopData.tier || 'basic',
      owner_id: shopData.owner_id || 1,
      seller_id: shopData.seller_id || 1,
      ...shopData,
    },
  });
}
