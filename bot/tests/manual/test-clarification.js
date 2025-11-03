/**
 * Manual Test: AI Product Selection After Clarification
 * Tests that after user selects a product from clarification list,
 * the original operation (update/delete/record_sale/info) is executed correctly
 */

import { processProductCommand } from '../../src/services/productAI.js';
import logger from '../../src/utils/logger.js';

logger.level = 'info';

// Mock Telegraf context
function createMockContext(userId, shopId, token) {
  return {
    from: { id: userId },
    chat: { id: userId },
    match: null, // Will be set during callback
    session: {
      shopId,
      token,
      role: 'seller',
      shopName: 'Test Shop',
      aiConversation: null
    },
    message: { text: '' },
    sendChatAction: () => Promise.resolve(true),
    answerCbQuery: () => Promise.resolve(true),
    telegram: {
      editMessageText: async (chatId, messageId, _, text) => {
        console.log('📝 Edit message:', text);
        return { message_id: messageId, chat: { id: chatId }, text };
      },
      deleteMessage: () => {
        console.log('🗑️ Delete message');
        return Promise.resolve(true);
      }
    },
    reply: async (text) => {
      console.log('💬 Reply:', text);
      return { message_id: 123, chat: { id: userId }, text };
    },
    editMessageText: async (text, _extra) => {
      console.log('✏️ Edit message text:', text);
      return { message_id: 123, chat: { id: userId }, text };
    },
    deleteMessage: () => {
      console.log('🗑️ Delete message (ctx)');
      return Promise.resolve(true);
    }
  };
}

// Test scenario: Update product price with clarification
async function testUpdateWithClarification() {
  console.log('\n=== Test: Update Product with Clarification ===\n');

  const ctx = createMockContext(12345, 1, 'test-token');
  ctx.message.text = 'создай скидку 50% на iPhone';

  // Mock products (multiple iPhones)
  const mockProducts = [
    { id: 1, name: 'iPhone 12', price: 1000, stock_quantity: 10 },
    { id: 2, name: 'iPhone 13', price: 1200, stock_quantity: 5 },
    { id: 3, name: 'iPhone 14', price: 1400, stock_quantity: 3 }
  ];

  console.log('📦 Mock products:', mockProducts);
  console.log('💬 User command:', ctx.message.text);

  // Step 1: Process command - should return clarification
  console.log('\n--- Step 1: Initial AI processing ---');
  const result1 = await processProductCommand(ctx.message.text, {
    shopId: ctx.session.shopId,
    shopName: ctx.session.shopName,
    token: ctx.session.token,
    products: mockProducts,
    ctx
  });

  console.log('Result:', {
    success: result1.success,
    needsClarification: result1.needsClarification,
    message: result1.message,
    data: result1.data
  });

  if (!result1.needsClarification) {
    console.error('❌ Expected clarification request, got direct result');
    return;
  }

  // Check that pendingAI was stored
  if (!ctx.session.pendingAI) {
    console.error('❌ pendingAI not stored in session');
    return;
  }

  console.log('✅ Clarification stored:', {
    operation: ctx.session.pendingAI.operation,
    options: ctx.session.pendingAI.options?.length,
    originalCommand: ctx.session.pendingAI.originalCommand
  });

  // Step 2: User selects product
  console.log('\n--- Step 2: User selects iPhone 13 (id=2) ---');
  ctx.match = ['ai_select:2', '2']; // Simulate callback_data

  // Mock handleAISelection call
  console.log('Calling handleAISelection...');
  
  // Since we can't easily call handleAISelection directly (needs full Telegraf setup),
  // we'll simulate what it does:
  const selectedProductId = parseInt(ctx.match[1]);
  const selectedProduct = ctx.session.pendingAI.options.find(p => p.id === selectedProductId);
  const originalCommand = ctx.session.pendingAI.originalCommand;

  console.log('Selected product:', selectedProduct);
  console.log('Original command:', originalCommand);

  // Clear pendingAI (as handleAISelection does)
  delete ctx.session.pendingAI;

  // Re-process with clarifiedProductId
  console.log('\n--- Step 3: Re-process with clarifiedProductId ---');
  const result2 = await processProductCommand(originalCommand, {
    shopId: ctx.session.shopId,
    shopName: ctx.session.shopName,
    token: ctx.session.token,
    products: mockProducts,
    ctx,
    clarifiedProductId: selectedProductId,
    clarifiedProductName: selectedProduct.name
  });

  console.log('\nFinal result:', {
    success: result2.success,
    message: result2.message,
    data: result2.data,
    operation: result2.operation
  });

  if (result2.success) {
    console.log('\n✅ TEST PASSED: Product operation executed after clarification');
    console.log('   - Original command:', originalCommand);
    console.log('   - Selected product:', selectedProduct.name);
    console.log('   - AI response:', result2.message);
  } else {
    console.log('\n❌ TEST FAILED:', result2.message);
  }
}

// Test scenario: Delete product with clarification
async function testDeleteWithClarification() {
  console.log('\n=== Test: Delete Product with Clarification ===\n');

  const ctx = createMockContext(12345, 1, 'test-token');
  ctx.message.text = 'удали Samsung';

  const mockProducts = [
    { id: 1, name: 'Samsung Galaxy S21', price: 800, stock_quantity: 5 },
    { id: 2, name: 'Samsung Galaxy S22', price: 900, stock_quantity: 3 },
  ];

  console.log('📦 Mock products:', mockProducts);
  console.log('💬 User command:', ctx.message.text);

  // Step 1: Process command
  const result1 = await processProductCommand(ctx.message.text, {
    shopId: ctx.session.shopId,
    shopName: ctx.session.shopName,
    token: ctx.session.token,
    products: mockProducts,
    ctx
  });

  if (!result1.needsClarification) {
    console.error('❌ Expected clarification request');
    return;
  }

  console.log('✅ Clarification requested');

  // Step 2: Select product
  ctx.match = ['ai_select:1', '1'];
  const selectedProductId = parseInt(ctx.match[1]);
  const selectedProduct = ctx.session.pendingAI.options.find(p => p.id === selectedProductId);
  const originalCommand = ctx.session.pendingAI.originalCommand;

  delete ctx.session.pendingAI;

  // Step 3: Re-process
  const result2 = await processProductCommand(originalCommand, {
    shopId: ctx.session.shopId,
    shopName: ctx.session.shopName,
    token: ctx.session.token,
    products: mockProducts,
    ctx,
    clarifiedProductId: selectedProductId,
    clarifiedProductName: selectedProduct.name
  });

  console.log('\nFinal result:', {
    success: result2.success,
    message: result2.message
  });

  if (result2.success) {
    console.log('\n✅ TEST PASSED: Delete executed after clarification');
  } else {
    console.log('\n❌ TEST FAILED:', result2.message);
  }
}

// Run tests
(async () => {
  try {
    console.log('\n🧪 Starting AI Clarification Tests...\n');
    
    await testUpdateWithClarification();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between tests
    
    await testDeleteWithClarification();
    
    console.log('\n✅ All tests completed\n');
  } catch (error) {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  }
})();
