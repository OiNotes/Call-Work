/**
 * Redis Session Middleware for Telegraf v4
 * 
 * Provides persistent session storage using Redis
 * Sessions are stored with 24h TTL
 */

import logger from '../utils/logger.js';

/**
 * Create Redis session middleware
 * @param {Redis} redis - ioredis instance
 * @returns {Function} Telegraf middleware
 */
export function createRedisSession(redis) {
  return async (ctx, next) => {
    // Generate session key based on chat ID
    const chatId = ctx.chat?.id || ctx.from?.id;
    if (!chatId) {
      logger.warn('No chat/user ID found, skipping session');
      return next();
    }

    const sessionKey = `session:${chatId}`;

    // Load session from Redis
    try {
      const data = await redis.get(sessionKey);
      ctx.session = data ? JSON.parse(data) : {};
    } catch (error) {
      logger.error(`Failed to load session for ${chatId}:`, error);
      ctx.session = {};
    }

    // Store original session for comparison
    const originalSession = JSON.stringify(ctx.session);

    // Execute handler
    await next();

    // Save session back to Redis if changed
    try {
      const newSession = JSON.stringify(ctx.session);
      
      if (newSession !== originalSession) {
        // Save with 24h TTL (86400 seconds)
        await redis.setex(sessionKey, 86400, newSession);
        
        logger.debug(`Session saved for ${chatId}`, {
          hasShopId: !!ctx.session?.shopId,
          hasToken: !!ctx.session?.token,
          role: ctx.session?.role
        });
      }
    } catch (error) {
      logger.error(`Failed to save session for ${chatId}:`, error);
    }
  };
}
