# Pricing Logic Analysis

## Current Configuration

### subscriptionPricing.js (Single Source of Truth)

**Location:** `backend/src/config/subscriptionPricing.js`

**Full code:**
```javascript
/**
 * Subscription Pricing Configuration
 *
 * Single source of truth for subscription prices across all services.
 * This prevents pricing mismatches between subscriptionService.js and subscriptionInvoiceService.js
 *
 * Price structure:
 * - Basic tier: $25/month
 * - Pro tier: $35/month
 * - Grace period: 2 days after expiration
 * - Subscription period: 30 days
 *
 * Used by:
 * - subscriptionService.js - for subscription creation and renewals
 * - subscriptionInvoiceService.js - for crypto invoice generation
 * - subscriptionController.js - for price display in API responses
 */

/**
 * Monthly subscription prices (USD)
 */
export const SUBSCRIPTION_PRICES = {
  basic: 25.0,  // Basic tier: $25/month
  pro: 35.0,    // Pro tier: $35/month
};

/**
 * Yearly subscription prices (USD)
 * ~17% discount compared to monthly billing
 */
export const SUBSCRIPTION_PRICES_YEARLY = {
  basic: 250.0,  // $25/month * 12 = $300, discounted to $250 (17% off)
  pro: 350.0,    // $35/month * 12 = $420, discounted to $350 (17% off)
};

/**
 * Available subscription tiers
 */
export const SUBSCRIPTION_TIERS = ['basic', 'pro'];

/**
 * Subscription period in days (monthly)
 */
export const SUBSCRIPTION_PERIOD_DAYS = 30;

/**
 * Grace period after subscription expiration (days)
 * After grace period expires, shop is deactivated
 */
export const GRACE_PERIOD_DAYS = 2;

/**
 * Invoice expiration time for subscription payments (minutes)
 * Payment must be completed within this timeframe
 */
export const INVOICE_EXPIRATION_MINUTES = 30;

/**
 * Validate subscription tier
 */
export function isValidTier(tier) {
  return SUBSCRIPTION_TIERS.includes(tier);
}

/**
 * Get price for subscription tier
 */
export function getPrice(tier, yearly = false) {
  const prices = yearly ? SUBSCRIPTION_PRICES_YEARLY : SUBSCRIPTION_PRICES;
  const price = prices[tier];

  if (price === undefined) {
    throw new Error(`Invalid subscription tier: ${tier}`);
  }

  return price;
}

/**
 * Calculate prorated price for tier upgrade
 */
export function calculateProratedUpgrade(periodStart, periodEnd, fromTier, toTier) {
  const now = new Date();
  const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));

  const fromPrice = getPrice(fromTier);
  const toPrice = getPrice(toTier);

  const dailyDifference = (toPrice - fromPrice) / totalDays;
  const upgradeAmount = dailyDifference * remainingDays;

  return Math.max(0.01, Math.round(upgradeAmount * 100) / 100);
}
```

**Current prices:**
- Monthly:
  - basic: $25.00
  - pro: $35.00
- Yearly (17% discount):
  - basic: $250.00 (was $300)
  - pro: $350.00 (was $420)

**Other constants:**
- SUBSCRIPTION_PERIOD_DAYS: 30
- GRACE_PERIOD_DAYS: 2
- INVOICE_EXPIRATION_MINUTES: 30

---

## Import Locations

### 1. subscriptionService.js

**File:** `backend/src/services/subscriptionService.js`
**Line:** 14-20
**Imports:**
```javascript
import {
  SUBSCRIPTION_PRICES,
  SUBSCRIPTION_PRICES_YEARLY,
  SUBSCRIPTION_PERIOD_DAYS,
  GRACE_PERIOD_DAYS,
  calculateProratedUpgrade as calculateUpgradeAmountFromConfig,
} from '../config/subscriptionPricing.js';
```

**Usage locations:**

| Function | Line | Usage | Purpose |
|----------|------|-------|---------|
| `processSubscriptionPayment()` | 48 | `SUBSCRIPTION_PRICES[tier]` | Verify payment amount matches tier price |
| `upgradeShopToPro()` | 175-179 | `SUBSCRIPTION_PRICES.basic`, `SUBSCRIPTION_PRICES.pro` | Calculate prorated upgrade amount |
| `sendExpirationReminders()` | 511 | `SUBSCRIPTION_PRICES[tier]` | Display price in reminder notification |
| `getSubscriptionStatus()` | 590 | `SUBSCRIPTION_PRICES[shop.tier]` | Return current tier price in API response |
| `calculateUpgradeCost()` | 673 | `SUBSCRIPTION_PRICES.free`, `SUBSCRIPTION_PRICES.pro` | Calculate upgrade cost for API |

