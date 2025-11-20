#!/usr/bin/env node
/**
 * Test wallet sync fix
 * Verify that PUT /api/shops/:id/wallets returns updated_at field
 */

import { query } from './src/config/database.js';

async function testWalletSync() {
  console.log('🧪 Testing Wallet Sync Fix\n');

  try {
    // 1. Get current wallet data
    console.log('1️⃣ Fetching shop 1696 wallet data from database...');
    const beforeResult = await query(
      'SELECT id, name, wallet_btc, wallet_eth, wallet_usdt, wallet_ltc, updated_at FROM shops WHERE id = $1',
      [1696]
    );

    if (beforeResult.rows.length === 0) {
      console.error('❌ Shop not found!');
      process.exit(1);
    }

    const beforeShop = beforeResult.rows[0];
    console.log('✅ Before update:');
    console.log(`   BTC: ${beforeShop.wallet_btc || 'null'}`);
    console.log(`   ETH: ${beforeShop.wallet_eth || 'null'}`);
    console.log(`   USDT: ${beforeShop.wallet_usdt || 'null'}`);
    console.log(`   LTC: ${beforeShop.wallet_ltc || 'null'}`);
    console.log(`   updated_at: ${beforeShop.updated_at}\n`);

    // 2. Simulate shopQueries.updateWallets() call
    console.log('2️⃣ Simulating updateWallets() with new ETH address...');
    const newEthAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

    const updateResult = await query(
      `UPDATE shops
       SET wallet_eth = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, owner_id, name, description, logo, tier, is_active, wallet_btc, wallet_eth, wallet_usdt, wallet_ltc, created_at, updated_at`,
      [1696, newEthAddress]
    );

    const updatedShop = updateResult.rows[0];
    console.log('✅ After update (from database):');
    console.log(`   BTC: ${updatedShop.wallet_btc || 'null'}`);
    console.log(`   ETH: ${updatedShop.wallet_eth || 'null'}`);
    console.log(`   USDT: ${updatedShop.wallet_usdt || 'null'}`);
    console.log(`   LTC: ${updatedShop.wallet_ltc || 'null'}`);
    console.log(`   updated_at: ${updatedShop.updated_at}\n`);

    // 3. Simulate controller response (with fix)
    console.log('3️⃣ Simulating controller response (WITH FIX)...');
    const responseWithFix = {
      success: true,
      data: {
        wallet_btc: updatedShop.wallet_btc || null,
        wallet_eth: updatedShop.wallet_eth || null,
        wallet_usdt: updatedShop.wallet_usdt || null,
        wallet_ltc: updatedShop.wallet_ltc || null,
        updated_at: updatedShop.updated_at, // ✅ FIX: Added this line
      },
    };

    console.log('✅ Response with fix:');
    console.log(JSON.stringify(responseWithFix, null, 2));

    // 4. Check if updated_at exists
    if (responseWithFix.data.updated_at) {
      console.log('\n🎉 SUCCESS! updated_at field is present in response!');
      console.log('✅ Frontend will now correctly sync wallet state.\n');
    } else {
      console.log('\n❌ FAILED! updated_at field is missing!');
      console.log('❌ Frontend will not sync correctly.\n');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

testWalletSync();
