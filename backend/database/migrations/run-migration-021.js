import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
const envPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: envPath });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'telegram_ecommerce',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting migration 021: Add unique wallet constraints...\n');
    
    // Check for existing duplicate wallet addresses BEFORE migration
    console.log('📊 Checking for existing duplicate wallet addresses...\n');
    
    const duplicateChecks = [
      { column: 'wallet_btc', name: 'Bitcoin' },
      { column: 'wallet_eth', name: 'Ethereum' },
      { column: 'wallet_usdt', name: 'USDT' },
      { column: 'wallet_ltc', name: 'Litecoin' }
    ];
    
    let hasDuplicates = false;
    
    for (const check of duplicateChecks) {
      const result = await client.query(`
        SELECT ${check.column}, COUNT(*) as count, 
               array_agg(id) as shop_ids, 
               array_agg(name) as shop_names
        FROM shops
        WHERE ${check.column} IS NOT NULL
        GROUP BY ${check.column}
        HAVING COUNT(*) > 1
      `);
      
      if (result.rows.length > 0) {
        hasDuplicates = true;
        console.log(`❌ Found duplicate ${check.name} addresses:`);
        result.rows.forEach(row => {
          console.log(`   Address: ${row[check.column]}`);
          console.log(`   Used by ${row.count} shops: ${row.shop_names.join(', ')}\n`);
        });
      } else {
        console.log(`✅ No duplicate ${check.name} addresses`);
      }
    }
    
    if (hasDuplicates) {
      console.log('\n⚠️  WARNING: Duplicate wallet addresses found!');
      console.log('Migration will fail until duplicates are resolved.\n');
      console.log('Fix duplicates manually, then run this migration again.');
      process.exit(1);
    }
    
    console.log('\n✅ No duplicates found. Safe to proceed.\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '021_add_unique_wallet_constraints.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log('🔄 Executing migration...\n');
    await client.query(migrationSQL);
    
    // Verify indexes were created
    console.log('🔍 Verifying indexes...\n');
    const indexCheck = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'shops' 
      AND indexname LIKE '%wallet%unique%'
      ORDER BY indexname
    `);
    
    console.log('Created indexes:');
    indexCheck.rows.forEach(row => {
      console.log(`✅ ${row.indexname}`);
    });
    
    console.log('\n✅ Migration 021 completed successfully!\n');
    console.log('Summary:');
    console.log('- Added UNIQUE partial indexes for wallet_btc, wallet_eth, wallet_usdt, wallet_ltc');
    console.log('- NULL values are allowed (shops can have empty wallets)');
    console.log('- Non-NULL values must be unique across all shops');
    console.log('- Prevents payment routing conflicts and wallet theft\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
