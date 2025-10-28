import logger from './logger.js';

/**
 * Get WebApp URL from environment with validation
 * @returns {string} WebApp URL
 * @throws {Error} if URL is invalid or missing
 */
export function getWebAppUrl() {
  const url = process.env.WEBAPP_URL;

  if (!url) {
    throw new Error('WEBAPP_URL is not configured in environment');
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid WEBAPP_URL format: ${url}`);
  }

  // Telegram WebApps require HTTPS (skip check in development)
  if (process.env.NODE_ENV !== 'development' && !url.startsWith('https://')) {
    throw new Error(`WEBAPP_URL must use HTTPS: ${url}`);
  }

  return url;
}

/**
 * Log WebApp configuration at startup
 */
export function logWebAppConfig() {
  try {
    const url = getWebAppUrl();
    logger.info('WebApp URL configured', { url });
    logger.info('BotFather Menu Button should be set to:', { url });
    logger.info('If URL changed, update in BotFather: /setmenubutton');
  } catch (error) {
    logger.error('WebApp URL configuration error', { error: error.message });
    throw error;
  }
}
