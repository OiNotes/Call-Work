import Decimal from 'decimal.js';

// Configure Decimal for crypto precision
Decimal.set({
  precision: 20, // More than enough for crypto (18 decimals max)
  rounding: Decimal.ROUND_DOWN, // Always round down for safety
});

/**
 * Convert USD to crypto amount with exact precision
 * @param {number|string} usdAmount - USD amount
 * @param {number|string} rate - Crypto price in USD
 * @returns {string} Crypto amount (string to preserve precision)
 */
export function convertUsdToCrypto(usdAmount, rate) {
  const usd = new Decimal(usdAmount);
  const price = new Decimal(rate);
  return usd.dividedBy(price).toFixed(8); // 8 decimals for BTC/ETH
}

/**
 * Compare two amounts with tolerance
 * @param {number|string} amount1
 * @param {number|string} amount2
 * @param {number} tolerancePercent - Default 0.5%
 * @returns {boolean} True if amounts match within tolerance
 */
export function amountsMatch(amount1, amount2, tolerancePercent = 0.5) {
  const a1 = new Decimal(amount1);
  const a2 = new Decimal(amount2);
  const tolerance = a2.times(tolerancePercent / 100);
  const diff = a1.minus(a2).abs();
  return diff.lessThanOrEqualTo(tolerance);
}

/**
 * Round crypto amount to specific decimals
 * @param {number|string} amount - Amount to round
 * @param {number} decimals - Number of decimal places
 * @returns {string} Rounded amount as string
 */
export function roundCryptoAmount(amount, decimals = 8) {
  return new Decimal(amount).toFixed(decimals);
}

export { Decimal };
