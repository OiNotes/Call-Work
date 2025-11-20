#!/usr/bin/env node

/**
 * Migration Runner: 022_add_promo_codes_table
 *
 * Adds promo_codes table for database-driven promo code system
 * Replaces hardcoded 'comi9999' promo code
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'telegram_shop',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting migration 022: add_promo_codes_table');
    console.log('📁 Reading migration file...');

    const migrationSQL = readFileSync(join(__dirname, '022_add_promo_codes_table.sql'), 'utf-8');

    console.log('🔄 Executing migration...\n');

    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Verifying migration...\n');

    // Verify promo_codes table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'promo_codes'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✓ Table "promo_codes" created');

      // Check for migrated promo code
      const promoCheck = await client.query(
        `SELECT code, discount_percentage, tier, is_active, used_count
         FROM promo_codes
         WHERE code = 'comi9999'`
      );

      if (promoCheck.rows.length > 0) {
        const promo = promoCheck.rows[0];
        console.log('✓ Legacy promo code "comi9999" migrated:');
        console.log(`  - Discount: ${promo.discount_percentage}%`);
        console.log(`  - Tier: ${promo.tier}`);
        console.log(`  - Active: ${promo.is_active}`);
        console.log(`  - Used: ${promo.used_count} times`);
      } else {
        console.log(
          '⚠️  Warning: Legacy promo code not migrated (promo_activations table may not exist)'
        );
      }

      // Check indexes
      const indexCheck = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'promo_codes'
      `);

      console.log(`✓ Indexes created: ${indexCheck.rows.length}`);
      indexCheck.rows.forEach((row) => {
        console.log(`  - ${row.indexname}`);
      });
    } else {
      console.log('❌ Table "promo_codes" not found');
    }

    console.log('\n✅ Migration verification complete!');
    console.log('\n📝 Next steps:');
    console.log('1. shopController.js now uses database promo codes');
    console.log('2. Old hardcoded PROMO_CODE constant removed');
    console.log('3. Add more promo codes via SQL or API');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
