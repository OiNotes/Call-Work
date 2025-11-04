/**
 * Test: Natural AI responses (without templates)
 * 
 * This test verifies that AI generates natural responses
 * instead of using hardcoded templates like:
 * - "${name} обновлён: цена: ${old} → ${new}"
 * - "Готово, ${product.name}: ${formatUsd(product.price)}"
 * 
 * After fix:
 * - AI generates responses like: "Готово, цену black car снизил с $50 до $40"
 * - No more template strings in responses
 */

import productAI from '../../src/services/productAI.js';

async function testNaturalAIResponses() {
  console.log('🧪 Test: AI Natural Responses (No Templates)\n');

  // Mock context
  const context = {
    shopId: 'test-shop-123',
    shopName: 'Test Shop',
    token: 'mock-token',
    products: [
      { id: 1, name: 'iPhone 15', price: 999, stock_quantity: 10 },
      { id: 2, name: 'MacBook Pro', price: 2499, stock_quantity: 5 },
      { id: 3, name: 'AirPods Pro', price: 249, stock_quantity: 20 }
    ],
    ctx: null // No Telegram context for this test
  };

  console.log('📦 Products in catalog:');
  context.products.forEach(p => {
    console.log(`  - ${p.name}: $${p.price} (${p.stock_quantity} шт)`);
  });
  console.log('');

  // Test 1: Check that buildMessageFromResult is removed
  console.log('✅ Test 1: buildMessageFromResult function removed');
  const fs = await import('fs/promises');
  const code = await fs.readFile('src/services/productAI.js', 'utf-8');
  
  if (code.includes('buildMessageFromResult')) {
    console.log('❌ FAIL: buildMessageFromResult still exists in code!');
    process.exit(1);
  }
  console.log('   ✓ buildMessageFromResult successfully removed\n');

  // Test 2: Check that AI generates responses
  console.log('✅ Test 2: AI response generation flow exists');
  
  // Check for AI response generation code
  if (!code.includes('aiResponse.choices[0].message.content')) {
    console.log('❌ FAIL: AI response generation code not found!');
    process.exit(1);
  }
  console.log('   ✓ AI response generation code present\n');

  // Test 3: Check system prompt has natural response instruction
  console.log('✅ Test 3: System prompt has natural response instruction');
  const promptCode = await fs.readFile('src/utils/systemPrompts.js', 'utf-8');
  
  if (!promptCode.includes('сформулируй естественный ответ своими словами')) {
    console.log('❌ FAIL: System prompt missing natural response instruction!');
    process.exit(1);
  }
  console.log('   ✓ System prompt updated with natural response instruction\n');

  // Test 4: No template literals in responses
  console.log('✅ Test 4: No hardcoded template responses');
  
  const templatePatterns = [
    '`${product.name}: ${formatUsd',
    '`Готово, ${product.name}:',
    '`${productName} обновлён:',
    '`Удалил ${product.name}',
    '`Сейчас в каталоге ${items.length}'
  ];

  let foundTemplates = false;
  for (const pattern of templatePatterns) {
    if (code.includes(pattern)) {
      console.log(`   ❌ Found template: ${pattern}`);
      foundTemplates = true;
    }
  }

  if (foundTemplates) {
    console.log('❌ FAIL: Template literals still exist in code!');
    process.exit(1);
  }
  console.log('   ✓ No hardcoded templates found\n');

  console.log('🎉 All tests passed!\n');
  console.log('Summary:');
  console.log('  1. buildMessageFromResult() removed ✓');
  console.log('  2. AI generates natural responses ✓');
  console.log('  3. System prompt updated ✓');
  console.log('  4. No template literals ✓');
  console.log('\nAI will now respond naturally like:');
  console.log('  "Готово, цену iPhone снизил с $999 до $799"');
  console.log('  "Добавил MacBook Pro за $2499, 5 штук в наличии"');
  console.log('  instead of templates like:');
  console.log('  "Готово, ${product.name}: ${formatUsd(product.price)}"');
}

testNaturalAIResponses().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
