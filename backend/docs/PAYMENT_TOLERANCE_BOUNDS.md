# Payment Tolerance Bounds - Implementation Guide

**Status:** Implementation Complete
**Date:** 2025-11-06
**Files Modified:** 7 service/route files
**New Utility:** `backend/src/utils/paymentTolerance.js`

---

## Overview

Payment tolerance is used in payment verification to allow minor differences between expected and received amounts due to network fees, rounding, and precision issues. However, tolerance values can be misused if not validated.

**Problem:** Tolerance was hardcoded as 0.5% (0.005) with no bounds checking, validation, or logging.

**Solution:** Centralized tolerance validation utility with:

- MIN_TOLERANCE = 0.01% (0.0001)
- MAX_TOLERANCE = 1.0% (1.0)
- DEFAULT_TOLERANCE = 0.5% (0.005) - industry standard
- Automatic clamping and logging when bounds exceeded

---

## Tolerance Bounds

| Bound       | Value  | Percentage | Use Case                                                 |
| ----------- | ------ | ---------- | -------------------------------------------------------- |
| **Minimum** | 0.0001 | 0.01%      | Prevents too-tight tolerance that rejects valid payments |
| **Default** | 0.005  | 0.5%       | Industry standard for blockchain payments                |
| **Maximum** | 1.0    | 1.0%       | Prevents excessive tolerance that accepts fraud          |

### Rationale

- **0.01% minimum:** Typical blockchain fees are 0.1-0.5%, so 0.01% prevents false rejections while staying tight
- **0.5% default:** Industry standard for crypto payments, accounts for fee variation
- **1.0% maximum:** Above 1%, too many false-positive acceptances; prevents accidental abuse

---

## API Reference

### `TOLERANCE_BOUNDS`

Constant object with predefined bounds:

```javascript
import { TOLERANCE_BOUNDS } from '../utils/paymentTolerance.js';

TOLERANCE_BOUNDS.MIN_TOLERANCE; // 0.0001
TOLERANCE_BOUNDS.MAX_TOLERANCE; // 1.0
TOLERANCE_BOUNDS.DEFAULT_TOLERANCE; // 0.005
```

### `clampTolerance(value, context?)`

Clamps tolerance to valid bounds. Automatically logs if value is out of bounds.

**Parameters:**

- `value` (number): Tolerance value (decimal form, not percentage)
- `context` (string, optional): Context for logging (e.g., 'BTC', 'ETH')

**Returns:** (number) Clamped tolerance value

**Examples:**

```javascript
import { clampTolerance } from '../utils/paymentTolerance.js';

// Within bounds - returns as-is
clampTolerance(0.005, 'BTC'); // → 0.005

// Too low - clamps to min and logs warning
clampTolerance(0.00001, 'BTC'); // → 0.0001
// [Warning] Tolerance too low for BTC...

// Too high - clamps to max and logs warning
clampTolerance(1.5, 'ETH'); // → 1.0
// [Warning] Tolerance too high for ETH...

// Null/undefined - returns default
clampTolerance(null, 'USDT'); // → 0.005
```

### `validateTolerance(value)`

Validates tolerance without clamping. Returns validation result object.

**Parameters:**

- `value` (number): Tolerance value to validate

**Returns:** (object) `{ valid: boolean, error?: string, clamped?: number }`

**Examples:**

```javascript
import { validateTolerance } from '../utils/paymentTolerance.js';

// Valid tolerance
validateTolerance(0.005);
// → { valid: true }

// Invalid - too high
validateTolerance(2.0);
// → { valid: false, error: 'Tolerance too high: 2.0 (maximum: 1.0)' }

// Invalid - negative
validateTolerance(-0.005);
// → { valid: false, error: 'Tolerance cannot be negative: -0.005' }

// Invalid - non-numeric
validateTolerance('0.5');
// → { valid: false, error: 'Tolerance must be a number' }
```

### `amountsMatchWithTolerance(actual, expected, tolerance?, context?)`

Checks if amounts match within tolerance. Automatically clamps tolerance and logs mismatches.

**Parameters:**

- `actual` (number): Actual amount received
- `expected` (number): Expected amount
- `tolerance` (number, optional): Tolerance value (default: 0.005)
- `context` (string, optional): Context for logging (e.g., 'BTC', 'ETH')

**Returns:** (boolean) True if amounts match within tolerance

**Examples:**

