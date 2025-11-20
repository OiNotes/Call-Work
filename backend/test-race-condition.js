/**
 * Test: Race Condition Fix for getNextIndex()
 *
 * This test simulates 10 concurrent requests for wallet address generation
 * and verifies that all indices are unique (no duplicates).
 *
 * Before fix: SELECT MAX(address_index) + 1 could return same value for concurrent requests
 * After fix: PostgreSQL SEQUENCE guarantees atomicity and uniqueness
 */

import { invoiceQueries } from './src/database/queries/index.js';
import { query } from './src/config/database.js';

async function testRaceCondition() {
  console.log('🧪 Testing Race Condition Fix for Wallet Address Generation\n');

  const CHAINS = ['BTC', 'ETH', 'USDT_ERC20', 'USDT_TRC20', 'LTC'];
  const CONCURRENT_REQUESTS = 10;

  for (const chain of CHAINS) {
    console.log(`\n📊 Testing ${chain}:`);
    console.log('─'.repeat(50));

    try {
      // Get current sequence value
      const sequenceName = `wallet_address_index_${chain.toLowerCase()}`;
      const currentResult = await query(`SELECT last_value FROM ${sequenceName}`, []);
      const startValue = parseInt(currentResult.rows[0].last_value, 10);
      console.log(`Starting sequence value: ${startValue}`);

      // Fire 10 concurrent requests for next index
      console.log(`\nFiring ${CONCURRENT_REQUESTS} concurrent requests...`);
      const promises = Array(CONCURRENT_REQUESTS)
        .fill(null)
        .map(() => invoiceQueries.getNextIndex(chain));

      const indices = await Promise.all(promises);

      // Check for uniqueness
      const uniqueIndices = new Set(indices);
      const hasDuplicates = uniqueIndices.size !== indices.length;

      console.log(`\nResults:`);
      console.log(`  Received indices: [${indices.join(', ')}]`);
      console.log(`  Unique count: ${uniqueIndices.size} / ${indices.length}`);

      if (hasDuplicates) {
        console.log('  ❌ RACE CONDITION DETECTED - Found duplicate indices!');
        const duplicates = indices.filter((item, index) => indices.indexOf(item) !== index);
        console.log(`  Duplicates: [${[...new Set(duplicates)].join(', ')}]`);
        return false;
      } else {
        console.log('  ✅ All indices unique - No race condition');
      }

      // Verify indices are sequential
      const sortedIndices = [...indices].sort((a, b) => a - b);
      const isSequential = sortedIndices.every(
        (val, i) => i === 0 || val === sortedIndices[i - 1] + 1
      );

      if (isSequential) {
        console.log('  ✅ Indices are sequential (expected behavior)');
      } else {
        console.log('  ⚠️  Indices are not sequential (acceptable, but unexpected)');
      }
    } catch (error) {
      console.log(`  ❌ Error testing ${chain}:`, error.message);
      return false;
    }
  }

  return true;
}

// Run test
console.log('═'.repeat(60));
console.log('  RACE CONDITION FIX VERIFICATION TEST');
console.log('═'.repeat(60));

testRaceCondition()
  .then((success) => {
    console.log('\n' + '═'.repeat(60));
    if (success) {
      console.log('✅ TEST PASSED - Race condition fixed!');
      console.log('   PostgreSQL SEQUENCE ensures atomic index generation');
      process.exit(0);
    } else {
      console.log('❌ TEST FAILED - Race condition still exists!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  });
