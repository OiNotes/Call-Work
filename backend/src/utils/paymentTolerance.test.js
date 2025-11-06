import {
  TOLERANCE_BOUNDS,
  clampTolerance,
  validateTolerance,
  amountsMatchWithTolerance,
  toleranceToPercentage,
  getToleranceInfo
} from './paymentTolerance.js';

/**
 * Payment Tolerance Unit Tests
 *
 * Tests for tolerance bounds validation and clamping logic
 */

describe('Payment Tolerance Utilities', () => {
  describe('TOLERANCE_BOUNDS', () => {
    it('should have correct bounds defined', () => {
      expect(TOLERANCE_BOUNDS.MIN_TOLERANCE).toBe(0.0001);
      expect(TOLERANCE_BOUNDS.MAX_TOLERANCE).toBe(1.0);
      expect(TOLERANCE_BOUNDS.DEFAULT_TOLERANCE).toBe(0.005);
    });
  });

  describe('clampTolerance', () => {
    it('should return value as-is if within bounds', () => {
      const value = 0.005; // 0.5%
      expect(clampTolerance(value, 'TEST')).toBe(0.005);
    });

    it('should clamp value to MIN_TOLERANCE if too low', () => {
      const value = 0.00001; // 0.001%
      expect(clampTolerance(value, 'TEST')).toBe(0.0001);
    });

    it('should clamp value to MAX_TOLERANCE if too high', () => {
      const value = 1.5; // 1.5%
      expect(clampTolerance(value, 'TEST')).toBe(1.0);
    });

    it('should return DEFAULT_TOLERANCE for null/undefined', () => {
      expect(clampTolerance(null, 'TEST')).toBe(0.005);
      expect(clampTolerance(undefined, 'TEST')).toBe(0.005);
    });

    it('should work with edge values', () => {
      expect(clampTolerance(0.0001, 'TEST')).toBe(0.0001); // Min bound
      expect(clampTolerance(1.0, 'TEST')).toBe(1.0); // Max bound
    });
  });

  describe('validateTolerance', () => {
    it('should validate correct tolerance values', () => {
      const result = validateTolerance(0.005);
      expect(result.valid).toBe(true);
    });

    it('should reject negative tolerance', () => {
      const result = validateTolerance(-0.005);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('negative');
    });

    it('should reject tolerance below minimum', () => {
      const result = validateTolerance(0.00001);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too low');
    });

    it('should reject tolerance above maximum', () => {
      const result = validateTolerance(1.5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too high');
    });

    it('should reject non-numeric values', () => {
      const result = validateTolerance('0.005');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    it('should accept null/undefined with default', () => {
      const resultNull = validateTolerance(null);
      expect(resultNull.valid).toBe(true);
      expect(resultNull.clamped).toBe(0.005);

      const resultUndef = validateTolerance(undefined);
      expect(resultUndef.valid).toBe(true);
      expect(resultUndef.clamped).toBe(0.005);
    });
  });

  describe('amountsMatchWithTolerance', () => {
    it('should match amounts within default tolerance (0.5%)', () => {
      const expected = 100;
      const actual = 100.0025; // 0.0025% difference
      expect(amountsMatchWithTolerance(actual, expected)).toBe(true);
    });

    it('should match at exact tolerance boundary', () => {
      const expected = 100;
      const actual = 100.5; // 0.5% difference
      expect(amountsMatchWithTolerance(actual, expected)).toBe(true);
    });

    it('should reject amounts outside tolerance', () => {
      const expected = 100;
      const actual = 101; // 1% difference
      expect(amountsMatchWithTolerance(actual, expected)).toBe(false);
    });

    it('should work with small amounts', () => {
      const expected = 0.001; // 0.001 BTC
      const actual = 0.0010005; // 0.5% difference
      expect(amountsMatchWithTolerance(actual, expected)).toBe(true);
    });

    it('should work with large amounts', () => {
      const expected = 10000;
      const actual = 10050; // 0.5% difference
      expect(amountsMatchWithTolerance(actual, expected)).toBe(true);
    });

    it('should respect custom tolerance value', () => {
      const expected = 100;
      const actual = 100.1; // 0.1% difference
      const tolerance = 0.001; // 0.1%
      expect(amountsMatchWithTolerance(actual, expected, tolerance)).toBe(true);
    });

    it('should respect context for logging', () => {
      const expected = 100;
      const actual = 102; // 2% difference, exceeds default 0.5%
      // Should not throw, just log warning and return false
      expect(amountsMatchWithTolerance(actual, expected, undefined, 'BTC')).toBe(false);
    });

    it('should clamp custom tolerance to bounds', () => {
      const expected = 100;
      const actual = 100.5005; // Slightly more than 0.5%
      const tooHighTolerance = 2.0; // 2% (above 1% max)
      // Should be clamped to 1%, so 100.5005 is within bounds
      expect(amountsMatchWithTolerance(actual, expected, tooHighTolerance)).toBe(true);
    });
  });

  describe('toleranceToPercentage', () => {
    it('should format tolerance as percentage string', () => {
      expect(toleranceToPercentage(0.005)).toBe('0.5000%');
      expect(toleranceToPercentage(0.01)).toBe('1.0000%');
      expect(toleranceToPercentage(0.0001)).toBe('0.0100%');
    });

    it('should handle edge values', () => {
      expect(toleranceToPercentage(1.0)).toBe('100.0000%');
      expect(toleranceToPercentage(0)).toBe('0.0000%');
    });
  });

  describe('getToleranceInfo', () => {
    it('should return info object with valid tolerance', () => {
      const info = getToleranceInfo(0.005);
      expect(info).toHaveProperty('provided', 0.005);
      expect(info).toHaveProperty('clamped', 0.005);
      expect(info).toHaveProperty('percentage', '0.5000%');
      expect(info).toHaveProperty('isDefault', true);
      expect(info).toHaveProperty('isClamped', false);
      expect(info).toHaveProperty('bounds');
    });

    it('should show clamped value for out-of-bounds tolerance', () => {
      const info = getToleranceInfo(2.0); // Above max
      expect(info.provided).toBe(2.0);
      expect(info.clamped).toBe(1.0);
      expect(info.isClamped).toBe(true);
      expect(info.percentage).toBe('100.0000%');
    });

    it('should include bounds information', () => {
      const info = getToleranceInfo(0.005);
      expect(info.bounds).toHaveProperty('min', '0.0100%');
      expect(info.bounds).toHaveProperty('max', '100.0000%');
    });
  });

  describe('Real-world payment scenarios', () => {
    it('BTC payment: 0.5 BTC with 0.5% tolerance', () => {
      const expected = 0.5;
      const actual = 0.50249; // Just under 0.5% difference
      expect(amountsMatchWithTolerance(actual, expected, undefined, 'BTC')).toBe(true);
    });

    it('ETH payment: 1.5 ETH with 0.5% tolerance', () => {
      const expected = 1.5;
      const actual = 1.5075; // 0.5% difference
      expect(amountsMatchWithTolerance(actual, expected, undefined, 'ETH')).toBe(true);
    });

    it('USDT payment: 100 USDT with 0.5% tolerance', () => {
      const expected = 100;
      const actual = 100.5; // 0.5% difference
      expect(amountsMatchWithTolerance(actual, expected, undefined, 'USDT')).toBe(true);
    });

    it('Should reject if actual is much less than expected', () => {
      const expected = 100;
      const actual = 99; // 1% difference
      expect(amountsMatchWithTolerance(actual, expected)).toBe(false);
    });

    it('Should reject if actual is much more than expected', () => {
      const expected = 100;
      const actual = 101.5; // 1.5% difference
      expect(amountsMatchWithTolerance(actual, expected)).toBe(false);
    });
  });
});
