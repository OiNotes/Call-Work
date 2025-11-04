#!/usr/bin/env node

/**
 * Bulk Operations Test Suite
 * 
 * Тестирует работу AI с группой товаров (15 тестовых сценариев)
 * 
 * Используется:
 * - Реальная БД (PostgreSQL)
 * - Реальный AI (DeepSeek API)
 * - Реальный Backend API
 * 
 * Usage:
 *   node bot/tests/manual/test-bulk-operations.js
 */

import axios from 'axios';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { processProductCommand } from '../../src/services/productAI.js';
import logger from '../../src/utils/logger.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
dotenv.config({ path: join(__dirname, '../../.env') });

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL;
const AI_DELAY = 2000; // 2 seconds delay for AI processing

// Test user credentials
const TEST_USER = {
  telegramId: 999999999,
  username: 'bulk_test_user',
  firstName: 'Bulk Test',
  lastName: 'User'
};

// Global state
let AUTH_TOKEN = null;
let SHOP_ID = null;
let USER_ID = null;
let pool = null;

// Logging level
logger.level = 'warn'; // Suppress debug logs

// ============================================
// Utility Functions
// ============================================

/**
 * Create mock Telegraf context for AI processing
 */
function createMockContext(userId, shopId, token, shopName = 'Test Shop') {
  return {
    from: { id: userId },
    chat: { id: userId },
    session: {
      shopId,
      token,
      role: 'seller',
      shopName,
      aiConversation: null
    },
    message: { text: '' },
    sendChatAction: () => Promise.resolve(true),
    telegram: {
      editMessageText: async () => ({ message_id: 1, chat: { id: userId }, text: '' }),
      deleteMessage: () => Promise.resolve(true)
    },
    reply: async (text) => ({ message_id: 1, chat: { id: userId }, text }),
    editMessageText: async (text) => ({ message_id: 1, chat: { id: userId }, text }),
    deleteMessage: () => Promise.resolve(true)
  };
}

/**
 * Send command to AI and wait for processing
 */
async function sendAICommand(command, products = []) {
  const ctx = createMockContext(USER_ID, SHOP_ID, AUTH_TOKEN);
  
  const result = await processProductCommand(command, {
    shopId: SHOP_ID,
    shopName: 'Bulk Test Shop',
    token: AUTH_TOKEN,
    products,
    ctx
  });

  // Wait for DB update
  await new Promise(resolve => setTimeout(resolve, AI_DELAY));

  return result;
}

/**
 * Get product by name from DB
 */
async function getProductByName(name) {
  const result = await pool.query(
    'SELECT * FROM products WHERE shop_id = $1 AND name ILIKE $2',
    [SHOP_ID, name]
  );
  return result.rows[0] || null;
}

/**
 * Get all products for current shop
 */
async function getAllProducts() {
  const result = await pool.query(
    'SELECT * FROM products WHERE shop_id = $1 ORDER BY id',
    [SHOP_ID]
  );
  return result.rows;
}

/**
 * Clear all products for current shop
 */
async function clearProducts() {
  await pool.query('DELETE FROM products WHERE shop_id = $1', [SHOP_ID]);
}

/**
 * Add test product directly to DB
 */
async function addTestProduct(name, price, stock = 10, discount = 0) {
  const result = await pool.query(
    `INSERT INTO products (shop_id, name, price, stock_quantity, currency, discount_percentage) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING *`,
    [SHOP_ID, name, price, stock, 'USD', discount]
  );
  return result.rows[0];
}

/**
 * Format result for display
 */
function formatResult(testName, passed, error = null, details = null) {
  const icon = passed ? '✅' : '❌';
  const status = passed ? 'PASS' : 'FAIL';
  
  console.log(`${icon} ${status}: ${testName}`);
  
  if (!passed && error) {
    console.log(`   Error: ${error}`);
  }
  
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
  
  console.log(''); // Empty line
}

// ============================================
// Test Setup & Cleanup
// ============================================

