# DB Query Skill

Run quick SQL queries on telegram_shop database with formatted output.

## What this skill does:

1. Executes SQL queries
2. Formats output beautifully
3. Provides common query templates
4. Shows table schemas
5. Exports results to CSV/JSON

## Usage:

Say: **"query db"** or **"check users table"** or **"show recent shops"** or **"database stats"**

## Common queries:

```bash
# Users count
echo "=== Users Count ==="
psql telegram_shop -c "SELECT COUNT(*) as total_users FROM users;"

# Recent shops
echo ""
echo "=== Recent Shops (last 10) ==="
psql telegram_shop -c "SELECT id, name, tier, created_at FROM shops ORDER BY created_at DESC LIMIT 10;" --expanded

# Products by shop
echo ""
echo "=== Products for Shop ID 1 ==="
psql telegram_shop -c "SELECT id, name, price, quantity FROM products WHERE shop_id = 1;"

# Recent orders
echo ""
echo "=== Recent Orders (last 10) ==="
psql telegram_shop -c "SELECT o.id, o.status, s.name as shop, u.username, o.created_at FROM orders o JOIN shops s ON o.shop_id = s.id JOIN users u ON o.buyer_id = u.id ORDER BY o.created_at DESC LIMIT 10;" --expanded

# Table sizes
echo ""
echo "=== Table Sizes ==="
psql telegram_shop -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

## Query templates:

### Users:
```sql
-- All users
SELECT * FROM users;

-- Users by role
SELECT * FROM users WHERE role = 'seller';

-- Users with shops
SELECT u.id, u.username, COUNT(s.id) as shop_count
FROM users u
LEFT JOIN shops s ON u.id = s.owner_id
GROUP BY u.id;
```

### Shops:
```sql
-- All shops
SELECT * FROM shops ORDER BY created_at DESC;

-- Shops by tier
SELECT * FROM shops WHERE tier = 'PRO';

-- Shop statistics
SELECT s.name,
       COUNT(DISTINCT p.id) as products,
       COUNT(DISTINCT o.id) as orders
FROM shops s
LEFT JOIN products p ON s.id = p.shop_id
LEFT JOIN orders o ON s.id = o.shop_id
GROUP BY s.id, s.name;
```

### Products:
```sql
-- Products in stock
SELECT * FROM products WHERE quantity > 0;

-- Low stock products
SELECT * FROM products WHERE quantity < 10 AND quantity > 0;

-- Products by price range
SELECT * FROM products WHERE price BETWEEN 10 AND 100;
```

### Orders:
```sql
-- Pending orders
SELECT * FROM orders WHERE status = 'pending';

-- Completed orders today
SELECT * FROM orders
WHERE status = 'completed'
AND DATE(created_at) = CURRENT_DATE;

-- Total revenue by shop
SELECT s.name, SUM(o.total_amount) as revenue
FROM orders o
JOIN shops s ON o.shop_id = s.id
WHERE o.status = 'completed'
GROUP BY s.id, s.name
ORDER BY revenue DESC;
```

### Shop Follows:
```sql
-- Active subscriptions
SELECT * FROM shop_follows WHERE is_active = true;

-- Follows by mode
SELECT mode, COUNT(*) as count
FROM shop_follows
GROUP BY mode;
```

## Export results:

```bash
# Export to CSV
psql telegram_shop -c "COPY (SELECT * FROM users) TO '/tmp/users.csv' CSV HEADER;"

# Export to JSON (using jq)
psql telegram_shop -t -c "SELECT row_to_json(t) FROM (SELECT * FROM users) t" | jq -s '.'
```

## Table info:

```bash
# Show table schema
psql telegram_shop -c "\d+ users"

# List all tables
psql telegram_shop -c "\dt"

# List all indexes
psql telegram_shop -c "\di"

# Show table relationships
psql telegram_shop -c "\d+ orders"
```

## Database statistics:

```bash
# Database size
psql telegram_shop -c "SELECT pg_size_pretty(pg_database_size('telegram_shop'));"

# Active connections
psql telegram_shop -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'telegram_shop';"

# Most used tables
psql telegram_shop -c "SELECT schemaname, tablename, n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes FROM pg_stat_user_tables ORDER BY n_tup_ins DESC;"
```

## When to use:

- 📊 Checking data
- 📊 Debug order issues
- 📊 Gathering statistics
- 📊 Data export
- 📊 Schema inspection
- 📊 Performance analysis
