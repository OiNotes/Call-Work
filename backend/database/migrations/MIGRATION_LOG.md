# Migration Log

## Applied Migrations (в порядке применения)

| #   | File                                                          | Description                        | Date Applied               |
| --- | ------------------------------------------------------------- | ---------------------------------- | -------------------------- |
| 001 | 001_add_shop_name_unique_constraint.sql                       | Shop name uniqueness               | Phase 1                    |
| 002 | 002_add_reserved_quantity.sql                                 | Product reservation system         | Phase 1                    |
| 002 | 002_add_shop_workers.sql                                      | Worker management (PRO)            | Phase 1                    |
| 003 | 003_add_invoices.sql                                          | HD wallet invoices                 | Phase 1                    |
| 004 | 004_add_missing_indexes.sql                                   | Performance indexes                | Phase 1                    |
| 005 | 005_prevent_circular_follows.sql                              | Circular follow prevention         | Phase 1                    |
| 006 | 006_add_processed_webhooks.sql                                | Webhook deduplication              | Phase 1                    |
| 007 | 007_add_shop_tier_and_subscription_status.sql                 | Tier system                        | Phase 1                    |
| 008 | 008_add_preorder_support.sql → **RENAMED to 026**             | Pre-order support (RENAMED)        | Phase 3                    |
| 008 | 008_optimize_database_performance.sql → **RENAMED to 027**    | Performance optimization (RENAMED) | Phase 3                    |
| 009 | 009_add_channel_url.sql                                       | Channel migration                  | Phase 1                    |
| 009 | 009_add_critical_performance_indexes.sql → **RENAMED to 028** | Critical indexes (RENAMED)         | Phase 3                    |
| 009 | 009_add_product_reservation.sql → **RENAMED to 029**          | Product reservation (RENAMED)      | Phase 3                    |
| 010 | 010_add_promo_activations.sql                                 | Promo codes                        | Phase 1                    |
| 010 | 010_wallet_unique_constraints.sql                             | Wallet uniqueness                  | Phase 1                    |
| 011 | 011_add_subscription_payment_automation.sql                   | Subscription automation            | Phase 1                    |
| 012 | 012_fix_subscription_payment_schema.sql                       | Subscription schema fix            | Phase 2                    |
| 013 | 013_fix_currency_constraints.sql                              | Currency constraints               | Phase 2                    |
| 014 | 014_add_pending_status_to_shop_subscriptions.sql              | Pending status                     | Phase 2                    |
| 015 | 015_add_pending_to_shops_status.sql                           | Shop pending status                | Phase 2                    |
| 016 | 016_add_crypto_amount_to_invoices.sql                         | Invoice crypto amount              | Phase 2                    |
| 017 | 017_add_user_id_to_shop_subscriptions.sql                     | User ID tracking                   | Phase 2                    |
| 018 | 018_add_ltc_to_payments_currency.sql                          | Litecoin support                   | Phase 2                    |
| 019 | 019_rename_wallet_ton_to_wallet_ltc.sql                       | Wallet rename                      | Phase 2                    |
| 020 | 020_add_discount_system.sql                                   | Product discounts                  | Phase 2                    |
| 021 | 021_add_unique_wallet_constraints.sql                         | Wallet constraints                 | Phase 2                    |
| 022 | 022_add_promo_codes_table.sql                                 | Promo codes table                  | Phase 2                    |
| 023 | 023_add_composite_indexes.sql                                 | Composite indexes                  | Phase 3                    |
| 024 | 024_add_foreign_key_indexes.sql                               | FK indexes                         | Phase 3                    |
| 025 | 025_add_not_null_constraints.sql                              | NOT NULL constraints               | Phase 3                    |
| 026 | 026_add_preorder_support.sql                                  | Pre-order functionality            | Phase 3 (RENAMED from 008) |
| 027 | 027_optimize_database_performance.sql                         | Performance optimization           | Phase 3 (RENAMED from 008) |
| 028 | 028_add_critical_performance_indexes.sql                      | Critical indexes                   | Phase 3 (RENAMED from 009) |
| 029 | 029_add_product_reservation.sql                               | Product reservation                | Phase 3 (RENAMED from 009) |
| 033 | 033_add_wallet_address_sequences.sql                          | Wallet address sequences (BIP44)   | Phase 4 (2025-11-09)       |
| 034 | 034_remove_usdt_erc20.sql                                     | Remove USDT ERC-20 support         | Phase 4 (2025-11-09)       |

## Migration Numbering Conflicts Resolved

**Issue:** Duplicate migration numbers (008, 009) after Phase 1-3 bug fixing.

**Root Cause:**

- During Phase 1-3 bug fixes, new migrations were created with existing numbers
- Original migrations 008 and 009 were either:
  - Overwritten (008_add_invoices.sql → lost)
  - Kept but duplicated (009_add_channel_url.sql → kept)

**Resolution:**

- **Kept:** First occurrence remains untouched
  - ❌ `008_add_invoices.sql` - LOST (overwritten during fixes)
  - ✅ `009_add_channel_url.sql` - KEPT (original)
- **Renamed:** Duplicate migrations renumbered to 026-029
  - `008_add_preorder_support.sql` → `026_add_preorder_support.sql`
  - `008_optimize_database_performance.sql` → `027_optimize_database_performance.sql`
  - `009_add_critical_performance_indexes.sql` → `028_add_critical_performance_indexes.sql`
  - `009_add_product_reservation.sql` → `029_add_product_reservation.sql`

**Updated Files:**

- ✅ 4 migration files renamed (026-029)
- ✅ `verify_integrity.sql` - added status validation checks
- ✅ `MIGRATION_LOG.md` - created this log

**Applied:** 2025-01-06 (Phase 4 cleanup)

---

## Database Integrity Verification

After applying migrations, always run:

```bash
psql $DATABASE_URL -f backend/database/verify_integrity.sql
```

**Critical Checks (MUST be 0):**

- orphaned_payments
- orphaned_shop_subs
- orphaned_workers
- orphaned_invoices
- broken_synced_products
- broken_follows
- invalid status values (shop_subscriptions, shops)

**Acceptable Warnings:**

- orders_no_buyer (ON DELETE SET NULL behavior)
- subs_to_inactive (shops can be inactive)
- circular_follows (should be 0, but monitored)

---

## Migration Best Practices

1. **Numbering:**
   - Sequential: 001, 002, 003...
   - If duplicate found: append to end (026, 027...)
   - Never reuse deleted migration numbers

2. **Testing:**
   - Always test on local DB first
   - Run `verify_integrity.sql` after applying
   - Check logs for errors

3. **Rollback:**
   - Include DOWN migration in comments
   - Keep backups before major migrations
   - Document breaking changes

4. **Documentation:**
   - Update this log when adding migrations
   - Include description and dependencies
   - Note any data migration steps

---

## Next Migration Number: 035

When creating new migration, use number **035** and increment sequentially.
