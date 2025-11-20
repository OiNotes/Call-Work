#!/usr/bin/env node

/**
 * Simple AI Test - Check if processProductCommand works without complex mock
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';
const TEST_USER = {
  telegram_id: '999999',
  username: 'ai_test_user',
  first_name: 'AI',
};

async function main() {
  console.log('🧪 Simple AI Test - processProductCommand');

  try {
    // 1. Auth
    console.log('\n1️⃣ Authenticating...');
    const authRes = await axios.post(`${BASE_URL}/auth/register`, TEST_USER);
    const token = authRes.data.token || authRes.data.data?.token;
    console.log('✅ Token:', token.slice(0, 30) + '...');

    // 2. Get or create shop
    console.log('\n2️⃣ Getting shop...');
    let shop;
    try {
      const shopsRes = await axios.get(`${BASE_URL}/shops/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      shop = shopsRes.data.data?.[0];
      if (!shop) {
        const createRes = await axios.post(
          `${BASE_URL}/shops`,
          {
            name: 'AI_Simple_Test',
            description: 'Simple test shop',
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        shop = createRes.data.data || createRes.data;
      }
      console.log('✅ Shop ID:', shop.id);
    } catch (err) {
      console.error('❌ Shop error:', err.response?.data || err.message);
      return;
    }

    // 3. Get products
    console.log('\n3️⃣ Getting products...');
    const productsRes = await axios.get(`${BASE_URL}/products?shopId=${shop.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const products = productsRes.data.data || [];
    console.log('📦 Products:', products.length);

    // 4. Import processProductCommand
    console.log('\n4️⃣ Importing processProductCommand...');
    const { processProductCommand } = await import('../bot/src/services/productAI.js');

    // 5. Create minimal mock ctx
    const mockCtx = {
      from: { id: TEST_USER.telegram_id },
      session: {},
      sendChatAction: async () => {},
      reply: async (text) => console.log('📨 Bot reply:', text.slice(0, 100)),
      editMessageText: async (text) => console.log('✏️ Edit:', text.slice(0, 100)),
    };

    // 6. Test: Add Product
    console.log('\n5️⃣ Testing: добавь iPhone 999');
    const result = await processProductCommand('добавь iPhone 999', {
      shopId: shop.id,
      shopName: shop.name,
      token,
      products,
      ctx: mockCtx,
    });

    console.log('\n📊 Result:', JSON.stringify(result, null, 2).slice(0, 500));

    // 7. Check DB
    console.log('\n6️⃣ Checking DB...');
    const checkRes = await axios.get(`${BASE_URL}/products?shopId=${shop.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const newProducts = checkRes.data.data || [];
    console.log(
      '📦 Products after command:',
      newProducts.map((p) => `${p.name}: $${p.price}`)
    );

    if (newProducts.length > products.length) {
      console.log('\n✅ SUCCESS: Product added!');
    } else {
      console.log('\n❌ FAIL: Product not added');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    console.error(error.stack);
  }
}

main();
