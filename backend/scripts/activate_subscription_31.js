/**
 * Manually activate subscription 31
 */

import { getClient } from '../src/config/database.js';

async function activateSubscription31() {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Update subscription to active
        await client.query(`
      UPDATE shop_subscriptions 
      SET 
        status = 'active',
        tx_hash = '9be4ace754d7b1038d85b47bf9b010948323e6d4099660b8be4317ca1bbc8fe9',
        currency = 'LTC',
        amount = 0.01063886,
        verified_at = NOW(),
        period_start = NOW(),
        period_end = NOW() + INTERVAL '1 month'
      WHERE id = 31
    `);

        // Update invoice to paid
        await client.query(`
      UPDATE invoices 
      SET 
        status = 'paid',
        paid_at = NOW(),
        tx_hash = '9be4ace754d7b1038d85b47bf9b010948323e6d4099660b8be4317ca1bbc8fe9'
      WHERE subscription_id = 31
    `);

        await client.query('COMMIT');

        console.log('✅ Subscription 31 activated!');

        // Show final state
        const result = await client.query(`
      SELECT s.*, u.telegram_id, u.username 
      FROM shop_subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = 31
    `);

        console.log('\nFinal state:', JSON.stringify(result.rows[0], null, 2));

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

activateSubscription31()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