async function setup() {
  console.log('🔧 Setup: Creating test environment...\n');

  // Initialize DB pool
  pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // 1. Register/login user
    const authRes = await axios.post(`${BACKEND_URL}/api/auth/register`, TEST_USER);
    AUTH_TOKEN = authRes.data.token;
    USER_ID = authRes.data.user.id;
    
    if (!AUTH_TOKEN || !USER_ID) {
      throw new Error('Failed to get auth token or user ID');
    }

    // 3. Get or create shop
    const shopsRes = await axios.get(`${BACKEND_URL}/api/shops/my`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });

    if (shopsRes.data.data?.length > 0) {
      SHOP_ID = shopsRes.data.data[0].id;
    } else {
      const createRes = await axios.post(`${BACKEND_URL}/api/shops`, {
        name: 'Bulk_Test_Shop',
        description: 'Test shop for bulk operations'
      }, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
      });
      SHOP_ID = createRes.data.data?.id || createRes.data.id;
    }

    // 4. Clear existing products
    await clearProducts();

    console.log('✅ Setup complete');
    console.log(`   User ID: ${USER_ID}`);
    console.log(`   Shop ID: ${SHOP_ID}`);
    console.log(`   Token: ${AUTH_TOKEN.slice(0, 20)}...`);
    console.log('');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    throw error;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleanup: Clearing test data...');
  
  try {
    await clearProducts();
    await pool.end();
    console.log('✅ Cleanup complete\n');
  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
  }
}

// ============================================
// Test Cases
// ============================================

/**
 * Группа 1: Обновление группы товаров (5 тестов)
 */

// Test 1: Скидка 20% на 2 товара
async function test1_discount_two_products() {
  await clearProducts();
  await addTestProduct('iPhone', 999);
  await addTestProduct('MacBook', 1999);

  const products = await getAllProducts();
  await sendAICommand('скидка 20% на iPhone и MacBook', products);

  const iphone = await getProductByName('iPhone');
  const macbook = await getProductByName('MacBook');

  if (!iphone || !macbook) {
    formatResult('Test 1: Скидка 20% на iPhone и MacBook', false, 'Товары не найдены');
    return false;
  }

  const passed = 
    Number(iphone.discount_percentage) === 20 &&
    Number(macbook.discount_percentage) === 20;

  formatResult(
    'Test 1: Скидка 20% на iPhone и MacBook',
    passed,
    passed ? null : `iPhone: ${iphone.discount_percentage}%, MacBook: ${macbook.discount_percentage}%`,
    { 
      iphone: { discount: iphone.discount_percentage, price: iphone.price },
      macbook: { discount: macbook.discount_percentage, price: macbook.price }
    }
  );

  return passed;
}

// Test 2: Установка цены 100 для 3 товаров
async function test2_set_price_three_products() {
  await clearProducts();
  await addTestProduct('iPhone', 999);
  await addTestProduct('MacBook', 1999);
  await addTestProduct('iPad', 799);

  const products = await getAllProducts();
  await sendAICommand('установи цену 100 для iPhone, MacBook, iPad', products);

  const iphone = await getProductByName('iPhone');
  const macbook = await getProductByName('MacBook');
  const ipad = await getProductByName('iPad');

  if (!iphone || !macbook || !ipad) {
    formatResult('Test 2: Установка цены 100 для 3 товаров', false, 'Товары не найдены');
    return false;
  }

  const passed = 
    Number(iphone.price) === 100 &&
    Number(macbook.price) === 100 &&
    Number(ipad.price) === 100;

  formatResult(
    'Test 2: Установка цены 100 для 3 товаров',
    passed,
    passed ? null : `iPhone: $${iphone.price}, MacBook: $${macbook.price}, iPad: $${ipad.price}`,
    { iphone: iphone.price, macbook: macbook.price, ipad: ipad.price }
  );

  return passed;
}

// Test 3: Обновление остатка до 50 для 2 товаров
async function test3_update_stock_two_products() {
  await clearProducts();
  await addTestProduct('iPhone', 999, 10);
  await addTestProduct('Samsung', 899, 5);

  const products = await getAllProducts();
  await sendAICommand('обнови остаток до 50 для iPhone и Samsung', products);

  const iphone = await getProductByName('iPhone');
  const samsung = await getProductByName('Samsung');

  if (!iphone || !samsung) {
    formatResult('Test 3: Обновление остатка до 50', false, 'Товары не найдены');
    return false;
  }

  const passed = 
    Number(iphone.stock_quantity) === 50 &&
    Number(samsung.stock_quantity) === 50;

  formatResult(
    'Test 3: Обновление остатка до 50 для iPhone и Samsung',
    passed,
    passed ? null : `iPhone: ${iphone.stock_quantity} шт, Samsung: ${samsung.stock_quantity} шт`,
    { iphone: iphone.stock_quantity, samsung: samsung.stock_quantity }
  );

  return passed;
}

