-- Migration 009: Add channel_url to shops table
-- Purpose: Store Telegram channel URL for shop notifications and migration tracking
-- Created: 2025-11-05

BEGIN;

-- Add channel_url column
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS channel_url VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN shops.channel_url IS 'Telegram channel URL for shop notifications (format: @channel_name or https://t.me/channel_name)';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shops_channel_url ON shops(channel_url);

COMMIT;
