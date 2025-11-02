-- Migration 020: Add discount system to products
-- Adds support for permanent and timer-based discounts

BEGIN;

-- Add discount fields to products table
ALTER TABLE products 
  ADD COLUMN discount_percentage DECIMAL(5, 2) DEFAULT 0 
    CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

ALTER TABLE products 
  ADD COLUMN original_price DECIMAL(18, 8);

ALTER TABLE products 
  ADD COLUMN discount_expires_at TIMESTAMP;

-- Add index for filtering active discounts
CREATE INDEX idx_products_discount_active 
  ON products(shop_id, discount_percentage, discount_expires_at) 
  WHERE discount_percentage > 0;

-- Add comments for documentation
COMMENT ON COLUMN products.discount_percentage IS 'Discount percentage (0-100). 0 = no discount';
COMMENT ON COLUMN products.original_price IS 'Original price before discount. NULL if no discount applied';
COMMENT ON COLUMN products.discount_expires_at IS 'When discount expires. NULL = permanent discount';

COMMIT;
