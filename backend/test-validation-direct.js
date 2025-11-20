#!/usr/bin/env node
/**
 * Direct validation test - bypasses HTTP and auth
 */

import { orderValidation } from './src/middleware/validation.js';

// Mock Express req/res/next
function createMockReq(body) {
  return {
    body,
    query: {},
    params: {},
    headers: {},
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    responseData: null,
  };

  res.status = function (code) {
    this.statusCode = code;
    return this;
  };

  res.json = function (data) {
    this.responseData = data;
    return this;
  };

  return res;
}

async function runValidation(validationChain, body) {
  const req = createMockReq(body);
  const res = createMockRes();
  let nextCalled = false;

  const next = (err) => {
    if (err) throw err;
    nextCalled = true;
  };

  // Run all validators in chain
  for (const validator of validationChain) {
    await validator(req, res, next);
  }

  return { req, res, nextCalled };
}

console.log('\n🧪 Direct Validation Test - No HTTP/Auth\n');
console.log('='.repeat(60));

// Test 1: New multi-item format
console.log('\n📦 Test 1: New multi-item format');
console.log('Body: { items: [{ productId: 1, quantity: 2 }] }');

try {
  const result1 = await runValidation(orderValidation.create, {
    items: [{ productId: 1, quantity: 2 }],
    deliveryAddress: 'Test address',
  });

  if (result1.res.statusCode === 400) {
    console.log('❌ FAIL - Validation rejected new format');
    console.log('   Errors:', JSON.stringify(result1.res.responseData, null, 2));
  } else if (result1.nextCalled) {
    console.log('✅ PASS - New format accepted by validation');
  } else {
    console.log('⚠️  UNEXPECTED - Validation chain incomplete');
  }
} catch (error) {
  console.log('❌ ERROR:', error.message);
}

// Test 2: Legacy single-item format
console.log('\n\n📦 Test 2: Legacy single-item format');
console.log('Body: { productId: 1, quantity: 3 }');

try {
  const result2 = await runValidation(orderValidation.create, {
    productId: 1,
    quantity: 3,
    deliveryAddress: 'Test address legacy',
  });

  if (result2.res.statusCode === 400) {
    console.log('❌ FAIL - Validation rejected legacy format');
    console.log('   Errors:', JSON.stringify(result2.res.responseData, null, 2));
  } else if (result2.nextCalled) {
    console.log('✅ PASS - Legacy format accepted by validation');
  } else {
    console.log('⚠️  UNEXPECTED - Validation chain incomplete');
  }
} catch (error) {
  console.log('❌ ERROR:', error.message);
}

// Test 3: Invalid - neither format
console.log('\n\n❌ Test 3: Invalid request (no items, no productId)');
console.log('Body: { deliveryAddress: "..." } (should fail)');

try {
  const result3 = await runValidation(orderValidation.create, {
    deliveryAddress: 'Test address',
  });

  if (result3.res.statusCode === 400) {
    console.log('✅ PASS - Correctly rejected invalid request');
    console.log(
      '   Error:',
      result3.res.responseData?.errors?.[0]?.msg || JSON.stringify(result3.res.responseData)
    );
  } else if (result3.nextCalled) {
    console.log('❌ FAIL - Should have rejected invalid request');
  } else {
    console.log('⚠️  UNEXPECTED - Validation chain incomplete');
  }
} catch (error) {
  console.log('❌ ERROR:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ Direct validation tests completed\n');
