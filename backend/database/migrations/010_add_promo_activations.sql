-- Migration: Add promo_activations table for promo code tracking
-- Author: Claude
-- Date: 2025-11-02
-- Description: Creates promo_activations table to track promo code usage and prevent duplicate activations

-- ============================================
-- Promo Activations table
-- ============================================
CREATE TABLE IF NOT EXISTS promo_activations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  promo_code VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, promo_code)
);

COMMENT ON TABLE promo_activations IS 'Tracks promo code activations to prevent duplicate usage';
COMMENT ON COLUMN promo_activations.user_id IS 'User who activated the promo code';
COMMENT ON COLUMN promo_activations.shop_id IS 'Shop created with promo code';
COMMENT ON COLUMN promo_activations.promo_code IS 'Promo code used (e.g., comi9999)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_promo_activations_user ON promo_activations(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_activations_shop ON promo_activations(shop_id);
CREATE INDEX IF NOT EXISTS idx_promo_activations_code ON promo_activations(promo_code);

-- Verify migration
SELECT 'Migration 010: promo_activations table created successfully' AS status;
