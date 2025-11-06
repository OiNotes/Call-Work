-- Migration: Add preorder support to products table
-- Created: 2025-11-04
-- Description: Adds is_preorder column to allow products to be marked as preorder items

BEGIN;

-- Add preorder support to products table
ALTER TABLE products
ADD COLUMN is_preorder BOOLEAN DEFAULT false NOT NULL;

-- Add partial index for preorder filtering (only indexes rows where is_preorder = true)
-- This optimizes queries filtering by shop_id and is_preorder status
CREATE INDEX idx_products_preorder ON products(shop_id, is_preorder) WHERE is_preorder = true;

-- Add comment for documentation
COMMENT ON COLUMN products.is_preorder IS 'Indicates if product is available for preorder only (not in stock yet)';

COMMIT;

-- Rollback instructions (if needed):
-- ALTER TABLE products DROP COLUMN is_preorder;
-- DROP INDEX IF EXISTS idx_products_preorder;
