#!/usr/bin/env node

/**
 * Database Migration Script
 * Applies schema.sql to PostgreSQL database
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in .env file');
  process.exit(1);
}

console.log('🔄 Starting database migration...');
console.log(`📦 Database: ${DATABASE_URL.replace(/\/\/.*@/, '//<credentials>@')}`);

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('✅ Connected to PostgreSQL');

    // Read schema.sql
    const schemaPath = join(__dirname, 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');

    console.log('📄 Executing schema.sql...');

    // Execute schema
    await client.query(schemaSql);

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Verifying tables...');

    // Verify tables
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n✅ Tables created:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n✅ Database setup complete!\n');

  } catch (error) {
    console.error('❌ Migration failed:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
