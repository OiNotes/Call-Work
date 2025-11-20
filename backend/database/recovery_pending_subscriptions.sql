-- ============================================
-- RECOVERY SCRIPT: Pending Subscriptions Analysis
-- ============================================
-- 
-- SITUATION:
-- 11 subscriptions stuck in 'pending' status with shop_id = NULL
-- Potential financial impact: $275-385 USD
-- 
-- IMPORTANT: This script is READ-ONLY for analysis steps.
-- Actual recovery requires manual verification of blockchain transactions
-- and careful UPDATE statements (CAREFULLY review WHERE conditions!)
--
-- USAGE:
-- Step 1: Run STEP 1 to analyze all pending subscriptions
-- Step 2: For each tx_hash, verify on blockchain (see STEP 2)
-- Step 3: Run STEP 3 to cancel expired invoices (optional)
-- Step 4: Run STEP 4 to identify users for outreach
-- Step 5: Run STEP 5 to verify no new pending subscriptions appear
--
-- ============================================


-- ======================================
-- STEP 1: Анализ всех pending subscriptions
-- ======================================
-- WHAT: Shows all 11 pending subscriptions with related invoice and payment data
-- EXPECTED OUTPUT: 11 rows with subscription details
-- 
-- KEY FIELDS:
-- - subscription_id: ID in shop_subscriptions table
-- - shop_id: Should be NULL for all 11 affected records
-- - user_id: User who initiated subscription
-- - tier: 'basic' ($25/mo) or 'pro' ($35/mo)
-- - amount: USD amount
-- - tx_hash: Blockchain transaction hash (MUST VERIFY on blockchain)
-- - chain: Blockchain type (BTC, ETH, USDT_TRC20, LTC)
-- - invoice_status: 'pending', 'paid', 'expired', 'cancelled'
-- - payment_status: 'pending', 'confirmed', 'failed'
-- - verified_at: When payment was verified (NULL if unverified)

SELECT 
  -- Subscription info
  s.id AS subscription_id,
  s.user_id,
  u.telegram_id,
  u.username,
  s.tier,
  s.amount,
  s.status AS subscription_status,
  s.currency,
  
  -- Subscription timeline
  s.period_start,
  s.period_end,
  s.created_at AS subscription_created_at,
  s.verified_at AS subscription_verified_at,
  
  -- Transaction info
  s.tx_hash,
  
  -- Invoice data
  i.id AS invoice_id,
  i.chain,
  i.address,
  i.expected_amount,
  i.crypto_amount,
  i.usd_rate,
  i.status AS invoice_status,
  i.expires_at,
  i.created_at AS invoice_created_at,
  
  -- Payment verification
  p.id AS payment_id,
  p.status AS payment_status,
  p.confirmations,
  p.verified_at AS payment_verified_at,
  p.created_at AS payment_created_at,
  p.updated_at AS payment_updated_at,
  
  -- Recovery status
  CASE 
    WHEN i.expires_at < NOW() THEN 'EXPIRED - CANCEL'
    WHEN p.status = 'confirmed' AND s.status = 'pending' THEN 'PAID - RECOVER'
    WHEN p.status = 'pending' THEN 'AWAITING VERIFICATION'
    WHEN p.id IS NULL AND i.expires_at > NOW() THEN 'NO PAYMENT RECORD'
    ELSE 'UNKNOWN STATUS'
  END AS recovery_action
  
FROM shop_subscriptions s
LEFT JOIN users u ON u.id = s.user_id
LEFT JOIN invoices i ON i.subscription_id = s.id
LEFT JOIN payments p ON p.subscription_id = s.id
WHERE s.status = 'pending' AND s.shop_id IS NULL
ORDER BY s.created_at DESC;


-- ======================================
-- STEP 2: Manual Blockchain Verification
-- ======================================
-- WHAT: For each subscription with tx_hash, verify payment was actually received
-- IMPORTANT: MUST be done manually for each transaction!
-- 
-- BLOCKCHAIN EXPLORERS:
-- 
-- Bitcoin (BTC):
--   https://www.blockchain.com/btc/tx/{tx_hash}
--   Look for: confirmations >= 3, amount matches expected_amount
--
-- Litecoin (LTC):
--   https://blockchair.com/litecoin/transaction/{tx_hash}
--   Look for: confirmations >= 12, amount matches expected_amount
--
-- Ethereum (ETH):
--   https://etherscan.io/tx/{tx_hash}
--   Look for: Status = Success, amount matches crypto_amount
--
-- Tether TRC20 (USDT):
--   https://tronscan.org/#/transaction/{tx_hash}
--   Look for: Status = Success, contract address = TR7NHqjeKQxGTCi8q28sD94mMi41v62pCq
--
-- VERIFICATION CHECKLIST FOR EACH TRANSACTION:
-- [ ] Transaction found on blockchain
-- [ ] Status = Success / Confirmed
-- [ ] Confirmations >= minimum required (BTC:3, LTC:12, ETH:15, USDT:20)
-- [ ] Amount received matches expected_amount
-- [ ] Destination address matches invoice.address
--
-- IF VERIFIED = PROCEED TO RECOVERY (STEP 3a)
-- IF NOT FOUND = CANCEL INVOICE (STEP 3b)
-- IF EXPIRED = DELETE RECORD (STEP 3b)

