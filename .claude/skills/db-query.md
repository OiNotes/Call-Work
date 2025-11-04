---
name: db-query
description: Run SQL queries against PostgreSQL, show table schemas, export to CSV/JSON. Use when analyzing data or debugging database issues.
---

# DB Query Skill

Run quick SQL queries on telegram_shop database with formatted output.

## What this skill does:

1. Executes SQL queries on telegram_shop database
2. Formats output beautifully (tables, expanded, json)
3. Provides common query templates
4. Shows table schemas
5. Database statistics

## Usage:

Say: **"query db"** or **"check users table"** or **"show recent shops"** or **"database stats"**

## Common queries:

```bash
# Users count
echo "=== Users Count ==="
psql telegram_shop -c "SELECT COUNT(*) as total_users, COUNT(*) FILTER (WHERE role='seller') as sellers, COUNT(*) FILTER (WHERE role='buyer') as buyers FROM users;"

# Recent shops
echo ""
echo "=== Recent Shops (last 10) ==="
psql telegram_shop -c "SELECT id, name, tier, created_at FROM shops ORDER BY created_at DESC LIMIT 10;"

# Products by shop
echo ""
echo "=== Products for Shop ID 1 ==="
psql telegram_shop -c "SELECT id, name, price, quantity, status FROM products WHERE shop_id = 1 ORDER BY created_at DESC LIMIT 10;"

# Recent orders
echo ""
echo "=== Recent Orders (last 10) ==="
psql telegram_shop -c "SELECT o.id, o.status, s.name as shop, o.total_amount, o.created_at FROM orders o JOIN shops s ON o.shop_id = s.id ORDER BY o.created_at DESC LIMIT 10;"

# Table sizes
echo ""
echo "=== Table Sizes ==="
psql telegram_shop -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Database size
echo ""
echo "=== Database Size ==="
psql telegram_shop -c "SELECT pg_size_pretty(pg_database_size('telegram_shop'));"
```

## Query templates:

### Users:
```sql
-- All users
SELECT * FROM users ORDER BY created_at DESC LIMIT 10;

-- Users by role
SELECT * FROM users WHERE role = 'seller';

-- User activity
SELECT telegram_id, username, created_at FROM users ORDER BY created_at DESC LIMIT 20;
```

### Shops:
```sql
-- All shops
SELECT * FROM shops ORDER BY created_at DESC;

-- Shops by tier
SELECT id, name, tier, created_at FROM shops WHERE tier = 'PRO';

-- Shop with product count
SELECT s.id, s.name, s.tier, COUNT(p.id) as products 
FROM shops s 
LEFT JOIN products p ON s.id = p.shop_id 
GROUP BY s.id 
ORDER BY products DESC;
```

### Products:
```sql
-- Products in stock
SELECT * FROM products WHERE quantity > 0 ORDER BY created_at DESC;

-- Low stock products
SELECT id, name, quantity, shop_id FROM products WHERE quantity < 10 AND quantity > 0;

-- Products by price range
SELECT * FROM products WHERE price BETWEEN 10 AND 100 ORDER BY price DESC;
```

### Orders:
```sql
-- Pending orders
SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC;

-- Completed orders today
SELECT * FROM orders 
WHERE status = 'completed' 
AND DATE(created_at) = CURRENT_DATE;

-- Orders by shop
SELECT o.id, o.status, o.total_amount, o.created_at 
FROM orders o 
WHERE o.shop_id = 1 
ORDER BY o.created_at DESC 
LIMIT 20;
```

### Payments:
```sql
-- Recent payments
SELECT * FROM payments ORDER BY created_at DESC LIMIT 20;

-- Payments by status
SELECT status, COUNT(*), SUM(amount) as total FROM payments GROUP BY status;

-- Pending payments
SELECT * FROM payments WHERE status = 'pending' ORDER BY created_at DESC;
```

## Table info:

```bash
# Show table schema
psql telegram_shop -c "\d+ users"

# List all tables
psql telegram_shop -c "\dt"

# List all indexes
psql telegram_shop -c "\di"

# Show table columns
psql telegram_shop -c "\d orders"
```

## Export results:

```bash
# Export to CSV
psql telegram_shop -c "COPY (SELECT * FROM users) TO '/tmp/users.csv' CSV HEADER;"

# Export specific query to CSV
psql telegram_shop -c "COPY (SELECT id, name, email FROM users WHERE role='seller') TO '/tmp/sellers.csv' CSV HEADER;"
```

## Database statistics:

```bash
# Active connections
psql telegram_shop -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'telegram_shop';"

# Table access stats
psql telegram_shop -c "SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch FROM pg_stat_user_tables ORDER BY seq_scan DESC;"

# Most written tables
psql telegram_shop -c "SELECT tablename, n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes FROM pg_stat_user_tables ORDER BY n_tup_ins DESC LIMIT 10;"
```

## When to use:

- 📊 Checking data after API calls
- 📊 Debug order/payment issues
- 📊 Gathering statistics for reports
- 📊 Verifying migrations worked
- 📊 Data export for analysis
- 📊 Schema inspection

## Pro tips:

- Use `\x` in psql for expanded display (easier to read)
- Add `LIMIT 10` to queries when exploring data
- Use `EXPLAIN ANALYZE` prefix to check query performance
- Check indexes if queries are slow: `\d+ tablename`
