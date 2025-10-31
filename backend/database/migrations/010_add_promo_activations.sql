-- Migration: Add promo_activations table for idempotent promo code tracking
-- Purpose: Prevent users from using the same promo code multiple times
-- Created: 2025-10-31

BEGIN;

-- Create promo_activations table
CREATE TABLE IF NOT EXISTS promo_activations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  promo_code VARCHAR(50) NOT NULL,
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one promo per user
  UNIQUE(user_id, promo_code)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_promo_activations_user_promo
  ON promo_activations(user_id, promo_code);

CREATE INDEX IF NOT EXISTS idx_promo_activations_shop
  ON promo_activations(shop_id);

COMMIT;
