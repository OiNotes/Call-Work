import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { ethers } from 'ethers';
import TronWeb from 'tronweb';
import logger from '../utils/logger.js';
import validate from 'wallet-validator';

// Initialize BIP32 with secp256k1
const bip32 = BIP32Factory(ecc);

/**
 * Wallet Service - HD wallet address generation for all supported chains
 *
 * Supports:
 * - Bitcoin (BTC) - BIP44: m/44'/0'/0'/0/{index}
 * - Litecoin (LTC) - BIP44: m/44'/2'/0'/0/{index}
 * - Ethereum (ETH) - BIP44: m/44'/60'/0'/0/{index}
 * - Tron (TRON) - BIP44: m/44'/195'/0'/0/{index}
 *
 * All methods return: { address: string, derivationPath: string }
 */

/**
 * Validate xpub format
 * @param {string} xpub - Extended public key
 * @param {string} chain - Chain name for logging
 * @returns {boolean} True if valid
 */
function validateXpub(xpub, chain) {
  if (!xpub || typeof xpub !== 'string') {
    logger.error(`[WalletService] Invalid xpub for ${chain}: empty or not a string`);
    return false;
  }

  // xpub/ypub/zpub for Bitcoin, Ltub for Litecoin
  const validPrefixes = ['xpub', 'ypub', 'zpub', 'Ltub', 'tpub'];
  const hasValidPrefix = validPrefixes.some((prefix) => xpub.startsWith(prefix));

  if (!hasValidPrefix) {
    logger.error(`[WalletService] Invalid xpub prefix for ${chain}: ${xpub.substring(0, 4)}`);
    return false;
  }

  return true;
}

/**
 * Generate Bitcoin address from xpub
 * @param {string} xpub - Extended public key (BIP44)
 * @param {number} index - Derivation index (0 to 2^31-1)
 * @returns {Promise<object>} { address: string, derivationPath: string }
 */
export async function generateBtcAddress(xpub, index) {
  try {
    // Validate inputs
    if (!validateXpub(xpub, 'BTC')) {
      throw new Error('Invalid Bitcoin xpub');
    }

    if (!Number.isInteger(index) || index < 0 || index >= Math.pow(2, 31)) {
      throw new Error(`Invalid derivation index: ${index}. Must be 0 to 2^31-1`);
    }

    // Parse xpub
    const node = bip32.fromBase58(xpub, bitcoin.networks.bitcoin);

    // Derive child address: m/0/{index} (external chain)
    const child = node.derive(0).derive(index);

    // Generate P2PKH address (legacy)
    const { address } = bitcoin.payments.p2pkh({
      pubkey: child.publicKey,
      network: bitcoin.networks.bitcoin,
    });

    const derivationPath = `m/44'/0'/0'/0/${index}`;

    logger.info(`[WalletService] Generated BTC address at ${derivationPath}: ${address}`);

    return {
      address,
      derivationPath,
    };
  } catch (error) {
    logger.error('[WalletService] BTC address generation failed:', {
      error: error.message,
      index,
    });
    throw new Error(`Failed to generate BTC address: ${error.message}`);
  }
}

/**
 * Generate Litecoin address from xpub
 * @param {string} xpub - Extended public key (BIP44)
 * @param {number} index - Derivation index (0 to 2^31-1)
 * @returns {Promise<object>} { address: string, derivationPath: string }
 */