// Test 4: Переименование 2 товаров
async function test4_rename_two_products() {
  await clearProducts();
  await addTestProduct('iPhone', 999);
  await addTestProduct('MacBook', 1999);

  const products = await getAllProducts();
  await sendAICommand('переименуй iPhone в iPhone Pro и MacBook в MacBook Air', products);

  const iphonePro = await getProductByName('iPhone Pro');
  const macbookAir = await getProductByName('MacBook Air');

  const passed = iphonePro !== null && macbookAir !== null;

  formatResult(
    'Test 4: Переименование iPhone → iPhone Pro, MacBook → MacBook Air',
    passed,
    passed ? null : 'Товары не переименованы',
    { iphonePro: iphonePro?.name, macbookAir: macbookAir?.name }
  );

  return passed;
}

// Test 5: Разные скидки на 3 товара
async function test5_different_discounts_three_products() {
  await clearProducts();
  await addTestProduct('iPhone', 999);
  await addTestProduct('MacBook', 1999);
  await addTestProduct('iPad', 799);

  const products = await getAllProducts();
  await sendAICommand('скидка 10% на iPhone, 20% на MacBook, 30% на iPad', products);

  const iphone = await getProductByName('iPhone');
  const macbook = await getProductByName('MacBook');
  const ipad = await getProductByName('iPad');

  if (!iphone || !macbook || !ipad) {
    formatResult('Test 5: Разные скидки на 3 товара', false, 'Товары не найдены');
    return false;
  }

  const passed = 
    Number(iphone.discount_percentage) === 10 &&
    Number(macbook.discount_percentage) === 20 &&
    Number(ipad.discount_percentage) === 30;

  formatResult(
    'Test 5: Разные скидки (10%, 20%, 30%)',
    passed,
    passed ? null : `iPhone: ${iphone.discount_percentage}%, MacBook: ${macbook.discount_percentage}%, iPad: ${ipad.discount_percentage}%`,
    { 
      iphone: iphone.discount_percentage, 
      macbook: macbook.discount_percentage, 
      ipad: ipad.discount_percentage 
    }
  );

  return passed;
}

/**
 * Группа 2: Удаление группы товаров (2 теста)
 */

// Test 6: Удаление 2 товаров по именам
async function test6_delete_two_products() {
  await clearProducts();
  await addTestProduct('iPhone', 999);
  await addTestProduct('MacBook', 1999);
  await addTestProduct('iPad', 799);

  const products = await getAllProducts();
  await sendAICommand('удали iPhone и MacBook', products);

  const iphone = await getProductByName('iPhone');
  const macbook = await getProductByName('MacBook');
  const ipad = await getProductByName('iPad');

  const passed = !iphone && !macbook && ipad !== null;

  formatResult(
    'Test 6: Удаление iPhone и MacBook',
    passed,
    passed ? null : 'Удаление не выполнено корректно',
    { 
      iphoneDeleted: !iphone, 
      macbookDeleted: !macbook, 
      ipadRemains: ipad !== null 
    }
  );

  return passed;
}

// Test 7: Удаление всех кроме одного
async function test7_delete_all_except_one() {
  await clearProducts();
  await addTestProduct('iPhone', 999);
  await addTestProduct('MacBook', 1999);
  await addTestProduct('iPad', 799);

  const products = await getAllProducts();
  await sendAICommand('удали все кроме iPhone', products);

  const iphone = await getProductByName('iPhone');
  const allProducts = await getAllProducts();

  const passed = allProducts.length === 1 && iphone !== null;

  formatResult(
    'Test 7: Удаление всех кроме iPhone',
    passed,
    passed ? null : `Осталось товаров: ${allProducts.length}, iPhone найден: ${iphone !== null}`,
    { totalRemaining: allProducts.length, iphoneRemains: iphone !== null }
  );

  return passed;
}

/**
 * Группа 3: Добавление группы товаров (2 теста)
 */

// Test 8: Добавление 3 товаров одной командой
async function test8_add_three_products() {
  await clearProducts();

  const products = await getAllProducts();
  await sendAICommand('добавь iPhone за $999, MacBook за $1999, iPad за $799', products);

  const iphone = await getProductByName('iPhone');
  const macbook = await getProductByName('MacBook');
  const ipad = await getProductByName('iPad');

  const passed = 
    iphone !== null && Number(iphone.price) === 999 &&
    macbook !== null && Number(macbook.price) === 1999 &&
    ipad !== null && Number(ipad.price) === 799;

  formatResult(
    'Test 8: Добавление 3 товаров (iPhone, MacBook, iPad)',
    passed,
    passed ? null : 'Не все товары добавлены корректно',
    { 
      iphone: iphone ? `$${iphone.price}` : 'not found',
      macbook: macbook ? `$${macbook.price}` : 'not found',
      ipad: ipad ? `$${ipad.price}` : 'not found'
    }
  );

  return passed;
}

