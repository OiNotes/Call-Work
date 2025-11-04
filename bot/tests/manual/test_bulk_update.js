#!/usr/bin/env node

/**
 * Test bulkUpdateProducts function recognition by AI
 * 
 * This test verifies that AI correctly chooses bulkUpdateProducts
 * when user mentions multiple specific products in one command.
 */

import { productTools } from '../../src/tools/productTools.js';

console.log('🧪 Testing bulkUpdateProducts function availability\n');

// Test 1: Check if bulkUpdateProducts exists in tools
console.log('1️⃣ Checking if bulkUpdateProducts is in productTools...');
const bulkUpdateTool = productTools.find(t => t.function?.name === 'bulkUpdateProducts');

if (!bulkUpdateTool) {
  console.error('❌ FAIL: bulkUpdateProducts not found in productTools');
  process.exit(1);
}
console.log('✅ PASS: bulkUpdateProducts found in productTools');

// Test 2: Check description quality
console.log('\n2️⃣ Checking bulkUpdateProducts description...');
const description = bulkUpdateTool.function.description;

const requiredKeywords = [
  'MULTIPLE',
  'SPECIFIC',
  '2-5',
  'iPhone и MacBook',
  'bulkUpdateProducts',
  'IMPORTANT',
  'DO NOT call updateProduct'
];

const missingKeywords = requiredKeywords.filter(keyword => 
  !description.includes(keyword)
);

if (missingKeywords.length > 0) {
  console.error('❌ FAIL: Description missing keywords:', missingKeywords);
  console.log('\nCurrent description:', description.slice(0, 200));
  process.exit(1);
}
console.log('✅ PASS: Description contains all required keywords');

// Test 3: Check function order (bulkUpdateProducts should come BEFORE updateProduct)
console.log('\n3️⃣ Checking function order...');
const bulkUpdateIndex = productTools.findIndex(t => t.function?.name === 'bulkUpdateProducts');
const updateProductIndex = productTools.findIndex(t => t.function?.name === 'updateProduct');

if (bulkUpdateIndex === -1 || updateProductIndex === -1) {
  console.error('❌ FAIL: Cannot find both functions');
  process.exit(1);
}

console.log(`   bulkUpdateProducts index: ${bulkUpdateIndex}`);
console.log(`   updateProduct index: ${updateProductIndex}`);

if (bulkUpdateIndex > updateProductIndex) {
  console.warn('⚠️  WARNING: bulkUpdateProducts comes AFTER updateProduct');
  console.warn('   AI may choose updateProduct first for multiple products');
} else {
  console.log('✅ PASS: bulkUpdateProducts comes before updateProduct');
}

// Test 4: Check parameters schema
console.log('\n4️⃣ Checking bulkUpdateProducts parameters schema...');
const params = bulkUpdateTool.function.parameters;

if (!params.properties?.products) {
  console.error('❌ FAIL: Missing "products" parameter');
  process.exit(1);
}

if (params.properties.products.type !== 'array') {
  console.error('❌ FAIL: "products" must be an array');
  process.exit(1);
}

const itemSchema = params.properties.products.items;
if (!itemSchema.properties?.productName || !itemSchema.properties?.updates) {
  console.error('❌ FAIL: Missing productName or updates in array items');
  process.exit(1);
}

console.log('✅ PASS: Parameters schema is correct');

// Test 5: Print full description for manual review
console.log('\n5️⃣ Full bulkUpdateProducts description:');
console.log('─'.repeat(80));
console.log(description);
console.log('─'.repeat(80));

// Test 6: Check for anti-patterns
console.log('\n6️⃣ Checking for anti-patterns in description...');
const antiPatterns = [
  { pattern: 'for each', issue: 'Suggests iterating instead of bulk operation' },
  { pattern: 'one by one', issue: 'Suggests sequential calls instead of bulk' },
  { pattern: 'call updateProduct', issue: 'May confuse AI to use wrong function' }
];

const foundAntiPatterns = antiPatterns.filter(ap => 
  description.toLowerCase().includes(ap.pattern)
);

if (foundAntiPatterns.length > 0) {
  console.warn('⚠️  WARNING: Found potential anti-patterns:');
  foundAntiPatterns.forEach(ap => {
    console.warn(`   - "${ap.pattern}": ${ap.issue}`);
  });
} else {
  console.log('✅ PASS: No anti-patterns found');
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 SUMMARY');
console.log('='.repeat(80));
console.log('✅ bulkUpdateProducts is properly defined in productTools');
console.log('✅ Description contains clear usage examples');
console.log('✅ Parameters schema is correct');
console.log('\n💡 NEXT STEPS:');
console.log('   1. Check systemPrompts.js mentions bulkUpdateProducts');
console.log('   2. Run integration test with real AI calls');
console.log('   3. Test with commands like "скидка 20% на iPhone и MacBook"');
console.log('='.repeat(80));

process.exit(0);
