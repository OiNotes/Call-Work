-- Migration: Add promo_codes table for database-driven promo code system
-- Issue: P0-BACK-1 - Remove hardcoded promo code 'comi9999'
-- Date: 2025-11-05

-- Create promo_codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_percentage DECIMAL(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  tier VARCHAR(10) NOT NULL CHECK (tier IN ('basic', 'pro')),
  max_uses INT DEFAULT NULL, -- NULL = unlimited uses
  used_count INT DEFAULT 0 CHECK (used_count >= 0),
  expires_at TIMESTAMP DEFAULT NULL, -- NULL = never expires
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_max_uses CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT check_used_count_limit CHECK (max_uses IS NULL OR used_count <= max_uses)
);

-- Create index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, expires_at);

-- Add comments
COMMENT ON TABLE promo_codes IS 'Database-driven promo codes for subscription discounts';
COMMENT ON COLUMN promo_codes.code IS 'Promo code string (case-insensitive)';
COMMENT ON COLUMN promo_codes.discount_percentage IS 'Discount percentage (0-100)';
COMMENT ON COLUMN promo_codes.tier IS 'Which tier this promo applies to: basic or pro';
COMMENT ON COLUMN promo_codes.max_uses IS 'Maximum number of uses. NULL = unlimited';
COMMENT ON COLUMN promo_codes.used_count IS 'Current usage count';
COMMENT ON COLUMN promo_codes.expires_at IS 'Expiration timestamp. NULL = never expires';
COMMENT ON COLUMN promo_codes.is_active IS 'Whether promo code is currently active';

-- Migrate existing hardcoded promo code 'comi9999' to database
-- Check if code already exists in promo_activations to preserve history
DO $$
DECLARE
  existing_activations INT;
BEGIN
  -- Count how many times 'comi9999' was used
  SELECT COUNT(*) INTO existing_activations
  FROM promo_activations
  WHERE promo_code = 'comi9999';

  -- Insert the legacy promo code with current usage count
  INSERT INTO promo_codes (
    code,
    discount_percentage,
    tier,
    max_uses,
    used_count,
    expires_at,
    is_active
  ) VALUES (
    'comi9999',
    25.00,
    'pro',
    NULL, -- unlimited uses
    existing_activations,
    NULL, -- never expires
    true
  )
  ON CONFLICT (code) DO NOTHING;

  RAISE NOTICE 'Migrated promo code "comi9999" with % existing uses', existing_activations;
END $$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_promo_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_promo_codes_updated_at
BEFORE UPDATE ON promo_codes
FOR EACH ROW
EXECUTE FUNCTION update_promo_codes_updated_at();

-- Rollback script (commented out - uncomment to rollback)
-- DROP TRIGGER IF EXISTS trigger_update_promo_codes_updated_at ON promo_codes;
-- DROP FUNCTION IF EXISTS update_promo_codes_updated_at();
-- DROP TABLE IF EXISTS promo_codes CASCADE;