// Test 9: Добавление 5 одинаковых товаров
async function test9_add_five_identical_products() {
  await clearProducts();

  const products = await getAllProducts();
  await sendAICommand('добавь 5 наушников по $50 каждые', products);

  const allProducts = await getAllProducts();
  const headphones = allProducts.filter(p => 
    p.name.toLowerCase().includes('наушники') || 
    p.name.toLowerCase().includes('headphone')
  );

  // AI может создать либо 5 отдельных товаров, либо 1 товар с quantity=5
  const passed = headphones.length >= 1;

  formatResult(
    'Test 9: Добавление 5 наушников по $50',
    passed,
    passed ? null : `Найдено товаров: ${headphones.length}`,
    { 
      totalProducts: allProducts.length,
      headphonesCount: headphones.length,
      headphones: headphones.map(p => ({ name: p.name, price: p.price, stock: p.stock_quantity }))
    }
  );

  return passed;
}

/**
 * Группа 4: Смешанные операции (3 теста)
 */

// Test 10: Изменение нескольких полей одного товара
async function test10_update_multiple_fields() {
  await clearProducts();
  await addTestProduct('iPhone', 999, 10);

  const products = await getAllProducts();
  await sendAICommand('измени iPhone: цена $899, скидка 10%, остаток 100', products);

  const iphone = await getProductByName('iPhone');

  if (!iphone) {
    formatResult('Test 10: Изменение нескольких полей iPhone', false, 'iPhone не найден');
    return false;
  }

  // Проверяем либо цену $899, либо $899 с учетом 10% скидки
  const priceOk = Number(iphone.price) === 899 || Math.abs(Number(iphone.price) - 809.1) < 1;
  const discountOk = Number(iphone.discount_percentage) === 10;
  const stockOk = Number(iphone.stock_quantity) === 100;

  const passed = priceOk && discountOk && stockOk;

  formatResult(
    'Test 10: Изменение iPhone (цена, скидка, остаток)',
    passed,
    passed ? null : `Price: $${iphone.price}, Discount: ${iphone.discount_percentage}%, Stock: ${iphone.stock_quantity}`,
    { 
      price: iphone.price,
      discount: iphone.discount_percentage,
      stock: iphone.stock_quantity
    }
  );

  return passed;
}

// Test 11: Скидка 20% на все товары
async function test11_discount_all_products() {
  await clearProducts();
  await addTestProduct('iPhone', 1000);
  await addTestProduct('MacBook', 2000);
  await addTestProduct('iPad', 800);

  const products = await getAllProducts();
  await sendAICommand('скидка 20% на все товары', products);

  const allProducts = await getAllProducts();
  const allHaveDiscount = allProducts.every(p => Number(p.discount_percentage) === 20);

  formatResult(
    'Test 11: Скидка 20% на все товары',
    allHaveDiscount,
    allHaveDiscount ? null : 'Не все товары имеют скидку 20%',
    { 
      products: allProducts.map(p => ({ 
        name: p.name, 
        discount: p.discount_percentage,
        price: p.price
      }))
    }
  );

  return allHaveDiscount;
}

// Test 12: Убрать скидку с 2 товаров
async function test12_remove_discount_two_products() {
  await clearProducts();
  await addTestProduct('iPhone', 800, 10, 20); // Price 800 with 20% discount
  await addTestProduct('MacBook', 1600, 10, 20);
  await addTestProduct('iPad', 640, 10, 20);

  const products = await getAllProducts();
  await sendAICommand('убери скидку с iPhone и MacBook', products);

  const iphone = await getProductByName('iPhone');
  const macbook = await getProductByName('MacBook');
  const ipad = await getProductByName('iPad');

  if (!iphone || !macbook || !ipad) {
    formatResult('Test 12: Убрать скидку с iPhone и MacBook', false, 'Товары не найдены');
    return false;
  }

  const passed = 
    (Number(iphone.discount_percentage) === 0 || iphone.discount_percentage === null) &&
    (Number(macbook.discount_percentage) === 0 || macbook.discount_percentage === null) &&
    Number(ipad.discount_percentage) === 20;

  formatResult(
    'Test 12: Убрать скидку с iPhone и MacBook',
    passed,
    passed ? null : `iPhone: ${iphone.discount_percentage}%, MacBook: ${macbook.discount_percentage}%, iPad: ${ipad.discount_percentage}%`,
    { 
      iphone: iphone.discount_percentage,
      macbook: macbook.discount_percentage,
      ipad: ipad.discount_percentage
    }
  );

  return passed;
}

/**
 * Группа 5: Edge cases (3 теста)
 */

