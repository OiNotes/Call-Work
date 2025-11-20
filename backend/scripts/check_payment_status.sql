-- Check recent invoices
SELECT id, subscription_id, chain, currency, address, crypto_amount, status, expires_at, created_at 
FROM invoices 
ORDER BY created_at DESC 
LIMIT 10;

-- Check recent payments
SELECT id, subscription_id, tx_hash, amount, currency, status, created_at 
FROM payments 
ORDER BY created_at DESC 
LIMIT 10;

-- Check recent subscriptions
SELECT id, user_id, tier, status, amount, tx_hash, created_at 
FROM shop_subscriptions 
ORDER BY created_at DESC 
LIMIT 10;

-- Check pending invoices
SELECT COUNT(*) as pending_count 
FROM invoices 
WHERE status = 'pending';

-- Check if polling service is finding invoices
SELECT id, chain, currency, address, status, expires_at 
FROM invoices 
WHERE status = 'pending' 
AND chain IN ('ETH', 'USDT_TRC20', 'BTC', 'LTC')
AND expires_at > NOW() - INTERVAL '24 hours'
LIMIT 10;