export async function generateLtcAddress(xpub, index) {
  try {
    // Validate inputs
    if (!validateXpub(xpub, 'LTC')) {
      throw new Error('Invalid Litecoin xpub');
    }

    if (!Number.isInteger(index) || index < 0 || index >= Math.pow(2, 31)) {
      throw new Error(`Invalid derivation index: ${index}. Must be 0 to 2^31-1`);
    }

    // Litecoin network parameters
    const litecoinNetwork = {
      messagePrefix: '\x19Litecoin Signed Message:\n',
      bech32: 'ltc',
      bip32: {
        public: 0x019da462, // Ltub
        private: 0x019d9cfe,
      },
      pubKeyHash: 0x30, // L address prefix
      scriptHash: 0x32,
      wif: 0xb0,
    };

    // Parse xpub - support both Bitcoin xpub and Litecoin Ltub
    let node;
    if (xpub.startsWith('xpub') || xpub.startsWith('tpub')) {
      // Bitcoin xpub provided - parse with Bitcoin network first, then use pubkey for Litecoin
      node = bip32.fromBase58(xpub, bitcoin.networks.bitcoin);
    } else if (xpub.startsWith('Ltub')) {
      // Native Litecoin xpub
      node = bip32.fromBase58(xpub, litecoinNetwork);
    } else {
      throw new Error(`Unsupported xpub format: ${xpub.substring(0, 4)}`);
    }

    // Derive child address: m/0/{index} (external chain)
    const child = node.derive(0).derive(index);

    // Generate P2PKH address with Litecoin network parameters
    const { address } = bitcoin.payments.p2pkh({
      pubkey: child.publicKey,
      network: litecoinNetwork,
    });

    const derivationPath = `m/44'/2'/0'/0/${index}`;

    logger.info(`[WalletService] Generated LTC address at ${derivationPath}: ${address}`);

    return {
      address,
      derivationPath,
    };
  } catch (error) {
    logger.error('[WalletService] LTC address generation failed:', {
      error: error.message,
      index,
    });
    throw new Error(`Failed to generate LTC address: ${error.message}`);
  }
}

/**
 * Generate Ethereum address from xpub
 * @param {string} xpub - Extended public key (BIP44)
 * @param {number} index - Derivation index (0 to 2^31-1)
 * @returns {Promise<object>} { address: string, derivationPath: string }
 */
export async function generateEthAddress(xpub, index) {
  logger.debug('[WalletService] generateEthAddress START', {
    xpubExists: !!xpub,
    xpubLength: xpub?.length,
    index,
    xpubPreview: xpub ? xpub.substring(0, 20) + '...' : 'undefined',
  });

  try {
    // Validate inputs
    if (!validateXpub(xpub, 'ETH')) {
      logger.error('[WalletService] Invalid xpub for ETH', {
        xpub: xpub?.substring(0, 30),
        validation: 'failed',
      });
      throw new Error('Invalid Ethereum xpub');
    }

    if (!Number.isInteger(index) || index < 0 || index >= Math.pow(2, 31)) {
      logger.error('[WalletService] Invalid index for ETH', { index });
      throw new Error(`Invalid derivation index: ${index}. Must be 0 to 2^31-1`);
    }

    logger.debug('[WalletService] ETH validation passed, deriving address');

    // ETH uses standard BIP32 derivation
    logger.debug('[WalletService] Parsing ETH xpub');
    const node = bip32.fromBase58(xpub);
    logger.debug('[WalletService] ETH xpub parsed successfully');

    // Derive child: m/0/{index} (external chain)
    logger.debug('[WalletService] Deriving ETH child', { index });
    const child = node.derive(0).derive(index);
    logger.debug('[WalletService] ETH child derived');

    // Create Ethereum address from public key
    // BIP32 returns compressed public key (33 bytes), need to pass as hex string with '0x' prefix for ethers
    const publicKey = child.publicKey;

    if (!publicKey) {
      logger.error('[WalletService] Failed to derive public key for ETH');
      throw new Error('Failed to derive public key from xpub');
    }

    logger.debug('[WalletService] ETH public key extracted', { length: publicKey.length });

    // Convert Buffer to hex string with '0x' prefix for ethers
    const publicKeyHex = '0x' + publicKey.toString('hex');
    logger.debug('[WalletService] ETH public key hex', {
      preview: publicKeyHex.substring(0, 20) + '...',
    });

    // Compute Ethereum address using ethers (accepts compressed or uncompressed)
    logger.debug('[WalletService] Computing Ethereum address');
    const address = ethers.computeAddress(publicKeyHex);

    const derivationPath = `m/44'/60'/0'/0/${index}`;

    logger.info(`[WalletService] Generated ETH address at ${derivationPath}: ${address}`);

    return {
      address,
      derivationPath,
    };
  } catch (error) {
    logger.error('[WalletService] ETH address generation failed:', {
      error: error.message,
      stack: error.stack,
      index,
    });
    throw new Error(`Failed to generate ETH address: ${error.message}`);
  }
}