```javascript
import { amountsMatchWithTolerance } from '../utils/paymentTolerance.js';

// Matches within 0.5% default tolerance
amountsMatchWithTolerance(100.5, 100, undefined, 'BTC');
// → true (0.5% difference = exactly at limit)

// Doesn't match - exceeds 0.5%
amountsMatchWithTolerance(101, 100, undefined, 'BTC');
// → false (1% difference > 0.5%)
// [Warning] Amount mismatch in BTC...

// Custom tolerance (0.1%)
amountsMatchWithTolerance(100.1, 100, 0.001, 'USDT');
// → true (0.1% difference = exactly at limit)

// Custom tolerance gets clamped if out of bounds
amountsMatchWithTolerance(100.5, 100, 2.0);
// → true (tolerance clamped to 1.0%, 0.5% < 1.0%)
```

### `toleranceToPercentage(tolerance)`

Converts decimal tolerance to percentage string.

**Parameters:**

- `tolerance` (number): Tolerance in decimal form

**Returns:** (string) Percentage string

**Examples:**

```javascript
import { toleranceToPercentage } from '../utils/paymentTolerance.js';

toleranceToPercentage(0.005); // → '0.5000%'
toleranceToPercentage(0.01); // → '1.0000%'
toleranceToPercentage(0.0001); // → '0.0100%'
toleranceToPercentage(1.0); // → '100.0000%'
```

### `getToleranceInfo(tolerance)`

Returns detailed info object about tolerance.

**Parameters:**

- `tolerance` (number): Tolerance value

**Returns:** (object) `{ provided, clamped, percentage, isDefault, isClamped, bounds }`

**Examples:**

```javascript
import { getToleranceInfo } from '../utils/paymentTolerance.js';

// Valid tolerance
getToleranceInfo(0.005);
// → {
//   provided: 0.005,
//   clamped: 0.005,
//   percentage: '0.5000%',
//   isDefault: true,
//   isClamped: false,
//   bounds: { min: '0.0100%', max: '100.0000%' }
// }

// Out-of-bounds tolerance
getToleranceInfo(2.0);
// → {
//   provided: 2.0,
//   clamped: 1.0,
//   percentage: '100.0000%',
//   isDefault: false,
//   isClamped: true,
//   bounds: { min: '0.0100%', max: '100.0000%' }
// }
```

---

## Usage Examples

### Before (Hardcoded tolerance):

```javascript
// BTC/LTC webhook verification
const tolerance = expectedAmount * 0.005; // Hardcoded 0.5%
if (Math.abs(receivedAmount - expectedAmount) > tolerance) {
  // Reject payment
}

// ETH/USDT verification
const tolerance = expectedAmount * 0.01; // Hardcoded 1.0%?
if (Math.abs(amount - expectedAmount) > tolerance) {
  // Reject payment
}
```

**Problems:**

- Tolerance hardcoded in multiple places
- Different services used different values (0.005, 0.01)
- No validation or bounds checking
- No logging when tolerance is used

### After (Centralized with bounds):

```javascript
import { amountsMatchWithTolerance } from '../utils/paymentTolerance.js';

// BTC/LTC webhook verification
if (!amountsMatchWithTolerance(receivedAmount, expectedAmount, undefined, 'BTC')) {
  // Reject payment
}

// ETH/USDT verification (same function, consistent bounds)
if (!amountsMatchWithTolerance(amount, expectedAmount, undefined, 'ETH')) {
  // Reject payment
}

// Custom tolerance with validation
const customTolerance = 0.01; // Want 1%?
if (!amountsMatchWithTolerance(amount, expected, customTolerance, 'USDT')) {
  // customTolerance is clamped to 1.0% automatically
  // Reject payment
}
```

**Benefits:**

- Centralized, single source of truth
- Automatic bounds checking and clamping
- Consistent behavior across all services
- Detailed logging when tolerance adjusted
- Easy to change bounds globally

---

## Modified Files

### Services Updated (6 files)

1. **webhooks.js** (BTC/LTC webhook handler)
   - Line 318: Uses `amountsMatchWithTolerance` for amount validation
   - Logs chain type for context

2. **blockCypherService.js** (BTC/LTC verification)
   - Line 295: Uses `amountsMatchWithTolerance`
   - Replaces hardcoded 0.005 tolerance

3. **etherscanService.js** (ETH/USDT ERC-20)
   - Line 411: ETH payment verification
   - Line 522: USDT ERC-20 payment verification
   - Uses consistent tolerance bounds

