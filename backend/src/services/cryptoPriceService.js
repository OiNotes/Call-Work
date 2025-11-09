/**
 * Crypto Price Service
 *
 * Fetches real-time cryptocurrency prices from CoinGecko API.
 * Features:
 * - Free API (no authentication required)
 * - 5-minute caching (reduces API calls)
 * - Supports BTC, ETH, LTC, USDT (TRC20)
 * - USD → Crypto conversion with proper decimal rounding
 */

import axios from 'axios';
import logger from '../utils/logger.js';
import {
  convertUsdToCrypto as convertUsdToCryptoDecimal,
  roundCryptoAmount as roundCryptoAmountDecimal,
} from '../utils/decimal.js';

// CoinGecko API configuration
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price';
const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Mapping: chain → CoinGecko coin ID
const COINGECKO_IDS = {
  BTC: 'bitcoin',
  LTC: 'litecoin',
  ETH: 'ethereum',
  USDT_TRC20: 'tether',
};

// Decimal precision for each cryptocurrency
const CRYPTO_DECIMALS = {
  BTC: 8,
  LTC: 8,
  ETH: 6,
  USDT_TRC20: 2,
};

// Price cache (in-memory)
const priceCache = {};
let lastFetchTime = 0;

/**
 * Get current cryptocurrency price in USD
 *
 * @param {string} chain - Chain name (BTC, ETH, LTC, USDT_TRC20)
 * @returns {Promise<number>} Price in USD
 * @throws {Error} If API fails or chain is unsupported
 */
export async function getCryptoPrice(chain) {
  try {
    // Check cache validity
    const now = Date.now();
    if (now - lastFetchTime < PRICE_CACHE_TTL && priceCache[chain]) {
      logger.info(`[CryptoPriceService] Using cached price for ${chain}: $${priceCache[chain]}`);
      return priceCache[chain];
    }

    // Validate chain
    if (!COINGECKO_IDS[chain]) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    // Fetch fresh prices from CoinGecko
    logger.info('[CryptoPriceService] Fetching fresh prices from CoinGecko...');

    const coinIds = Object.values(COINGECKO_IDS)
      .filter((value, index, self) => self.indexOf(value) === index) // Unique IDs only
      .join(',');

    const response = await axios.get(COINGECKO_API_URL, {
      params: {
        ids: coinIds,
        vs_currencies: 'usd',
      },
      timeout: 10000, // 10 second timeout
    });

    // Update cache with all fetched prices
    for (const [chainName, coinId] of Object.entries(COINGECKO_IDS)) {
      const price = response.data[coinId]?.usd;
      if (price) {
        priceCache[chainName] = price;
      }
    }

    lastFetchTime = now;

    logger.info('[CryptoPriceService] Prices fetched successfully:', priceCache);

    // Return requested chain's price
    const price = priceCache[chain];
    if (!price) {
      throw new Error(`Price not available for ${chain}`);
    }

    return price;
  } catch (error) {
    logger.error('[CryptoPriceService] Failed to fetch crypto price:', {
      chain,
      error: error.message,
      response: error.response?.data,
    });

    // If cache exists, return stale data as fallback
    if (priceCache[chain]) {
      logger.warn(
        `[CryptoPriceService] API failed, using stale cached price for ${chain}: $${priceCache[chain]}`
      );
      return priceCache[chain];
    }

    throw new Error(`Failed to fetch ${chain} price: ${error.message}`);
  }
}

/**
 * Convert USD amount to cryptocurrency amount
 * Uses Decimal.js for precise calculations (no floating point errors)
 *
 * @param {number} usdAmount - Amount in USD
 * @param {number} cryptoPrice - Current crypto price in USD
 * @returns {string} Amount in crypto (string to preserve precision)
 * @throws {Error} If cryptoPrice is invalid
 */
export function convertUsdToCrypto(usdAmount, cryptoPrice) {
  if (!cryptoPrice || cryptoPrice <= 0) {
    throw new Error('Invalid crypto price');
  }

  // Use Decimal.js for precise conversion
  return convertUsdToCryptoDecimal(usdAmount, cryptoPrice);
}

/**
 * Round crypto amount to appropriate decimal places
 * Uses Decimal.js to avoid precision loss
 *
 * @param {number|string} amount - Crypto amount (unrounded)
 * @param {string} chain - Chain name
 * @returns {string} Rounded crypto amount (string to preserve precision)
 */
export function roundCryptoAmount(amount, chain) {
  const decimals = CRYPTO_DECIMALS[chain] || 8; // Default to 8 decimals
  return roundCryptoAmountDecimal(amount, decimals);
}

/**
 * Get USD → Crypto conversion with proper rounding (convenience method)
 * Returns string amounts to preserve precision
 *
 * @param {number} usdAmount - Amount in USD
 * @param {string} chain - Chain name
 * @returns {Promise<object>} { cryptoAmount (string), usdRate (number) }
 */
export async function convertAndRound(usdAmount, chain) {
  const cryptoPrice = await getCryptoPrice(chain);
  const cryptoAmount = convertUsdToCrypto(usdAmount, cryptoPrice);
  // cryptoAmount is already rounded by convertUsdToCrypto (8 decimals)

  return {
    cryptoAmount, // String to preserve precision
    usdRate: cryptoPrice,
  };
}

export default {
  getCryptoPrice,
  convertUsdToCrypto,
  roundCryptoAmount,
  convertAndRound,
};