// Test 13: Скидка на несуществующий товар
async function test13_discount_nonexistent_product() {
  await clearProducts();
  await addTestProduct('iPhone', 999);

  const products = await getAllProducts();
  const result = await sendAICommand('скидка 20% на Samsung Galaxy', products);

  // AI должен либо вернуть ошибку, либо сообщить что товар не найден
  const passed = !result.success || 
                 (result.message && (
                   result.message.includes('не найден') || 
                   result.message.includes('not found') ||
                   result.message.includes('No')
                 ));

  formatResult(
    'Test 13: Скидка на несуществующий товар',
    passed,
    passed ? null : 'AI не сообщил об ошибке',
    { success: result.success, message: result.message }
  );

  return passed;
}

// Test 14: Обновление без указания что обновлять
async function test14_update_without_action() {
  await clearProducts();
  await addTestProduct('iPhone', 999);
  await addTestProduct('MacBook', 1999);

  const products = await getAllProducts();
  const result = await sendAICommand('обнови iPhone и MacBook', products);

  // AI должен либо попросить уточнить, либо вежливо отказаться
  const passed = !result.success || 
                 (result.message && (
                   result.message.includes('уточни') ||
                   result.message.includes('что') ||
                   result.message.includes('какие') ||
                   result.message.includes('specify')
                 ));

  formatResult(
    'Test 14: Обновление без указания что обновлять',
    passed,
    passed ? null : 'AI не попросил уточнить',
    { success: result.success, message: result.message }
  );

  return passed;
}

// Test 15: Добавление товара с пустым именем
async function test15_add_product_empty_name() {
  await clearProducts();

  const products = await getAllProducts();
  const result = await sendAICommand('добавь товар за $100 без названия', products);

  // AI должен отклонить запрос
  const allProducts = await getAllProducts();
  const passed = allProducts.length === 0 || !result.success;

  formatResult(
    'Test 15: Добавление товара с пустым именем',
    passed,
    passed ? null : 'AI добавил товар без имени',
    { success: result.success, productsCount: allProducts.length }
  );

  return passed;
}

// ============================================
// Test Runner
// ============================================

async function runTests() {
  console.log('🚀 Bulk Operations Tests\n');
  console.log('=' .repeat(60));
  console.log('');

  const results = {
    passed: 0,
    failed: 0,
    total: 15
  };

  const tests = [
    // Группа 1: Обновление группы товаров
    { name: 'Test 1', fn: test1_discount_two_products },
    { name: 'Test 2', fn: test2_set_price_three_products },
    { name: 'Test 3', fn: test3_update_stock_two_products },
    { name: 'Test 4', fn: test4_rename_two_products },
    { name: 'Test 5', fn: test5_different_discounts_three_products },

    // Группа 2: Удаление группы товаров
    { name: 'Test 6', fn: test6_delete_two_products },
    { name: 'Test 7', fn: test7_delete_all_except_one },

    // Группа 3: Добавление группы товаров
    { name: 'Test 8', fn: test8_add_three_products },
    { name: 'Test 9', fn: test9_add_five_identical_products },

    // Группа 4: Смешанные операции
    { name: 'Test 10', fn: test10_update_multiple_fields },
    { name: 'Test 11', fn: test11_discount_all_products },
    { name: 'Test 12', fn: test12_remove_discount_two_products },

    // Группа 5: Edge cases
    { name: 'Test 13', fn: test13_discount_nonexistent_product },
    { name: 'Test 14', fn: test14_update_without_action },
    { name: 'Test 15', fn: test15_add_product_empty_name }
  ];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error(`❌ FAIL: ${test.name}`);
      console.error(`   Exception: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      console.log('');
      results.failed++;
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Final summary
  console.log('=' .repeat(60));
  console.log('\n📊 Результаты:');
  console.log(`   ✅ Passed: ${results.passed}/${results.total}`);
  console.log(`   ❌ Failed: ${results.failed}/${results.total}`);
  console.log(`   📈 Success rate: ${Math.round(results.passed / results.total * 100)}%`);
  console.log('');

  if (results.passed === results.total) {
    console.log('🎉 Все тесты прошли успешно!\n');
    return 0;
  } else {
    console.log('⚠️  Некоторые тесты провалились\n');
    return 1;
  }
}

// ============================================
// Main
// ============================================

(async () => {
  let exitCode = 0;

  try {
    await setup();
    exitCode = await runTests();
    await cleanup();
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    exitCode = 1;
  } finally {
    if (pool) {
      await pool.end();
    }
    process.exit(exitCode);
  }
})();
