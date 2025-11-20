import logger from '../utils/logger.js';
import { SUPPORTED_CURRENCIES } from '../utils/constants.js';
import { amountsMatchWithTolerance } from '../utils/paymentTolerance.js';
import * as blockCypherService from './blockCypherService.js';
import * as etherscanService from './etherscanService.js';
import * as tronService from './tronService.js';

const MIN_HASH_LENGTH = 46; // excludes most addresses and keeps only tx-sized values
const HEX_HASH_REGEX = /[A-Fa-f0-9]{64,}/;
const GENERIC_HASH_REGEX = /([A-Za-z0-9]{46,})/;

function normalizeCurrency(currency) {
  const upper = (currency || '').toUpperCase();
  if (upper === 'USDT_TRC20') return 'USDT';
  return upper;
}

function normalizeChain(currency, chainHint) {
  const hint = (chainHint || '').toUpperCase();
  if (hint.startsWith('BTC')) return 'BTC';
  if (hint.startsWith('LTC')) return 'LTC';
  if (hint.startsWith('ETH')) return 'ETH';
  if (hint.includes('TRON') || hint.includes('TRC')) return 'TRON';

  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency === 'USDT') return 'TRON';
  return normalizedCurrency || 'BTC';
}

export function extractTxHash(input) {
  if (!input) return null;
  const value = String(input).trim();

  // Explorer URLs contain /tx/ or /transaction/
  const urlMatch = value.match(/(?:tx|transaction)[/|=]([A-Za-z0-9]+)/i);
  if (urlMatch && urlMatch[1] && urlMatch[1].length >= MIN_HASH_LENGTH) {
    return urlMatch[1];
  }

  // Generic hash search (hex or base58-ish)
  const hexCandidate = value.match(HEX_HASH_REGEX);
  if (hexCandidate && hexCandidate[0].length >= MIN_HASH_LENGTH) {
    return hexCandidate[0];
  }

  const generic = value.match(GENERIC_HASH_REGEX);
  if (generic && generic[1].length >= MIN_HASH_LENGTH) {
    return generic[1];
  }

  // If user already sent raw hash without url separators
  if (value.length >= MIN_HASH_LENGTH) {
    return value;
  }

  return null;
}

async function verifyByTxHash({ txHash, chain, address, amount, currency }) {
  try {
    switch (chain) {
      case 'BTC':
      case 'LTC':
        return await blockCypherService.verifyPayment(chain, txHash, address, amount);
      case 'ETH':
        if (currency === 'ETH') {
          return await etherscanService.verifyEthPayment(txHash, address, amount);
        }
        return await etherscanService.verifyUsdtPayment(txHash, address, amount);
      case 'TRON':
        return await tronService.verifyPayment(txHash, address, amount);
      default:
        return {
          verified: false,
          error: `Unsupported chain: ${chain}`,
        };
    }
  } catch (error) {
    logger.error('[PaymentVerification] verifyByTxHash failed', {
      error: error.message,
      chain,
      txHash,
    });
    return {
      verified: false,
      error: error.message,
    };
  }
}

async function findTxByAddress({ chain, address, amount, currency }) {
  if (!address) return null;

  try {
    if (chain === 'BTC' || chain === 'LTC') {
      const addressInfo = await blockCypherService.getAddressInfo(chain, address);
      const refs = [
        ...(Array.isArray(addressInfo?.txrefs) ? addressInfo.txrefs : []),
        ...(Array.isArray(addressInfo?.unconfirmed_txrefs)
          ? addressInfo.unconfirmed_txrefs
          : []),
      ];

      const match = refs.find((tx) => {
        const cryptoAmount = tx.value / 1e8;
        return amountsMatchWithTolerance(cryptoAmount, amount, undefined, chain);
      });

      if (match) {
        return {
          txHash: match.tx_hash,
          amount: match.value / 1e8,
          confirmations: match.confirmations || 0,
          status:
            (match.confirmations || 0) >= SUPPORTED_CURRENCIES[chain].confirmations
              ? 'confirmed'
              : 'pending',
          source: 'address_scan',
        };
      }
    } else if (chain === 'ETH') {
      if (currency === 'ETH') {
        const txs = await etherscanService.getAddressTransactions(address);
        const match = txs.find((tx) => {
          if (!tx.to || tx.isError) return false;
          if (tx.to.toLowerCase() !== address.toLowerCase()) return false;
          const ethAmount = parseInt(tx.value, 10) / 1e18;
          return amountsMatchWithTolerance(ethAmount, amount, undefined, 'ETH');
        });

        if (match) {
          return {
            txHash: match.hash,
            amount: parseInt(match.value, 10) / 1e18,
            confirmations: match.confirmations || 0,
            status:
              (match.confirmations || 0) >= SUPPORTED_CURRENCIES.ETH.confirmations
                ? 'confirmed'
                : 'pending',
            source: 'address_scan',
          };
        }
      } else {
        const transfers = await etherscanService.getTokenTransfers(address);
        const match = transfers.find((tx) => {
          const tokenAmount = parseInt(tx.value, 10) / 1e6;
          return (
            tx.to?.toLowerCase() === address.toLowerCase() &&
            amountsMatchWithTolerance(tokenAmount, amount, undefined, 'USDT')
          );
        });

        if (match) {
          return {
            txHash: match.hash,
            amount: parseInt(match.value, 10) / 1e6,
            confirmations: match.confirmations || 0,
            status:
              (match.confirmations || 0) >= SUPPORTED_CURRENCIES.ETH.confirmations
                ? 'confirmed'
                : 'pending',
            source: 'address_scan',
          };
        }
      }
    } else if (chain === 'TRON') {
      const transfers = await tronService.getTrc20Transfers(address);
      const match = transfers.find((tx) => {
        const decimals = tx.tokenInfo?.decimals || 6;
        const tokenAmount = parseFloat(tx.value) / Math.pow(10, decimals);
        return (
          tx.to === address &&
          amountsMatchWithTolerance(tokenAmount, amount, undefined, 'USDT')
        );
      });

      if (match) {
        return {
          txHash: match.transactionId,
          amount: parseFloat(match.value) / Math.pow(10, match.tokenInfo?.decimals || 6),
          confirmations: 0,
          status: 'pending',
          source: 'address_scan',
        };
      }
    }
  } catch (error) {
    logger.error('[PaymentVerification] findTxByAddress failed', {
      error: error.message,
      chain,
      address,
    });
  }

  return null;
}

