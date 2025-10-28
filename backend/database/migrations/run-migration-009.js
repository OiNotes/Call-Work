import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration 009: product reservation system...');
    console.log('Formula: available_stock = stock_quantity - reserved_quantity\n');
    
    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '009_add_product_reservation.sql'),
      'utf8'
    );
    
    // Execute migration in a transaction
    await client.query('BEGIN');
    
    console.log('Executing migration SQL...');
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    console.log('✅ Migration committed successfully!\n');
    
    // Verification: Check column exists
    console.log('Verifying migration...');
    const columnCheck = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'reserved_quantity'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ Column verification passed:');
      console.log('   - reserved_quantity column exists');
      console.log(`   - Type: ${columnCheck.rows[0].data_type}`);
      console.log(`   - Default: ${columnCheck.rows[0].column_default}`);
    } else {
      throw new Error('Verification failed: reserved_quantity column not found');
    }
    
    // Verification: Check constraint exists
    const constraintCheck = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'products' 
      AND constraint_name = 'check_available_stock'
    `);
    
    if (constraintCheck.rows.length > 0) {
      console.log('✅ Constraint verification passed:');
      console.log('   - check_available_stock constraint exists');
    } else {
      throw new Error('Verification failed: check_available_stock constraint not found');
    }
    
    // Verification: Check index exists
    const indexCheck = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'products' 
      AND indexname = 'idx_products_availability'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log('✅ Index verification passed:');
      console.log('   - idx_products_availability index exists');
    } else {
      console.log('⚠️  Warning: idx_products_availability index not found (may already exist)');
    }
    
    // Verification: Check view exists
    const viewCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name = 'products_with_availability'
    `);
    
    if (viewCheck.rows.length > 0) {
      console.log('✅ View verification passed:');
      console.log('   - products_with_availability view exists\n');
    } else {
      console.log('⚠️  Warning: products_with_availability view not found (may already exist)\n');
    }
    
    // Test the view
    console.log('Testing products_with_availability view...');
    const viewTest = await client.query(`
      SELECT id, name, stock_quantity, reserved_quantity, available_quantity 
      FROM products_with_availability 
      LIMIT 3
    `);
    
    if (viewTest.rows.length > 0) {
      console.log('✅ View is working! Sample data:');
      viewTest.rows.forEach(row => {
        console.log(`   Product #${row.id}: ${row.name}`);
        console.log(`   - Stock: ${row.stock_quantity}, Reserved: ${row.reserved_quantity}, Available: ${row.available_quantity}`);
      });
    } else {
      console.log('ℹ️  No products found in database (view is ready for data)');
    }
    
    console.log('\n✅ Migration 009 completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Update order creation logic to reserve stock:');
    console.log('      UPDATE products SET reserved_quantity = reserved_quantity + ?');
    console.log('   2. Update payment confirmation to decrease both:');
    console.log('      UPDATE products SET stock_quantity = stock_quantity - ?, reserved_quantity = reserved_quantity - ?');
    console.log('   3. Update order cancellation to release reserved stock:');
    console.log('      UPDATE products SET reserved_quantity = reserved_quantity - ?');
    console.log('   4. Use products_with_availability view for availability checks');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