**Note:** Line 673 has a bug - uses `SUBSCRIPTION_PRICES.free` which doesn't exist (should be `.basic`).

---

### 2. subscriptionInvoiceService.js

**File:** `backend/src/services/subscriptionInvoiceService.js`
**Line:** 18-22
**Imports:** NONE (uses local constant - PROBLEM!)

```javascript
// ⚠️ CRITICAL: Duplicate pricing definition!
const SUBSCRIPTION_PRICES = {
  basic: 25.0,
  pro: 35.0,
};
```

**Usage locations:**

| Function | Line | Usage | Purpose |
|----------|------|-------|---------|
| `generateSubscriptionInvoice()` | 82 | `SUBSCRIPTION_PRICES[tier]` | Get USD amount for invoice generation |

**PROBLEM:** This service does NOT import from `subscriptionPricing.js`. It has a hardcoded duplicate!

**Risk:** If prices change in `subscriptionPricing.js`, this service will use outdated prices.

**Fix needed:**
```javascript
// Replace lines 18-22 with:
import {
  SUBSCRIPTION_PRICES,
  INVOICE_EXPIRATION_MINUTES
} from '../config/subscriptionPricing.js';

// Remove lines 24-25 (local INVOICE_EXPIRATION_MINUTES)
```

---

### 3. subscriptionController.js

**File:** `backend/src/controllers/subscriptionController.js`
**Line:** 10
**Imports:**
```javascript
import * as subscriptionService from '../services/subscriptionService.js';
```

**Usage locations (indirect via subscriptionService import):**

| Function | Line | Usage | Purpose |
|----------|------|-------|---------|
| `getPricing()` | 202 | `subscriptionService.SUBSCRIPTION_PRICES.basic` | Display basic price (monthly) |
| `getPricing()` | 207-208 | `subscriptionService.SUBSCRIPTION_PRICES.basic`, `.SUBSCRIPTION_PRICES_YEARLY.basic` | Display basic pricing (month/year) |
| `getPricing()` | 219 | `subscriptionService.SUBSCRIPTION_PRICES.pro` | Display pro price (monthly) |
| `getPricing()` | 224-225 | `subscriptionService.SUBSCRIPTION_PRICES.pro`, `.SUBSCRIPTION_PRICES_YEARLY.pro` | Display pro pricing (month/year) |
| `getPricing()` | 237 | `subscriptionService.GRACE_PERIOD_DAYS` | Display grace period info |

**Access pattern:** Uses `subscriptionService.*` (re-exported constants).

---

## Test Pricing Mechanism

### Current Status

**NO** - There is currently NO mechanism for using different prices in different environments.

**Evidence:**
- `subscriptionPricing.js` does not check `NODE_ENV`
- No environment variables for prices (`SUBSCRIPTION_PRICE_BASIC`, etc.)
- No `USE_TEST_PRICING` flag
- Prices are hardcoded constants

**Impact:**
- E2E tests must use production prices ($25, $35)
- Cannot test payment flow with $1 test prices
- Difficult to run tests without mocking blockchain APIs

---

## Recommended Approach

### Option A: Environment Variable Flag (RECOMMENDED)

**Advantages:**
- ✅ Simple toggle via `.env.test`
- ✅ No code changes in production
- ✅ Explicit control over when to use test prices
- ✅ Works with existing Jest `NODE_ENV=test`

**Implementation:**

```javascript
// subscriptionPricing.js

const PRODUCTION_PRICES = {
  basic: 25.0,
  pro: 35.0,
};

const TEST_PRICES = {
  basic: 1.0,   // $1 for easy testing
  pro: 1.0,     // $1 for easy testing
};

// Use test prices if:
// 1. USE_TEST_PRICING=true explicitly set, OR
// 2. NODE_ENV=test (Jest tests)
const shouldUseTestPricing =
  process.env.USE_TEST_PRICING === 'true' ||
  process.env.NODE_ENV === 'test';

export const SUBSCRIPTION_PRICES = shouldUseTestPricing
  ? TEST_PRICES
  : PRODUCTION_PRICES;

// Same for yearly:
const PRODUCTION_PRICES_YEARLY = {
  basic: 250.0,
  pro: 350.0,
};

const TEST_PRICES_YEARLY = {
  basic: 10.0,  // $10/year for testing
  pro: 10.0,    // $10/year for testing
};

export const SUBSCRIPTION_PRICES_YEARLY = shouldUseTestPricing
  ? TEST_PRICES_YEARLY
  : PRODUCTION_PRICES_YEARLY;
```

