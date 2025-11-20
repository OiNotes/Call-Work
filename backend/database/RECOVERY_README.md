# Recovery: Pending Subscriptions (shop_id = NULL)

## Problem Summary

**11 subscriptions** are stuck in `pending` status with `shop_id = NULL`

- **Financial Impact**: $275-385 USD in potential lost revenue
- **Root Cause**: Subscription creation system bug (likely race condition in webhook handling)
- **Status**: Requires manual blockchain verification + recovery

### Affected Subscriptions

```sql
SELECT COUNT(*) FROM shop_subscriptions 
WHERE status = 'pending' AND shop_id IS NULL;
-- Expected: 11
```

---

## Recovery Procedure (6 Steps)

### Step 1: Analyze All Pending Subscriptions

```bash
psql telegram_shop -f recovery_pending_subscriptions.sql
```

**Output**: Detailed report showing:
- subscription_id, user_id, tier, amount
- invoice status, expiration date
- payment status, confirmations
- blockchain tx_hash

**Save this output** - you'll reference it for blockchain verification.

---

### Step 2: Blockchain Verification (CRITICAL!)

For **each subscription with a tx_hash**, verify the payment was actually received.

**IMPORTANT**: Do NOT recover without this verification!

#### Blockchain Explorers by Chain

| Chain | Explorer URL | Min Confirmations |
|-------|--------------|-------------------|
| BTC | https://www.blockchain.com/btc/tx/{tx_hash} | 3 |
| LTC | https://blockchair.com/litecoin/transaction/{tx_hash} | 12 |
| ETH | https://etherscan.io/tx/{tx_hash} | 15 |
| USDT TRC20 | https://tronscan.org/#/transaction/{tx_hash} | 20 |

#### Verification Checklist (for each tx)

```
[ ] Transaction found on blockchain
[ ] Status = Success / Confirmed
[ ] Confirmations >= minimum required
[ ] Amount received matches expected_amount (from STEP 1 query)
[ ] Destination address matches invoice.address (from STEP 1 query)
[ ] NOT a pending transaction
[ ] NOT a failed transaction
```

#### Example: Bitcoin Transaction

```
TxHash: 5a6c8f2b9e1d4a7c3f6b8e2a9c1d5e7f
Explorer: https://www.blockchain.com/btc/tx/5a6c8f2b9e1d4a7c3f6b8e2a9c1d5e7f

VERIFY:
✓ Transaction found
✓ Status: Confirmed (1042 confirmations)
✓ Amount: 0.00375 BTC (matches expected_crypto_amount)
✓ Sent to: 1A1z7agoat2QZZZZZZZZZZZZZZZZZZZZZZ (matches invoice.address)
✓ Date: 2025-11-08 14:23:45 UTC

ACTION: This transaction is VERIFIED - proceed to recovery
```

---

### Step 3: Recover Verified Subscriptions

For **each verified transaction**, execute these SQL steps (one subscription at a time):

#### 3a. Update Payment Status (after blockchain verification)

```sql
-- BEFORE RUNNING: Verify on blockchain that tx_hash was received!
-- Change {subscription_id} and {tx_hash} to actual values from STEP 1

UPDATE payments 
SET status = 'confirmed', verified_at = NOW()
WHERE subscription_id = {subscription_id}
  AND tx_hash = '{tx_hash}';

-- Verify: Should show 1 row affected
```

#### 3b. Update Invoice Status

```sql
-- Change {subscription_id} to actual value

UPDATE invoices
SET status = 'paid', updated_at = NOW()
WHERE subscription_id = {subscription_id};

-- Verify: Should show 1 row affected
```

#### 3c. Create Shop (if user doesn't have one)

First, check if user already has a shop:

```sql
-- Change {user_id} to actual value from STEP 1

SELECT id, name, tier FROM shops 
WHERE owner_id = {user_id} 
LIMIT 1;
```

If no shop exists, create one:

```sql
-- Change {user_id} and {tier} to actual values

INSERT INTO shops (owner_id, name, tier, subscription_status, registration_paid, created_at)
VALUES ({user_id}, 'Shop ' || TO_CHAR(NOW(), 'YYYY-MM-DD'), '{tier}', 'active', true, NOW())
RETURNING id;

-- Save the returned 'id' value - you'll need it in next step
-- Example output: id = 42
```

