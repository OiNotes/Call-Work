/**
 * Quick Discount Functions Test
 * Tests only 3 discount commands
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
  { id: 1, name: 'iPhone 15 Pro', price: 999, currency: 'USD', stock_quantity: 10 },
  { id: 2, name: 'MacBook Pro', price: 2499, currency: 'USD', stock_quantity: 5 },
  { id: 3, name: 'AirPods Pro', price: 249, currency: 'USD', stock_quantity: 20 },
];

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

async function testCommand(userMessage) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 USER: "${userMessage}"`);
  console.log(`${'='.repeat(60)}`);

  const systemPrompt = generateProductAIPrompt('Test Shop', mockProducts);

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      tools: productTools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500,
    });

    const message = response.choices[0].message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log('✅ AI RESPONSE: Function Call');
      message.tool_calls.forEach((call) => {
        console.log(`   Function: ${call.function.name}`);
        console.log(`   Arguments: ${call.function.arguments}`);
        try {
          console.log(`   Parsed: ${JSON.stringify(JSON.parse(call.function.arguments), null, 2)}`);
        } catch (e) {
          console.log(`   Parse error: ${e.message}`);
        }
      });
    } else if (message.content) {
      console.log('❌ AI RESPONSE: Text (should be Function Call!)');
      console.log(`   "${message.content}"`);
    }

    console.log(`\n📊 Tokens: ${response.usage.total_tokens}`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('\n🚀 Testing Discount Functions\n');

  const tests = ['сделай скидку 30% на iPhone', 'убери скидку с MacBook', 'подними цены на 10%'];

  for (const test of tests) {
    await testCommand(test);
  }

  console.log('\n✅ Tests completed\n');
}

runTests();
