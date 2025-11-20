import { URL } from 'url';

/**
 * Private IP ranges to block (SSRF protection)
 */
const PRIVATE_IP_RANGES = [
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^127\./, // 127.0.0.0/8 (localhost)
  /^169\.254\./, // 169.254.0.0/16 (link-local)
  /^::1$/, // IPv6 localhost
  /^fe80:/, // IPv6 link-local
  /^fc00:/, // IPv6 private
];

/**
 * Validates URL to prevent SSRF attacks
 * @param {string} urlString - URL to validate
 * @returns {boolean} - True if URL is safe (public http/https), false otherwise
 */
export const isValidPublicUrl = (urlString) => {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // Check if hostname is private IP
    const hostname = url.hostname;

    // Check localhost
    if (hostname === 'localhost' || hostname === '0.0.0.0') {
      return false;
    }

    // Check private IP ranges
    for (const range of PRIVATE_IP_RANGES) {
      if (range.test(hostname)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

export default { isValidPublicUrl };
