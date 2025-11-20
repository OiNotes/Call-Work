#!/usr/bin/env node
/**
 * Test script to verify order validation supports both formats
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';
const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidGVsZWdyYW1JZCI6IjE5OTc4MTU3ODciLCJ1c2VybmFtZSI6IlNpdGhpbDE1IiwiaWF0IjoxNzYyNTMzMDY1LCJleHAiOjE3NjMxMzc4NjV9.UldbK0lKMzCPL4QQcw159L0cYD7MtXbZBXtJFUoazNo';

async function testOrderValidation() {
  console.log('\n🧪 Testing Order Validation - Both Formats\n');
  console.log('='.repeat(60));

  // Test 1: New multi-item format
  console.log('\n📦 Test 1: New multi-item format');
  console.log('Request: { items: [{ productId: 1, quantity: 2 }] }');

  try {
    const response1 = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 2 }],
        deliveryAddress: 'Test address',
      }),
    });

    const data1 = await response1.json();

    if (response1.status === 201 || response1.status === 200) {
      console.log('✅ PASS - New format accepted');
      console.log(`   Response: ${response1.status} ${response1.statusText}`);
      if (data1.invoice) {
        console.log(`   Invoice ID: ${data1.invoice.id}`);
        console.log(`   Amount: ${data1.invoice.amount} ${data1.invoice.currency}`);
      }
    } else if (response1.status === 400) {
      console.log('❌ FAIL - Validation error');
      console.log(`   Status: ${response1.status}`);
      console.log(`   Errors:`, JSON.stringify(data1.errors || data1.error, null, 2));
    } else {
      console.log(`⚠️  UNEXPECTED - Status ${response1.status}`);
      console.log(`   Response:`, JSON.stringify(data1, null, 2));
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  // Test 2: Legacy single-item format
  console.log('\n\n📦 Test 2: Legacy single-item format');
  console.log('Request: { productId: 1, quantity: 3 }');

  try {
    const response2 = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({
        productId: 1,
        quantity: 3,
        deliveryAddress: 'Test address legacy',
      }),
    });

    const data2 = await response2.json();

    if (response2.status === 201 || response2.status === 200) {
      console.log('✅ PASS - Legacy format accepted');
      console.log(`   Response: ${response2.status} ${response2.statusText}`);
      if (data2.invoice) {
        console.log(`   Invoice ID: ${data2.invoice.id}`);
        console.log(`   Amount: ${data2.invoice.amount} ${data2.invoice.currency}`);
      }
    } else if (response2.status === 400) {
      console.log('❌ FAIL - Validation error');
      console.log(`   Status: ${response2.status}`);
      console.log(`   Errors:`, JSON.stringify(data2.errors || data2.error, null, 2));
    } else {
      console.log(`⚠️  UNEXPECTED - Status ${response2.status}`);
      console.log(`   Response:`, JSON.stringify(data2, null, 2));
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  // Test 3: Invalid - neither format provided
  console.log('\n\n❌ Test 3: Invalid request (no items, no productId)');
  console.log('Request: { deliveryAddress: "..." } (should fail)');

  try {
    const response3 = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: JSON.stringify({
        deliveryAddress: 'Test address',
      }),
    });

    const data3 = await response3.json();

    if (response3.status === 400) {
      console.log('✅ PASS - Correctly rejected invalid request');
      console.log(`   Error message: "${data3.errors?.[0]?.msg || data3.error}"`);
    } else {
      console.log('❌ FAIL - Should have rejected invalid request');
      console.log(`   Status: ${response3.status}`);
      console.log(`   Response:`, JSON.stringify(data3, null, 2));
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Validation tests completed\n');
}

// Run tests
testOrderValidation().catch(console.error);
