/**
 * Quick test for bulkAddProducts fix
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generateProductAIPrompt } from '../../src/utils/systemPrompts.js';
import { productTools } from '../../src/tools/productTools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const mockProducts = [
  { id: 1, name: 'iPhone 15 Pro', price: 999, currency: 'USD', stock_quantity: 10 }
];

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

async function testBulkAdd(userMessage) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📝 USER: "${userMessage}"`);
  console.log(`${'='.repeat(70)}`);

  const systemPrompt = generateProductAIPrompt('Test Shop', mockProducts);

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    tools: productTools,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 500
  });

  const message = response.choices[0].message;

  if (message.tool_calls && message.tool_calls.length > 0) {
    console.log('✅ RESULT: Function Call');
    message.tool_calls.forEach(call => {
      console.log(`   Function: ${call.function.name}`);
      const parsed = JSON.parse(call.function.arguments);
      console.log(`   Arguments:\n${JSON.stringify(parsed, null, 2).split('\n').map(l => '      ' + l).join('\n')}`);
    });
    return 'PASS';
  } else {
    console.log('❌ RESULT: Text Response (Expected Function Call)');
    console.log(`   "${message.content}"`);
    return 'FAIL';
  }
}

async function run() {
  console.log('\n🚀 Testing bulkAddProducts Fix\n');

  const result = await testBulkAdd('добавь: Чехол 20 5шт, Наушники 150 10шт, Зарядка 30');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 RESULT: ${result}`);
  console.log(`${'='.repeat(70)}\n`);

  if (result === 'PASS') {
    console.log('✅ bulkAddProducts теперь работает правильно!\n');
  } else {
    console.log('❌ bulkAddProducts всё ещё возвращает текст вместо function call\n');
  }
}

run();