#### 3d. Update Subscription with Shop ID

```sql
-- Change {subscription_id} and {shop_id} to actual values

UPDATE shop_subscriptions
SET status = 'active', shop_id = {shop_id}, verified_at = NOW()
WHERE id = {subscription_id};

-- Verify: Should show 1 row affected
```

#### 3e. Verify Recovery Success

```sql
-- Change {subscription_id} to verify recovery worked

SELECT 
  id, 
  user_id, 
  shop_id, 
  status, 
  verified_at,
  created_at
FROM shop_subscriptions 
WHERE id = {subscription_id};

-- Expected:
-- id = {subscription_id}
-- shop_id = {created_shop_id} (NOT NULL anymore!)
-- status = 'active'
-- verified_at = current timestamp
```

---

### Step 4: Cancel Expired Subscriptions (if not verified)

For subscriptions where:
- Blockchain verification FAILED (tx not found)
- Invoice already expired (expires_at < NOW())

```sql
-- STEP 1: Find expired invoices and cancel them
UPDATE invoices
SET status = 'cancelled', updated_at = NOW()
WHERE subscription_id IN (
  SELECT s.id 
  FROM shop_subscriptions s
  LEFT JOIN invoices i ON i.subscription_id = s.id
  WHERE s.status = 'pending' 
    AND s.shop_id IS NULL
    AND i.expires_at < NOW()
);

-- STEP 2: Cancel associated subscriptions
UPDATE shop_subscriptions
SET status = 'cancelled'
WHERE status = 'pending' 
  AND shop_id IS NULL
  AND id IN (
    SELECT s.id 
    FROM shop_subscriptions s
    LEFT JOIN invoices i ON i.subscription_id = s.id
    WHERE i.status = 'cancelled'
  );

-- STEP 3: Verify cancellations
SELECT 
  id,
  user_id,
  tier,
  amount,
  status,
  created_at
FROM shop_subscriptions
WHERE status = 'cancelled' AND shop_id IS NULL;
```

---

### Step 5: Notify Users (Manual Outreach)

Get list of affected users:

```sql
SELECT 
  u.telegram_id,
  u.username,
  COUNT(s.id) AS pending_count,
  SUM(s.amount) AS total_usd
FROM users u
JOIN shop_subscriptions s ON s.user_id = u.id
WHERE s.status IN ('pending', 'cancelled') AND s.shop_id IS NULL
GROUP BY u.id, u.telegram_id, u.username
ORDER BY total_usd DESC;
```

**Message template for Telegram bot**:

```
🚀 Your subscription is ready!

We found your pending subscription payment (${AMOUNT} USD - {TIER} tier).

Your blockchain transaction was confirmed:
📊 {CHAIN}: {TX_HASH_SHORTENED}

Your shop is now active! 
🎉 You can start selling immediately.

Questions? Reply to this message.
```

For **cancelled** subscriptions:

```
⏰ Your subscription request expired

Your payment request (#SUB_ID) was not completed within 30 minutes and expired.

Would you like to create a new subscription?
💳 Create new subscription: [button]
```

---

### Step 6: Prevention Check (Verify Bug is Fixed)

After all recovery steps, run this query to ensure no new affected subscriptions appear:

```sql
-- This should return 0 rows if bug is fixed
SELECT 
  COUNT(*) AS new_pending_without_invoice
FROM shop_subscriptions s
LEFT JOIN invoices i ON i.subscription_id = s.id
WHERE s.status = 'pending' 
  AND s.shop_id IS NULL
  AND s.created_at > NOW() - INTERVAL '1 hour'
  AND i.id IS NULL;

-- Expected: 0 rows

-- Also check for orphaned records
SELECT COUNT(*) as orphaned_invoices 
FROM invoices
WHERE subscription_id NOT IN (SELECT id FROM shop_subscriptions);

SELECT COUNT(*) as orphaned_payments 
FROM payments
WHERE subscription_id NOT IN (SELECT id FROM shop_subscriptions);

-- Expected: 0 rows for both
```

---

## Complete Example: Recovering Single Subscription

**Given**: subscription_id = 5, user_id = 12, amount = $35, tier = 'pro'

