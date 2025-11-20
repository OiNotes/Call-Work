-- Migration: Add performance indexes
-- Description: Add missing indexes for common queries
-- Date: 2025-11-08

-- 1. Payments by status (very common filter)
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 2. Payments ordered by created_at (pagination, analytics)
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- 3. Synced products stale check (productSyncService)
CREATE INDEX IF NOT EXISTS idx_synced_products_last_synced ON synced_products(last_synced_at);

-- 4. Orders by product + status (inventory management)
CREATE INDEX IF NOT EXISTS idx_orders_product_status ON orders(product_id, status);

-- 5. Shop subscriptions by user + shop (subscription lookup)
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_user_shop ON shop_subscriptions(user_id, shop_id);

-- 6. Synced products by follow + conflict_status (conflict resolution)
CREATE INDEX IF NOT EXISTS idx_synced_products_follow_status ON synced_products(follow_id, conflict_status);

-- 7. Invoices by order or subscription (payment verification)
CREATE INDEX IF NOT EXISTS idx_invoices_order_subscription ON invoices(order_id, subscription_id);
