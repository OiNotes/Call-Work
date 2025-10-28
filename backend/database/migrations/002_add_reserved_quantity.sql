-- Migration: Add reserved_quantity column to products table
-- Purpose: Support order reservation system (reserve stock on order creation, decrease on payment)

ALTER TABLE products
ADD COLUMN reserved_quantity INT DEFAULT 0 CHECK (reserved_quantity >= 0);

COMMENT ON COLUMN products.reserved_quantity IS 'Reserved stock for pending orders (decreased after payment confirmation)';