```bash
# STEP 1: Check current state
psql telegram_shop -c "
  SELECT id, status, shop_id, verified_at, user_id 
  FROM shop_subscriptions 
  WHERE id = 5;
"
# Output: 5 | pending | (null) | (null) | 12

# STEP 2: Verify blockchain
# Open: https://etherscan.io/tx/0x5a6c8f2b9e1d4a7c3f6b8e2a9c1d5e7f
# ✓ Status: Success
# ✓ Amount: 0.0133 ETH (matches expected)
# ✓ To: 0x1234567890123456789012345678901234567890 (matches invoice.address)

# STEP 3: Update payment
psql telegram_shop -c "
  UPDATE payments 
  SET status = 'confirmed', verified_at = NOW()
  WHERE subscription_id = 5 AND tx_hash = '0x5a6c8f2b9e1d4a7c3f6b8e2a9c1d5e7f';
"

# STEP 4: Update invoice
psql telegram_shop -c "
  UPDATE invoices
  SET status = 'paid', updated_at = NOW()
  WHERE subscription_id = 5;
"

# STEP 5: Check if user has shop
psql telegram_shop -c "
  SELECT id FROM shops WHERE owner_id = 12 LIMIT 1;
"
# Output: (empty) - no shop exists

# STEP 6: Create shop
psql telegram_shop -c "
  INSERT INTO shops (owner_id, name, tier, subscription_status, registration_paid, created_at)
  VALUES (12, 'Shop 2025-11-10', 'pro', 'active', true, NOW())
  RETURNING id;
"
# Output: 42 (the new shop_id)

# STEP 7: Update subscription with shop
psql telegram_shop -c "
  UPDATE shop_subscriptions
  SET status = 'active', shop_id = 42, verified_at = NOW()
  WHERE id = 5;
"

# STEP 8: Verify recovery
psql telegram_shop -c "
  SELECT id, status, shop_id, verified_at 
  FROM shop_subscriptions 
  WHERE id = 5;
"
# Output: 5 | active | 42 | 2025-11-10 12:34:56
```

---

## Safety Checklist

Before executing any recovery:

- [ ] Read the entire recovery procedure
- [ ] Ran STEP 1 analysis query and saved output
- [ ] For each subscription: verified on blockchain that tx was received
- [ ] Checked all fields match (amount, address, confirmations)
- [ ] Reviewed SQL queries and changed all placeholders {like_this}
- [ ] Got approval from project owner
- [ ] Backed up database (or have rollback plan)
- [ ] Testing on staging first (NOT production!)
- [ ] Monitoring logs during recovery

### Rollback Plan (if something goes wrong)

```bash
# If recovery failed, revert changes
git checkout backend/database/
psql telegram_shop < backup.sql
```

---

## Troubleshooting

### "Transaction not found on blockchain"

**Cause**: User never actually sent the payment

**Action**:
1. Cancel the subscription (STEP 4)
2. Notify user the payment wasn't received
3. Ask them to retry

### "Invoice already expired (expires_at < NOW())"

**Cause**: User waited too long to send payment

**Action**:
1. Cancel subscription (STEP 4)
2. User must create new subscription to retry

### "User already has a shop"

**Cause**: User might have multiple pending subscriptions

**Action**:
1. Check `SELECT * FROM shops WHERE owner_id = {user_id}`
2. Link pending subscription to existing shop_id (skip STEP 3c)

### "Payment shows 'failed' status"

**Cause**: Transaction was rejected by blockchain

**Action**:
1. Cancel subscription
2. User must retry payment

---

## Database Maintenance

After recovery, cleanup old records:

```sql
-- Archive very old expired subscriptions (> 30 days)
DELETE FROM shop_subscriptions
WHERE status IN ('cancelled', 'expired')
  AND created_at < NOW() - INTERVAL '30 days';

-- This is optional - for long-term maintenance
```

---

## Questions / Issues

If you encounter issues during recovery:

1. Check logs: `backend/logs/error-*.log`
2. Review the SQL query output carefully
3. Verify blockchain transaction one more time
4. Consult the troubleshooting section above
5. Contact the backend team if stuck

---

**Last Updated**: 2025-11-10  
**Recovery Script Version**: 1.0  
**Database Version**: PostgreSQL 13+