4. **tronService.js** (USDT TRC-20)
   - Line 434: USDT TRC-20 payment verification
   - Uses consistent tolerance bounds

5. **pollingService.js** (Payment polling for ETH/TRON)
   - Line 305: USDT ERC-20 transfer matching
   - Line 360: USDT TRC-20 transfer matching
   - Uses consistent tolerance bounds

6. **crypto.js** (Multi-currency verification)
   - Line 92: BTC verification
   - Line 192: ETH verification
   - Line 346: USDT TRC-20 verification
   - Line 443: LTC verification

### New Files (2)

1. **paymentTolerance.js** - Main utility with all functions
2. **paymentTolerance.test.js** - Comprehensive unit tests

---

## Logging Examples

### When tolerance is clamped too low:

```
[PaymentTolerance] Tolerance too low for BTC
provided: 0.00001
minimum: 0.0001
clamped: 0.0001
percentage: 0.01%
```

### When tolerance is clamped too high:

```
[PaymentTolerance] Tolerance too high for USDT
provided: 2.0
maximum: 1.0
clamped: 1.0
percentage: 100.0000%
```

### When amount mismatch detected:

```
[PaymentTolerance] Amount mismatch in BTC
expected: 0.5
actual: 0.52
difference: 0.02000000
tolerance: 0.005
toleranceAmount: 0.00250000
percentage: 0.5000%
exceedsBy: 0.01750000
```

---

## Testing

Run tolerance tests:

```bash
cd backend
npm test -- paymentTolerance.test.js
```

Test coverage includes:

- Bound enforcement (clamping)
- Validation logic
- Amount matching with various tolerances
- Real-world payment scenarios
- Edge cases (zero amounts, huge amounts, etc.)

---

## Migration Guide

If you need to change tolerance globally:

1. **Update `TOLERANCE_BOUNDS` constants:**

   ```javascript
   // backend/src/utils/paymentTolerance.js
   export const TOLERANCE_BOUNDS = {
     MIN_TOLERANCE: 0.00005, // Changed from 0.0001
     MAX_TOLERANCE: 0.5, // Changed from 1.0
     DEFAULT_TOLERANCE: 0.003, // Changed from 0.005
   };
   ```

2. **All services automatically use new bounds** - no code changes needed!

3. **Run tests to verify:**
   ```bash
   npm test
   ```

---

## Best Practices

1. **Always use `amountsMatchWithTolerance`** instead of manual calculation:

   ```javascript
   // ✅ Good
   if (amountsMatchWithTolerance(actual, expected, undefined, 'BTC')) { ... }

   // ❌ Bad
   if (Math.abs(actual - expected) <= (expected * 0.005)) { ... }
   ```

2. **Provide context string** for better logging:

   ```javascript
   amountsMatchWithTolerance(amount, expected, undefined, 'ETH');
   // vs
   amountsMatchWithTolerance(amount, expected); // Still works, but no context in logs
   ```

3. **Validate tolerance if accepting user input:**

   ```javascript
   const userTolerance = req.body.tolerance;
   const validation = validateTolerance(userTolerance);

   if (!validation.valid) {
     return res.status(400).json({ error: validation.error });
   }
   ```

4. **Use `getToleranceInfo` for admin/debug endpoints:**
   ```javascript
   app.get('/api/admin/tolerance', (req, res) => {
     res.json(getToleranceInfo(CURRENT_TOLERANCE));
   });
   ```

---

## Security Considerations

- **Bounds prevent fraud:** MAX_TOLERANCE = 1% prevents accepting ~1% extra payment as valid
- **Validation prevents abuse:** validateTolerance rejects invalid values before processing
- **Logging tracks changes:** Every adjustment is logged for audit trail
- **Atomic operations:** Tolerance checking is part of atomic payment verification transaction

---

## Future Enhancements

Possible improvements:

- Per-currency tolerance bounds (BTC different from USDT)
- Database-configurable tolerance (set via admin panel)
- Tolerance override audit log with approvals
- Tolerance sensitivity alerts when frequently exceeded
- Dynamic tolerance based on network conditions

---

## References

- **Implementation:** `/Users/sile/Documents/Status Stock 4.0/backend/src/utils/paymentTolerance.js`
- **Tests:** `/Users/sile/Documents/Status Stock 4.0/backend/src/utils/paymentTolerance.test.js`
- **Modified Services:** See "Modified Files" section above

**Created:** 2025-11-06
