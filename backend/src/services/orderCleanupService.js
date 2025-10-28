import { query } from '../config/database.js';
import { productQueries } from '../models/db.js';
import logger from '../utils/logger.js';

/**
 * Auto-cancel unpaid orders after 20 minutes and free reserved stock
 */
async function cancelUnpaidOrders() {
  try {
    // Find orders pending for > 20 minutes
    const result = await query(
      `SELECT o.id, o.product_id, o.quantity, p.name as product_name
       FROM orders o
       JOIN products p ON o.product_id = p.id
       WHERE o.status = 'pending'
       AND o.created_at < NOW() - INTERVAL '20 minutes'`
    );

    const orders = result.rows;

    if (orders.length === 0) {
      logger.info('No unpaid orders to cancel');
      return;
    }

    logger.info(`Found ${orders.length} unpaid orders to cancel`);

    // Cancel each order and unreserve stock
    for (const order of orders) {
      try {
        // Unreserve stock
        await productQueries.unreserveStock(order.product_id, order.quantity);

        // Cancel order
        await query(
          `UPDATE orders
           SET status = 'cancelled',
               updated_at = NOW()
           WHERE id = $1`,
          [order.id]
        );

        logger.info(`Auto-cancelled order #${order.id} (${order.product_name})`);
      } catch (err) {
        logger.error(`Failed to cancel order #${order.id}:`, err);
      }
    }

    logger.info(`Successfully cancelled ${orders.length} unpaid orders`);

  } catch (error) {
    logger.error('Error in cancelUnpaidOrders:', error);
  }
}

// Run every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function startOrderCleanup() {
  logger.info('Starting order cleanup service (runs every 5 minutes)');

  // Run immediately on startup
  cancelUnpaidOrders();

  // Then run every 5 minutes
  setInterval(cancelUnpaidOrders, CLEANUP_INTERVAL);
}

export default { startOrderCleanup };
