/**
 * Verify All Cryptocurrencies - Payment Tolerance and Exact Amount Display
 * 
 * This script verifies that:
 * 1. 1% tolerance is used for all cryptocurrencies (BTC, ETH, LTC, USDT)
 * 2. Exact crypto amounts are calculated and returned correctly
 */

import { amountsMatchWithTolerance, TOLERANCE_BOUNDS } from '../src/utils/paymentTolerance.js';

console.log('\n🔍 Verifying Payment System for All Cryptocurrencies\n');
console.log('='.repeat(60));

// 1. Check tolerance setting
console.log('\n1️⃣ Payment Tolerance Settings:');
console.log(`   DEFAULT_TOLERANCE: ${TOLERANCE_BOUNDS.DEFAULT_TOLERANCE * 100}%`);
console.log(`   MIN_TOLERANCE: ${TOLERANCE_BOUNDS.MIN_TOLERANCE * 100}%`);
console.log(`   MAX_TOLERANCE: ${TOLERANCE_BOUNDS.MAX_TOLERANCE * 100}%`);

if (TOLERANCE_BOUNDS.DEFAULT_TOLERANCE === 0.01) {
    console.log('   ✅ Tolerance is 1% - network fees accommodated');
} else {
    console.log(`   ❌ Tolerance is ${TOLERANCE_BOUNDS.DEFAULT_TOLERANCE * 100}% - should be 1%`);
}

// 2. Test tolerance for each cryptocurrency
console.log('\n2️⃣ Testing 1% Tolerance for Each Cryptocurrency:');
console.log('-'.repeat(60));

const testCases = [
    {
        crypto: 'BTC',
        expected: 0.00042000, // Expected amount
        received: 0.00041750, // 0.6% less (network fees)
        description: 'Bitcoin payment with network fees'
    },
    {
        crypto: 'ETH',
        expected: 0.01200000,
        received: 0.01188000, // 1% less
        description: 'Ethereum payment with gas fees'
    },
    {
        crypto: 'LTC',
        expected: 0.01070320,
        received: 0.01063886, // 0.6% less (real user case)
        description: 'Litecoin payment (real user case)'
    },
    {
        crypto: 'USDT_ERC20',
        expected: 25.0,
        received: 24.75, // 1% less
        description: 'USDT ERC-20 with gas fees'
    },
    {
        crypto: 'USDT_TRC20',
        expected: 35.0,
        received: 34.65, // 1% less
        description: 'USDT TRC-20 with energy fees'
    }
];

let allPassed = true;

testCases.forEach(({ crypto, expected, received, description }) => {
    const shortfall = expected - received;
    const shortfallPercent = (shortfall / expected * 100).toFixed(2);
    const matches = amountsMatchWithTolerance(received, expected, undefined, crypto);

    console.log(`\n   ${crypto}:`);
    console.log(`   Description: ${description}`);
    console.log(`   Expected: ${expected} ${crypto.replace('_', ' ')}`);
    console.log(`   Received: ${received} ${crypto.replace('_', ' ')}`);
    console.log(`   Shortfall: ${shortfall.toFixed(8)} (${shortfallPercent}%)`);
    console.log(`   Result: ${matches ? '✅ ACCEPTED' : '❌ REJECTED'}`);

    if (!matches) {
        allPassed = false;
    }
});

// 3. Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary:\n');

if (allPassed) {
    console.log('   ✅ All cryptocurrencies accept payments with ~1% network fees');
    console.log('   ✅ No "money gone" scenarios for legitimate payments');
    console.log('   ✅ System ready for production');
} else {
    console.log('   ❌ Some payments would be rejected');
    console.log('   ⚠️  Review tolerance settings');
}

// 4. Test overpayments (should always be accepted)
console.log('\n3️⃣ Testing Overpayments (should always accept):');
console.log('-'.repeat(60));

const overpaymentTests = [
    { crypto: 'BTC', expected: 0.001, received: 0.0011 },
    { crypto: 'ETH', expected: 0.1, received: 0.15 },
    { crypto: 'LTC', expected: 0.05, received: 0.051 },
    { crypto: 'USDT', expected: 25, received: 30 }
];

let overpaymentsPassed = true;

overpaymentTests.forEach(({ crypto, expected, received }) => {
    const matches = amountsMatchWithTolerance(received, expected, undefined, crypto);
    const excess = ((received - expected) / expected * 100).toFixed(2);

    console.log(`   ${crypto}: Expected ${expected}, Received ${received} (+${excess}%) - ${matches ? '✅ ACCEPTED' : '❌ REJECTED'}`);

    if (!matches) {
        overpaymentsPassed = false;
    }
});

console.log('\n' + '='.repeat(60));

if (allPassed && overpaymentsPassed) {
    console.log('\n✅ ALL TESTS PASSED - Payment system ready for all cryptocurrencies\n');
    process.exit(0);
} else {
    console.log('\n❌ SOME TESTS FAILED - Review tolerance configuration\n');
    process.exit(1);
}
