import pg from 'pg';
import { config } from './env.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

/**
 * PostgreSQL connection pool
 * Optimized for high-concurrency workloads
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 35, // Increased from 20 to handle more concurrent requests
  idleTimeoutMillis: 20000, // Reduced from 30s to 20s (prevent stale connections)
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
  statement_timeout: 30000, // 30 second timeout for long-running queries (prevent deadlocks)
});

// Clear cached prepared statements on connect (fixes schema changes after migrations)
pool.on('connect', async (client) => {
  try {
    await client.query('DEALLOCATE ALL');
  } catch (err) {
    // Ignore errors (DEALLOCATE ALL fails if no statements exist)
  }
});

/**
 * P1-DB-004: Connection Pool Metrics
 * Log pool statistics every 60 seconds for monitoring
 */
const logPoolMetrics = () => {
  const totalCount = pool.totalCount;
  const idleCount = pool.idleCount;
  const waitingCount = pool.waitingCount;
  const activeCount = totalCount - idleCount;

  logger.info('Database Pool Metrics', {
    total: totalCount,
    active: activeCount,
    idle: idleCount,
    waiting: waitingCount,
    utilization: totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(1) + '%' : '0%',
  });

  // Warning if pool is heavily utilized
  if (totalCount > 0 && activeCount / totalCount > 0.8) {
    logger.warn('Database pool utilization high', {
      activeCount,
      totalCount,
      utilization: ((activeCount / totalCount) * 100).toFixed(1) + '%',
    });
  }

  // Warning if requests are waiting
  if (waitingCount > 0) {
    logger.warn('Database pool has waiting requests', {
      waiting: waitingCount,
      suggestion: 'Consider increasing pool.max or optimizing queries',
    });
  }
};

// Log pool metrics every 60 seconds
const poolMetricsInterval = setInterval(logPoolMetrics, 60000);

// Clear interval on pool close
pool.on('remove', () => {
  clearInterval(poolMetricsInterval);
});

/**
 * Test database connection
 */
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('Database connected successfully');
    client.release();
    return true;
  } catch (error) {
    logger.error('Database connection error:', { error: error.message, stack: error.stack });
    throw error;
  }
};

/**
 * Execute a query
 * P1-DB-008: Slow Query Logging (queries > 1000ms)
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // P1-DB-008: Log slow queries (> 1000ms) in ALL environments
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        duration: `${duration}ms`,
        query: text.substring(0, 200) + (text.length > 200 ? '...' : ''), // Truncate long queries
        rows: res.rowCount,
        params: params ? (params.length > 5 ? `[${params.length} params]` : params) : undefined,
      });
    }

    if (config.nodeEnv === 'development') {
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
    }

    return res;
  } catch (error) {
    logger.error('Query error:', { error: error.message, stack: error.stack });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 */
export const getClient = async () => {
  const client = await pool.connect();
  const release = client.release.bind(client);

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    logger.warn('A client has been checked out for more than 5 seconds!');
  }, 5000);

  // Monkey patch the release method to clear our timeout
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release();
  };

  return client;
};

/**
 * Graceful shutdown
 */
export const closePool = async () => {
  await pool.end();
  logger.info('Database pool closed');
};

export default {
  pool,
  query,
  getClient,
  testConnection,
  closePool,
};