**Environment variables:**

```bash
# .env.test (Jest tests)
NODE_ENV=test                    # Automatically uses test prices

# .env.development (optional override)
USE_TEST_PRICING=true            # Force test prices in development

# .env.production (default)
# USE_TEST_PRICING not set       # Uses production prices
```

**Why this is best:**
1. Zero risk to production (flag must be explicitly set)
2. Automatic in test environment (`NODE_ENV=test`)
3. Can manually enable in development for testing
4. Clear and explicit behavior

---

### Option B: Environment Variables for Each Price

**Advantages:**
- ✅ Maximum flexibility
- ✅ Can set any price value
- ✅ No code changes needed

**Disadvantages:**
- ❌ More complex `.env` management
- ❌ Must remember to set ALL price vars
- ❌ Easy to forget one price
- ❌ No default values safety

**Implementation:**

```javascript
// subscriptionPricing.js

export const SUBSCRIPTION_PRICES = {
  basic: parseFloat(process.env.SUBSCRIPTION_PRICE_BASIC || '25.0'),
  pro: parseFloat(process.env.SUBSCRIPTION_PRICE_PRO || '35.0'),
};

export const SUBSCRIPTION_PRICES_YEARLY = {
  basic: parseFloat(process.env.SUBSCRIPTION_PRICE_BASIC_YEARLY || '250.0'),
  pro: parseFloat(process.env.SUBSCRIPTION_PRICE_PRO_YEARLY || '350.0'),
};
```

**Environment variables:**

```bash
# .env.test
SUBSCRIPTION_PRICE_BASIC=1.0
SUBSCRIPTION_PRICE_PRO=1.0
SUBSCRIPTION_PRICE_BASIC_YEARLY=10.0
SUBSCRIPTION_PRICE_PRO_YEARLY=10.0

# .env.production (or no values - uses defaults)
# Defaults: 25.0, 35.0, 250.0, 350.0
```

**Why NOT recommended:**
- Too many variables to manage
- Easy to make mistakes
- Less explicit than Option A

---

## Final Recommendation: Option A

**Why Option A is superior:**

1. **Safety:** Production never accidentally uses test prices
2. **Simplicity:** Single flag `USE_TEST_PRICING=true`
3. **Automatic:** Works automatically with `NODE_ENV=test` (Jest)
4. **Clear intent:** Code explicitly shows "test vs production"
5. **Maintainable:** Easy to understand and modify

**Migration path:**

1. Update `subscriptionPricing.js` with Option A code
2. Fix `subscriptionInvoiceService.js` to import from config (remove duplicate)
3. Add `USE_TEST_PRICING=true` to `.env.test`
4. E2E tests automatically use $1 prices
5. Production unaffected (no env var = production prices)

---

## Critical Issues Found

### Issue 1: Duplicate pricing in subscriptionInvoiceService.js

**Location:** `backend/src/services/subscriptionInvoiceService.js:18-22`
**Problem:** Hardcoded prices instead of importing from config
**Risk:** Price mismatch if config changes
**Fix:**

```javascript
// Remove:
const SUBSCRIPTION_PRICES = {
  basic: 25.0,
  pro: 35.0,
};

// Add import:
import { SUBSCRIPTION_PRICES, INVOICE_EXPIRATION_MINUTES } from '../config/subscriptionPricing.js';

// Remove duplicate INVOICE_EXPIRATION_MINUTES
```

### Issue 2: Bug in subscriptionService.js

**Location:** `backend/src/services/subscriptionService.js:673`
**Problem:** Uses `SUBSCRIPTION_PRICES.free` which doesn't exist
**Fix:**

```javascript
// Line 673 - Change:
SUBSCRIPTION_PRICES.free

// To:
SUBSCRIPTION_PRICES.basic
```

---

## Implementation Checklist

- [ ] Update `subscriptionPricing.js` with Option A (test pricing flag)
- [ ] Fix `subscriptionInvoiceService.js` duplicate pricing
- [ ] Fix `subscriptionService.js` line 673 bug (.free → .basic)
- [ ] Add `USE_TEST_PRICING=true` to `.env.test`
- [ ] Update E2E tests to expect $1 prices
- [ ] Verify production `.env` does NOT have `USE_TEST_PRICING`

---

**Date:** 2025-11-15
**Status:** Analysis complete, implementation pending
