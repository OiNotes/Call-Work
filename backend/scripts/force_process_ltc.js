/**
 * Force process specific LTC invoice
 */

import { getClient } from '../src/config/database.js';
import * as blockCypherService from '../src/services/blockCypherService.js';
import { paymentQueries, invoiceQueries } from '../src/database/queries/index.js';

async function processInvoice31() {
    const invoiceId = 31;
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Get invoice
        const invResult = await client.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
        const invoice = invResult.rows[0];

        if (!invoice) {
            throw new Error(`Invoice ${invoiceId} not found`);
        }

        console.log('Processing invoice:', invoice);

        // Verify payment with new 1% tolerance
        const verification = await blockCypherService.verifyPayment(
            'LTC',
            '9be4ace754d7b1038d85b47bf9b010948323e6d4099660b8be4317ca1bbc8fe9',
            invoice.address,
            parseFloat(invoice.crypto_amount)
        );

        console.log('Verification result:', verification);

        if (!verification.verified) {
            throw new Error('Payment still not verified with new tolerance');
        }

        // Create payment record
        const payment = await client.query(
            `INSERT INTO payments (subscription_id, tx_hash, amount, currency, status, confirmations)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [
                invoice.subscription_id,
                '9be4ace754d7b1038d85b47bf9b010948323e6d4099660b8be4317ca1bbc8fe9',
                verification.amount,
                'LTC',
                'confirmed',
                verification.confirmations
            ]
        );

        console.log('Payment created:', payment.rows[0]);

        // Update invoice status
        await client.query(
            `UPDATE invoices SET status = 'paid', paid_at = NOW(), tx_hash = $1 WHERE id = $2`,
            ['9be4ace754d7b1038d85b47bf9b010948323e6d4099660b8be4317ca1bbc8fe9', invoiceId]
        );

        // Update subscription status
        await client.query(
            `UPDATE shop_subscriptions 
       SET status = 'active', 
           tx_hash = $1,
           amount = $2,
           currency = 'LTC',
           period_start = NOW(),
           period_end = NOW() + INTERVAL '1 month'
       WHERE id = $3`,
            [
                '9be4ace754d7b1038d85b47bf9b010948323e6d4099660b8be4317ca1bbc8fe9',
                verification.amount,
                invoice.subscription_id
            ]
        );

        await client.query('COMMIT');

        console.log('\\n✅ Payment processed successfully!');
        console.log('Subscription activated for 1 month');

        // Verify final state
        const finalSub = await client.query(
            'SELECT * FROM shop_subscriptions WHERE id = $1',
            [invoice.subscription_id]
        );

        console.log('\\nFinal subscription state:', finalSub.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
        throw error;
    } finally {
        client.release();
    }
}

processInvoice31()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
