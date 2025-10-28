-- ============================================
-- Migration 009: Add product reservation system
-- Created: 2025-10-28
-- Purpose: Separate reserved quantity from actual stock
-- Formula: available_stock = stock_quantity - reserved_quantity
-- ============================================

-- Add reserved_quantity column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS reserved_quantity INT DEFAULT 0 CHECK (reserved_quantity >= 0);

-- Add descriptive comment for clarity
COMMENT ON COLUMN products.reserved_quantity IS 'Quantity reserved by unpaid orders. Available stock = stock_quantity - reserved_quantity';

-- Add constraint to prevent negative available stock
-- This ensures stock_quantity >= reserved_quantity at all times
ALTER TABLE products
DROP CONSTRAINT IF EXISTS check_available_stock;

ALTER TABLE products
ADD CONSTRAINT check_available_stock 
CHECK (stock_quantity >= reserved_quantity);

-- Create composite index for availability checks
-- This index speeds up queries filtering by active products with stock availability
CREATE INDEX IF NOT EXISTS idx_products_availability 
ON products(id, stock_quantity, reserved_quantity) 
WHERE is_active = true;

-- Create view for available stock calculations (optional helper)
-- This view simplifies queries that need available quantity
CREATE OR REPLACE VIEW products_with_availability AS
SELECT 
  p.*,
  (p.stock_quantity - p.reserved_quantity) AS available_quantity
FROM products p;

COMMENT ON VIEW products_with_availability IS 'Convenience view showing products with calculated available_quantity field';

-- ============================================
-- Migration completed successfully
-- ============================================
-- Next steps:
-- 1. Update product queries to use available_quantity
-- 2. Reserve stock when creating orders (UPDATE products SET reserved_quantity = reserved_quantity + ?)
-- 3. Decrease reserved_quantity and stock_quantity after payment confirmation
-- 4. Release reserved_quantity if order is cancelled
