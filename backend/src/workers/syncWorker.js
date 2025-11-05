/**
 * Product Sync Worker
 * 
 * Background worker that processes product sync jobs from Bull queue.
 * This worker runs separately from the main API server to avoid blocking HTTP requests.
 * 
 * Usage:
 *   node src/workers/syncWorker.js
 * 
 * Or in production with PM2:
 *   pm2 start src/workers/syncWorker.js --name sync-worker
 */

import '../jobs/syncQueue.js'; // Initialize queue and start processing
import logger from '../utils/logger.js';

logger.info('======================================');
logger.info('Product Sync Worker Started');
logger.info('======================================');
logger.info('Worker is now listening for sync jobs from the queue');
logger.info('Press Ctrl+C to stop');

// Keep process alive
process.stdin.resume();

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down sync worker...');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
