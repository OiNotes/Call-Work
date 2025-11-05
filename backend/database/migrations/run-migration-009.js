/**
 * Migration Runner for 009_add_channel_url
 * 
 * Usage:
 *   node backend/database/migrations/run-migration-009.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database configuration
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'telegram_shop',
  password: process.env.PGPASSWORD || 'postgres',
  port: process.env.PGPORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting migration 009: Add channel_url to shops...\n');

    // Read migration file
    const migrationPath = join(__dirname, '009_add_channel_url.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify changes
    console.log('🔍 Verifying migration...\n');

    // Check column exists
    const columnCheck = await client.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'shops' AND column_name = 'channel_url'
    `);

    if (columnCheck.rows.length > 0) {
      const col = columnCheck.rows[0];
      console.log('✅ Column "channel_url" added:');
      console.log(`   Type: ${col.data_type}(${col.character_maximum_length})`);
      console.log(`   Nullable: ${col.is_nullable}`);
    } else {
      throw new Error('❌ Column "channel_url" not found after migration!');
    }

    // Check index exists
    const indexCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'shops' AND indexname = 'idx_shops_channel_url'
    `);

    if (indexCheck.rows.length > 0) {
      console.log('✅ Index "idx_shops_channel_url" created');
    } else {
      console.log('⚠️  Warning: Index "idx_shops_channel_url" not found');
    }

    // Check comment exists
    const commentCheck = await client.query(`
      SELECT 
        col_description('shops'::regclass, ordinal_position) as column_comment
      FROM information_schema.columns
      WHERE table_name = 'shops' AND column_name = 'channel_url'
    `);

    if (commentCheck.rows.length > 0 && commentCheck.rows[0].column_comment) {
      console.log('✅ Column comment added');
      console.log(`   "${commentCheck.rows[0].column_comment}"`);
    }

    console.log('\n✨ Migration 009 completed successfully!\n');

    // Show sample data
    const sampleData = await client.query(`
      SELECT id, name, channel_url, tier
      FROM shops
      LIMIT 3
    `);

    if (sampleData.rows.length > 0) {
      console.log('📊 Sample data:');
      console.table(sampleData.rows);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
