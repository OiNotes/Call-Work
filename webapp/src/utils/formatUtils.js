/**
 * Format Utilities
 * Safe wrappers for number formatting operations
 */

/**
 * Safely format a number with fixed decimal places
 * Handles strings, numbers, null, undefined with proper type coercion
 *
 * @param {any} value - The value to format (can be string, number, null, undefined)
 * @param {number} digits - Number of decimal places (default: 2)
 * @returns {string} Formatted number as string (e.g., "150.00")
 *
 * @example
 * safeToFixed(150.123, 2)      // "150.12"
 * safeToFixed("150.123", 2)    // "150.12" ✅ Handles strings!
 * safeToFixed(null, 2)         // "0.00"
 * safeToFixed(undefined, 2)    // "0.00"
 * safeToFixed("invalid", 2)    // "0.00"
 */
export const safeToFixed = (value, digits = 2) => {
  // 1. Coerce to number (handles strings, numbers, null, undefined)
  const num = parseFloat(value);

  // 2. Validate the result
  if (typeof num === 'number' && !isNaN(num)) {
    return num.toFixed(digits);
  }

  // 3. Safe fallback with correct number of digits
  return (0).toFixed(digits);
};

/**
 * Safely parse a value to number
 *
 * @param {any} value - The value to parse
 * @param {number} fallback - Fallback value if parsing fails (default: 0)
 * @returns {number} Parsed number or fallback
 */
export const safeParseNumber = (value, fallback = 0) => {
  const num = parseFloat(value);
  return typeof num === 'number' && !isNaN(num) ? num : fallback;
};