function ensureAmount(amount) {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(numeric) || numeric <= 0) {
    throw new Error('Expected amount is required for payment verification');
  }
  return numeric;
}

export async function verifyIncomingPayment({
  txHash,
  paymentLink,
  address,
  amount,
  currency,
  chain,
}) {
  const expectedAmount = ensureAmount(amount);
  const normalizedCurrency = normalizeCurrency(currency);
  const resolvedChain = normalizeChain(normalizedCurrency, chain);
  const hashFromPayload = extractTxHash(paymentLink || txHash);

  logger.info('[PaymentVerification] Starting verification', {
    chain: resolvedChain,
    currency: normalizedCurrency,
    addressPreview: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,
    hasHash: !!hashFromPayload,
    source: paymentLink ? 'link' : 'hash',
  });

  let verificationResult = null;
  let detectedBy = 'tx_hash';

  if (hashFromPayload) {
    verificationResult = await verifyByTxHash({
      txHash: hashFromPayload,
      chain: resolvedChain,
      address,
      amount: expectedAmount,
      currency: normalizedCurrency,
    });
  }

  if ((!verificationResult || !verificationResult.verified) && address) {
    detectedBy = 'address_scan';
    const discoveredTx = await findTxByAddress({
      chain: resolvedChain,
      address,
      amount: expectedAmount,
      currency: normalizedCurrency,
    });

    if (discoveredTx?.txHash) {
      verificationResult = await verifyByTxHash({
        txHash: discoveredTx.txHash,
        chain: resolvedChain,
        address,
        amount: expectedAmount,
        currency: normalizedCurrency,
      });

      // Preserve amount/confirmations from discovery if verifier does not return them
      if (verificationResult?.verified) {
        verificationResult.amount = verificationResult.amount ?? discoveredTx.amount;
        verificationResult.confirmations =
          verificationResult.confirmations ?? discoveredTx.confirmations ?? 0;
        verificationResult.status = verificationResult.status ?? discoveredTx.status;
        verificationResult.txHash = verificationResult.txHash ?? discoveredTx.txHash;
      }
    }
  }

  if (!verificationResult || !verificationResult.verified) {
    const failureReason = verificationResult?.error || 'Transaction not located or not confirmed';
    logger.warn('[PaymentVerification] Verification failed', {
      error: failureReason,
      chain: resolvedChain,
      currency: normalizedCurrency,
    });

    return {
      verified: false,
      error: failureReason,
      code: 'PAYMENT_NOT_VERIFIED',
    };
  }

  const receivedAmount = verificationResult.amount ?? expectedAmount;
  if (!amountsMatchWithTolerance(receivedAmount, expectedAmount, undefined, normalizedCurrency)) {
    return {
      verified: false,
      error: `Amount mismatch. Expected ${expectedAmount}, received ${receivedAmount}`,
      code: 'AMOUNT_MISMATCH',
    };
  }

  const minConfirm = SUPPORTED_CURRENCIES[normalizedCurrency]?.confirmations || 0;
  const confirmations = verificationResult.confirmations ?? 0;
  const status =
    verificationResult.status || (confirmations >= minConfirm ? 'confirmed' : 'pending');

  return {
    verified: true,
    txHash: verificationResult.txHash || hashFromPayload,
    amount: receivedAmount,
    confirmations,
    status,
    detectedBy,
  };
}

export default {
  verifyIncomingPayment,
  extractTxHash,
};