/**
 * Generate Tron address from xpub
 * @param {string} xpub - Extended public key (BIP44)
 * @param {number} index - Derivation index (0 to 2^31-1)
 * @returns {Promise<object>} { address: string, derivationPath: string }
 */
export async function generateTronAddress(xpub, index) {
  try {
    // Validate inputs
    if (!validateXpub(xpub, 'TRON')) {
      throw new Error('Invalid Tron xpub');
    }

    if (!Number.isInteger(index) || index < 0 || index >= Math.pow(2, 31)) {
      throw new Error(`Invalid derivation index: ${index}. Must be 0 to 2^31-1`);
    }

    // Parse xpub using BIP32
    const node = bip32.fromBase58(xpub);

    // Derive child: m/0/{index} (external chain)
    const child = node.derive(0).derive(index);

    // Get compressed public key from BIP32
    const compressedPublicKey = child.publicKey;

    // Initialize TronWeb
    const tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io',
    });

    // Convert compressed public key to uncompressed format
    // BIP32 returns compressed (33 bytes), but we need uncompressed (65 bytes) for Tron
    // Use ethers to decompress the public key
    const uncompressedPublicKey = ethers.SigningKey.computePublicKey(compressedPublicKey, false);

    // Remove '0x04' prefix to get raw 64 bytes
    const publicKeyHex = uncompressedPublicKey.substring(4);

    // Compute Keccak256 hash of public key (TronWeb uses ethers internally)
    const hash = ethers.keccak256('0x' + publicKeyHex);

    // Take last 20 bytes (40 hex chars) of the hash
    const addressBytes = hash.substring(hash.length - 40);

    // Add Tron mainnet prefix (0x41) and convert to Base58Check
    const hexAddress = '41' + addressBytes;
    const address = tronWeb.address.fromHex(hexAddress);

    const derivationPath = `m/44'/195'/0'/0/${index}`;

    logger.info(`[WalletService] Generated TRON address at ${derivationPath}: ${address}`);

    return {
      address,
      derivationPath,
    };
  } catch (error) {
    logger.error('[WalletService] TRON address generation failed:', {
      error: error.message,
      index,
    });
    throw new Error(`Failed to generate TRON address: ${error.message}`);
  }
}

/**
 * Generate address for any supported chain
 * @param {string} chain - Chain identifier (BTC, LTC, ETH, TRON)
 * @param {string} xpub - Extended public key
 * @param {number} index - Derivation index
 * @returns {Promise<object>} { address: string, derivationPath: string }
 */
export async function generateAddress(chain, xpub, index) {
  const chainUpper = chain.toUpperCase();

  switch (chainUpper) {
    case 'BTC':
    case 'BITCOIN':
      return generateBtcAddress(xpub, index);

    case 'LTC':
    case 'LITECOIN':
      return generateLtcAddress(xpub, index);

    case 'ETH':
    case 'ETHEREUM':
      return generateEthAddress(xpub, index);

    case 'TRON':
    case 'TRX':
      return generateTronAddress(xpub, index);

    default:
      throw new Error(`Unsupported chain: ${chain}. Supported: BTC, LTC, ETH, TRON`);
  }
}

/**
 * Validate address format for chain
 * @param {string} address - Address to validate
 * @param {string} chain - Chain identifier
 * @returns {boolean} True if valid
 */
export function validateAddress(address, chain) {
  try {
    const chainUpper = chain.toUpperCase();

    switch (chainUpper) {
      case 'BTC':
      case 'BITCOIN':
        return validate.validate(address, 'BTC');

      case 'LTC':
      case 'LITECOIN':
        return validate.validate(address, 'LTC');

      case 'ETH':
      case 'ETHEREUM':
        return validate.validate(address, 'ETH');

      case 'TRON':
      case 'TRX':
        // Tron addresses start with T and are 34 characters
        return address.startsWith('T') && address.length === 34;

      default:
        logger.warn(`[WalletService] Unknown chain for validation: ${chain}`);
        return false;
    }
  } catch (error) {
    logger.error('[WalletService] Address validation error:', {
      error: error.message,
      address,
      chain,
    });
    return false;
  }
}

export default {
  generateBtcAddress,
  generateLtcAddress,
  generateEthAddress,
  generateTronAddress,
  generateAddress,
  validateAddress,
};
