#!/usr/bin/env node
/**
 * Manual confirmation helper for crypto invoices.
 *
 * Usage:
 *   node scripts/manual_confirm_invoice.js --invoice-id 32 --tx <txHash> [--chain LTC]
 *
 * - Verifies the transaction on-chain (BTC/LTC via BlockCypher, ETH via Etherscan, USDT_TRC20 via TronGrid)
 * - Persists payment record
 * - Marks invoice as paid with tx_hash
 * - Activates subscription or confirms order (basic path) to avoid money loss when automation fails
 */

import 'dotenv/config';
import { getClient } from '../src/config/database.js';
import { invoiceQueries, paymentQueries } from '../src/database/queries/index.js';
import * as blockCypherService from '../src/services/blockCypherService.js';
import cryptoService from '../src/services/crypto.js';
import * as tronService from '../src/services/tronService.js';
import { SUPPORTED_CURRENCIES } from '../src/utils/constants.js';

function usage(msg) {
  if (msg) {
    console.error(msg);
  }
  console.error(
    'Usage: node scripts/manual_confirm_invoice.js --invoice-id <id> --tx <txHash> [--chain BTC|LTC|ETH|USDT_TRC20]\n'
  );
  process.exit(1);
}

async function verifyOnChain(invoice, txHash, chain) {
  const expectedAmount = parseFloat(invoice.crypto_amount || invoice.expected_amount);

  switch (chain) {
    case 'BTC':
    case 'LTC':
      return blockCypherService.verifyPayment(chain, txHash, invoice.address, expectedAmount);
    case 'ETH':
      return cryptoService.verifyEthereumTransaction(txHash, invoice.address, expectedAmount);
    case 'USDT_TRC20':
      return tronService.verifyPayment(txHash, invoice.address, expectedAmount);
    default:
      throw new Error(`Unsupported chain for manual verification: ${chain}`);
  }
}

async function activateSubscription(client, invoice, txHash) {
  const subResult = await client.query(
    `SELECT id, shop_id, tier, user_id, status
       FROM shop_subscriptions
      WHERE id = $1
      FOR UPDATE`,
    [invoice.subscription_id]
  );

  if (subResult.rows.length === 0) {
    throw new Error(`Subscription ${invoice.subscription_id} not found`);
  }

  const subscription = subResult.rows[0];

  if (subscription.status === 'active') {
    return 'already-active';
  }

  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (subscription.shop_id) {
    await client.query(
      `UPDATE shops
         SET tier = $1,
             subscription_status = 'active',
             next_payment_due = $2,
             grace_period_until = NULL,
             registration_paid = true,
             is_active = true,
             updated_at = NOW()
       WHERE id = $3`,
      [subscription.tier, periodEnd, subscription.shop_id]
    );
  }

  await client.query(
    `UPDATE shop_subscriptions
        SET status = 'active',
            verified_at = NOW(),
            period_start = $1,
            period_end = $2,
            tx_hash = $3,
            currency = $4,
            amount = COALESCE($5, amount)
      WHERE id = $6`,
    [
      periodStart,
      periodEnd,
      txHash,
      invoice.currency,
      invoice.expected_amount,
      invoice.subscription_id,
    ]
  );

  return 'activated';
}

async function confirmOrder(client, invoice, txHash) {
  if (!invoice.order_id) return 'skipped';

  await client.query(
    `UPDATE orders
        SET status = 'confirmed',
            payment_hash = $1,
            paid_at = NOW(),
            updated_at = NOW()
      WHERE id = $2`,
    [txHash, invoice.order_id]
  );

  return 'confirmed';
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.replace(/^--/, '');
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    args[name] = value;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const invoiceId = parseInt(args['invoice-id'] || args.i, 10);
  const txHash = args.tx || args.hash;
  const chainArg = args.chain;

  if (!invoiceId || !txHash) {
    usage('Missing required parameters');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const invoiceResult = await client.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    if (invoiceResult.rows.length === 0) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const invoice = invoiceResult.rows[0];
    const chain = (chainArg || invoice.chain || '').toUpperCase();

    if (!chain) {
      throw new Error('Chain is required (pass --chain or ensure invoice.chain is set)');
    }

    // Verify payment on chain
    console.log(`🔍 Verifying ${chain} tx ${txHash} for invoice ${invoiceId}...`);
    const verification = await verifyOnChain(invoice, txHash, chain);

    if (!verification?.verified) {
      throw new Error(`Verification failed: ${verification?.error || 'unknown error'}`);
    }

    const minConf = SUPPORTED_CURRENCIES[chain]?.confirmations || verification.confirmations || 0;
    const status =
      verification.status ||
      (verification.confirmations >= minConf ? 'confirmed' : 'pending');

    // Record payment
    await paymentQueries.create(
      {
        orderId: invoice.order_id || null,
        subscriptionId: invoice.subscription_id || null,
        txHash,
        amount: verification.amount,
        currency: invoice.currency,
        status,
      },
      client
    );

    // Mark invoice as paid + store tx hash
    await client.query(
      `UPDATE invoices
          SET status = $1,
              paid_at = NOW(),
              tx_hash = $2,
              updated_at = NOW()
        WHERE id = $3`,
      ['paid', txHash, invoiceId]
    );

    let postAction = 'none';
    if (invoice.subscription_id) {
      postAction = await activateSubscription(client, invoice, txHash);
    } else if (invoice.order_id) {
      postAction = await confirmOrder(client, invoice, txHash);
    }

    await client.query('COMMIT');

    console.log('✅ Manual confirmation completed:');
    console.log(`   Invoice: ${invoiceId} -> paid (tx: ${txHash})`);
    console.log(`   Payment status: ${status}, confirmations: ${verification.confirmations}`);
    console.log(`   Post action: ${postAction}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Manual confirmation failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
