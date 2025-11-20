/**
 * Manual LTC Payment Verification Script
 * 
 * Run this to manually check and process LTC payments
 */

import logger from '../src/utils/logger.js';
import { getClient } from '../src/config/database.js';
import * as blockCypherService from '../src/services/blockCypherService.js';
import { manualPoll } from '../src/services/pollingService.js';

async function checkLTCPayment() {
    console.log('\n🔍 Checking LTC Payments...\n');

    const client = await getClient();

    try {
        // 1. Get recent LTC pending invoices
        const result = await client.query(`
      SELECT 
        i.id,
        i.subscription_id,
        i.address,
        i.crypto_amount,
        i.status,
        i.expires_at,
        i.created_at,
        NOW() as current_time,
        EXTRACT(EPOCH FROM (NOW() - i.expires_at)) as seconds_since_expiry,
        s.tier,
        s.user_id
      FROM invoices i
      LEFT JOIN shop_subscriptions s ON i.subscription_id = s.id
      WHERE i.chain = 'LTC'
      AND i.status = 'pending'
      AND i.expires_at > NOW() - INTERVAL '24 hours'
      ORDER BY i.created_at DESC
      LIMIT 10
    `);

        if (result.rows.length === 0) {
            console.log('❌ No pending LTC invoices found in last 24 hours');
            console.log('\nLooking for ALL LTC invoices...\n');

            const allResult = await client.query(`
        SELECT 
          i.id,
          i.subscription_id,
          i.address,
          i.crypto_amount,
          i.status,
          i.expires_at,
          i.created_at
        FROM invoices i
        WHERE i.chain = 'LTC'
        ORDER BY i.created_at DESC
        LIMIT 5
      `);

            console.log(`Found ${allResult.rows.length} LTC invoices (any status):`);
            allResult.rows.forEach(inv => {
                console.log(`  - Invoice ${inv.id}: ${inv.status}, ${inv.address}, ${inv.crypto_amount} LTC`);
            });

            return;
        }

        console.log(`Found ${result.rows.length} pending LTC invoice(s):\n`);

        // 2. Check each invoice on blockchain
        for (const invoice of result.rows) {
            console.log(`📋 Invoice #${invoice.id}`);
            console.log(`   Address: ${invoice.address}`);
            console.log(`   Expected: ${invoice.crypto_amount} LTC`);
            console.log(`   Status: ${invoice.status}`);
            console.log(`   Expires: ${invoice.expires_at}`);
            console.log(`   Seconds ${invoice.seconds_since_expiry < 0 ? 'until' : 'since'} expiry: ${Math.abs(invoice.seconds_since_expiry).toFixed(0)}`);
            console.log(`   Tier: ${invoice.tier}`);

            // Check blockchain for this address
            try {
                console.log(`\n   🔎 Checking BlockCypher for address ${invoice.address}...`);

                const addressInfo = await blockCypherService.getAddressInfo('LTC', invoice.address);

                console.log(`   Balance: ${addressInfo.final_balance / 100000000} LTC`);
                console.log(`   Total received: ${addressInfo.total_received / 100000000} LTC`);
                console.log(`   Confirmed txs: ${addressInfo.n_tx || 0}`);
                console.log(`   Unconfirmed txs: ${addressInfo.unconfirmed_n_tx || 0}`);

                if (addressInfo.total_received > 0) {
                    console.log(`\n   ✅ PAYMENT DETECTED! ${addressInfo.total_received / 100000000} LTC received`);

                    // Show transactions
                    const allTxs = [
                        ...(addressInfo.txrefs || []),
                        ...(addressInfo.unconfirmed_txrefs || [])
                    ];

                    console.log(`\n   📝 Transactions:`);
                    allTxs.forEach((tx, idx) => {
                        console.log(`      ${idx + 1}. ${tx.tx_hash}`);
                        console.log(`         Amount: ${tx.value / 100000000} LTC`);
                        console.log(`         Confirmations: ${tx.confirmations || 0}`);
                        console.log(`         Time: ${tx.confirmed || tx.received}`);
                    });

                    // Try to verify and process
                    console.log(`\n   🔄 Attempting to verify payment...`);

                    if (allTxs.length > 0) {
                        const verification = await blockCypherService.verifyPayment(
                            'LTC',
                            allTxs[0].tx_hash,
                            invoice.address,
                            parseFloat(invoice.crypto_amount)
                        );

                        console.log(`   Verification result:`, verification);

                        if (verification.verified) {
                            console.log(`   ✅ Payment VERIFIED! Processing...`);

                            // Now trigger polling to actually process it
                            console.log(`\n   🔄 Triggering polling service...`);
                            await manualPoll();

                            // Check if it was processed
                            const updatedInv = await client.query(
                                'SELECT status FROM invoices WHERE id = $1',
                                [invoice.id]
                            );

                            console.log(`   Final status: ${updatedInv.rows[0].status}`);
                        }
                    }
                } else {
                    console.log(`   ⚠️  No payment received yet`);
                }

            } catch (error) {
                console.error(`   ❌ Error checking blockchain:`, error.message);
            }

            console.log('\n' + '─'.repeat(60) + '\n');
        }

    } finally {
        client.release();
    }
}

checkLTCPayment()
    .then(() => {
        console.log('✅ Check complete');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });
