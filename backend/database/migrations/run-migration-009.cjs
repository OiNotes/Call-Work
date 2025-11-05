/**
 * Run Migration 009: Add Critical Performance Indexes (P1-PERF-006)
 * Usage: node backend/database/migrations/run-migration-009.cjs
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'telegram_shop',
  user: process.env.DB_USER || 'sile',
  password: process.env.DB_PASSWORD || '',
};

const pool = new Pool(config);

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}\n`),
};

/**
 * Run Migration 009
 */
async function runMigration009() {
  log.header('Running Migration 009: Add Critical Performance Indexes (P1-PERF-006)');

  const client = await pool.connect();

  try {
    // Read migration SQL file
    const sqlPath = path.join(__dirname, '009_add_critical_performance_indexes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    log.info('Executing migration SQL...');
    await client.query(sql);

    // Verify indexes were created
    log.info('Verifying indexes...');
    const result = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE indexname IN (
        'idx_orders_status_created',
        'idx_shop_follows_created_at',
        'idx_synced_products_last_synced',
        'idx_products_updated_at'
      )
      ORDER BY tablename, indexname
    `);

    if (result.rows.length > 0) {
      log.success(`Created ${result.rows.length} indexes:`);
      result.rows.forEach((row) => {
        log.info(`  ✓ ${row.indexname} on ${row.tablename}`);
      });
    } else {
      log.warning('No new indexes were created (may already exist)');
    }

    log.success('Migration 009 completed successfully!');
  } catch (error) {
    log.error(`Migration 009 failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration009()
  .then(() => {
    log.success('All done!');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