SELECT 
  s.id AS subscription_id,
  s.tx_hash,
  i.chain,
  i.address AS expected_address,
  i.crypto_amount AS expected_crypto_amount,
  i.expected_amount AS expected_usd_amount,
  i.expires_at,
  CASE i.chain
    WHEN 'BTC' THEN 'https://www.blockchain.com/btc/tx/'
    WHEN 'LTC' THEN 'https://blockchair.com/litecoin/transaction/'
    WHEN 'ETH' THEN 'https://etherscan.io/tx/'
    WHEN 'USDT_TRC20' THEN 'https://tronscan.org/#/transaction/'
  END || s.tx_hash AS blockchain_explorer_url,
  NOW() > i.expires_at AS is_expired
FROM shop_subscriptions s
LEFT JOIN invoices i ON i.subscription_id = s.id
WHERE s.status = 'pending' AND s.shop_id IS NULL AND s.tx_hash IS NOT NULL
ORDER BY s.created_at DESC;


-- ======================================
-- STEP 3a: Recovery Query (TEMPLATE - DO NOT RUN DIRECTLY!)
-- ======================================
-- WHAT: Template for recovering a subscription after blockchain verification
-- WARNING: This will MODIFY database! Use only after manual blockchain verification!
-- 
-- STEPS TO RECOVER (execute one at a time for each subscription):
--
-- Step 1: Update payment status to confirmed (after verifying on blockchain)
-- ---
-- UPDATE payments 
-- SET status = 'confirmed', verified_at = NOW()
-- WHERE subscription_id = {subscription_id}
--   AND tx_hash = '{tx_hash_from_blockchain}';
--
-- Step 2: Update invoice status to paid
-- ---
-- UPDATE invoices
-- SET status = 'paid', updated_at = NOW()
-- WHERE subscription_id = {subscription_id}
--   AND id = {invoice_id};
--
-- Step 3: Create shop (ONLY IF NEEDED - get shop_id from CREATE result)
-- ---
-- INSERT INTO shops (owner_id, name, tier, subscription_status, registration_paid, created_at)
-- VALUES ({user_id}, 'Auto Created Shop', '{tier}', 'active', true, NOW())
-- RETURNING id;
--
-- Step 4: Update subscription with shop_id and status
-- ---
-- UPDATE shop_subscriptions
-- SET status = 'active', shop_id = {newly_created_shop_id}, verified_at = NOW()
-- WHERE id = {subscription_id};
--
--
-- EXAMPLE EXECUTION FOR subscription_id = 5 (hypothetical):
-- =========================================================
--
-- -- STEP 1: Verify on blockchain that tx_hash = '0x123abc...' was received
-- -- STEP 2: Check that amount matched expected_amount
--
-- -- STEP 3: Update payment
-- UPDATE payments 
-- SET status = 'confirmed', verified_at = NOW()
-- WHERE subscription_id = 5
--   AND tx_hash = '0x123abc456def789ghi';
--
-- -- STEP 4: Update invoice
-- UPDATE invoices
-- SET status = 'paid', updated_at = NOW()
-- WHERE subscription_id = 5;
--
-- -- STEP 5: Create shop (or use existing if user has one)
-- INSERT INTO shops (owner_id, name, tier, subscription_status, registration_paid, created_at)
-- VALUES (15, 'MyAwesomeShop', 'pro', 'active', true, NOW())
-- RETURNING id;
--   -- Returns: id = 42
--
-- -- STEP 6: Update subscription
-- UPDATE shop_subscriptions
-- SET status = 'active', shop_id = 42, verified_at = NOW()
-- WHERE id = 5;
--
-- -- STEP 7: Verify recovery
-- SELECT id, user_id, shop_id, status, verified_at 
-- FROM shop_subscriptions 
-- WHERE id = 5;


-- ======================================
-- STEP 3b: Cleanup Expired Subscriptions (IF VERIFIED NOT FOUND)
-- ======================================
-- WHAT: Mark as expired and cancel if blockchain verification failed
-- NOTE: Only run this for subscriptions that were NOT found on blockchain
--       or invoices that are already expired (expires_at < NOW())
--
-- BEFORE RUNNING: Verify that you checked blockchain and confirmed:
-- [ ] Transaction NOT FOUND on blockchain, OR
-- [ ] Invoice has already expired (expires_at < NOW())
--
-- WARNING: This will MODIFY database! Review carefully before uncommenting!

-- Step 1: Cancel invoice if expired
-- UPDATE invoices
-- SET status = 'cancelled', updated_at = NOW()
-- WHERE subscription_id IN (
--   SELECT s.id 
--   FROM shop_subscriptions s
--   LEFT JOIN invoices i ON i.subscription_id = s.id
--   WHERE s.status = 'pending' 
--     AND s.shop_id IS NULL
--     AND i.expires_at < NOW()
-- );

-- Step 2: Cancel subscription if invoice was cancelled
-- UPDATE shop_subscriptions
-- SET status = 'cancelled'
-- WHERE status = 'pending' 
--   AND shop_id IS NULL
--   AND id IN (
--     SELECT s.id 
--     FROM shop_subscriptions s
--     LEFT JOIN invoices i ON i.subscription_id = s.id
--     WHERE i.status = 'cancelled'
--   );

-- Log of cancelled subscriptions
SELECT 
  id AS cancelled_subscription_id,
  user_id,
  tier,
  amount,
  created_at,
  status
FROM shop_subscriptions
WHERE status = 'cancelled' 
  AND shop_id IS NULL
ORDER BY created_at DESC;


-- ======================================
-- STEP 4: User Notification List
-- ======================================
-- WHAT: Get list of users with pending subscriptions for manual outreach
-- OUTPUT: Telegram IDs and subscription count for notifying users
--
-- ACTIONS:
-- 1. Get telegram_ids and usernames from this query
-- 2. Send manual message through bot: "Your subscription payment is pending. Please verify: [blockchain link]"
-- 3. For expired: "Your subscription has expired and was cancelled. Would you like to retry?"

SELECT DISTINCT
  u.id AS user_id,
  u.telegram_id,
  u.username,
  COUNT(s.id) AS pending_subscriptions_count,
  SUM(s.amount) AS total_pending_amount_usd,
  STRING_AGG(
    DISTINCT s.tier || ' ($' || s.amount || ')',
    ', '
    ORDER BY s.tier || ' ($' || s.amount || ')'
  ) AS tier_breakdown,
  MIN(s.created_at) AS oldest_pending_subscription,
  MAX(s.created_at) AS newest_pending_subscription
FROM users u
JOIN shop_subscriptions s ON s.user_id = u.id
WHERE s.status = 'pending' AND s.shop_id IS NULL
GROUP BY u.id, u.telegram_id, u.username
ORDER BY total_pending_amount_usd DESC NULLS LAST;


-- ======================================
-- STEP 5: Prevention & Verification Check
-- ======================================
-- WHAT: Verify that subscription creation bugs are fixed
-- EXPECTED: 0 rows (no new pending subscriptions without invoices)
--
-- RUN THIS AFTER ALL RECOVERY STEPS COMPLETED
-- This query checks that no new pending subscriptions appear
-- without associated invoice records (indicating bug persistence)

SELECT 
  'NEW pending without invoice after fixes' AS issue_type,
  COUNT(*) AS count,
  'CRITICAL - Bug not fixed!' AS severity
FROM shop_subscriptions s
LEFT JOIN invoices i ON i.subscription_id = s.id
WHERE s.status = 'pending' 
  AND s.shop_id IS NULL
  AND s.created_at > NOW() - INTERVAL '5 minutes'
  AND i.id IS NULL;

-- Also check for orphaned invoices
SELECT 
  'ORPHANED: Invoices without subscriptions' AS issue_type,
  COUNT(*) AS count
FROM invoices
WHERE subscription_id IS NOT NULL
  AND subscription_id NOT IN (SELECT id FROM shop_subscriptions);

-- Check for orphaned payments
SELECT 
  'ORPHANED: Payments without subscriptions' AS issue_type,
  COUNT(*) AS count
FROM payments
WHERE subscription_id IS NOT NULL
  AND subscription_id NOT IN (SELECT id FROM shop_subscriptions);


-- ======================================
-- STEP 6: Full Recovery Status Report
-- ======================================
-- WHAT: Comprehensive report of all pending subscriptions and their status
-- SHOWS: Which ones are recoverable, which are expired, which need action

SELECT 
  s.id,
  u.username,
  s.tier,
  s.amount,
  s.status,
  s.created_at,
  NOW() - s.created_at AS time_pending,
  i.status AS invoice_status,
  i.expires_at,
  CASE 
    WHEN i.expires_at < NOW() THEN 'EXPIRED'
    WHEN i.expires_at IS NULL THEN 'NO INVOICE'
    WHEN NOW() > i.expires_at - INTERVAL '5 minutes' THEN 'EXPIRING SOON'
    ELSE 'VALID'
  END AS invoice_validity,
  p.status AS payment_status,
  p.confirmations,
  CASE 
    WHEN p.status = 'confirmed' AND s.status = 'pending' THEN 'READY TO RECOVER'
    WHEN p.status = 'pending' THEN 'AWAITING BLOCKCHAIN'
    WHEN p.id IS NULL THEN 'NO PAYMENT RECORD'
    WHEN i.expires_at < NOW() THEN 'CANCEL - EXPIRED'
    ELSE 'INVESTIGATE'
  END AS recommended_action
FROM shop_subscriptions s
LEFT JOIN users u ON u.id = s.user_id
LEFT JOIN invoices i ON i.subscription_id = s.id
LEFT JOIN payments p ON p.subscription_id = s.id
WHERE s.status = 'pending' AND s.shop_id IS NULL
ORDER BY s.created_at DESC;
