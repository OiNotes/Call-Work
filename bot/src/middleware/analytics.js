import logger from '../utils/logger.js';

/**
 * P1-BOT-012: Analytics Tracking Middleware
 *
 * Tracks:
 * - Command usage (frequency, users)
 * - Error rates (by handler)
 * - User flow (scenes entered/left)
 * - Response times
 *
 * Usage:
 *   bot.use(analyticsMiddleware)
 */

// In-memory analytics storage
const analytics = {
  commands: new Map(), // command -> { count, users: Set }
  scenes: new Map(), // scene -> { entered: count, left: count }
  errors: new Map(), // handler -> error count
  responseTimes: [] // [{ handler, duration }]
};

/**
 * Get analytics summary
 */
export const getAnalyticsSummary = () => {
  const commandStats = [];
  for (const [command, data] of analytics.commands.entries()) {
    commandStats.push({
      command,
      count: data.count,
      uniqueUsers: data.users.size
    });
  }

  const sceneStats = [];
  for (const [scene, data] of analytics.scenes.entries()) {
    sceneStats.push({
      scene,
      entered: data.entered,
      left: data.left,
      activeNow: data.entered - data.left
    });
  }

  const errorStats = [];
  for (const [handler, count] of analytics.errors.entries()) {
    errorStats.push({ handler, errorCount: count });
  }

  // Calculate average response times (last 100 requests)
  const recentResponseTimes = analytics.responseTimes.slice(-100);
  const avgResponseTime = recentResponseTimes.length > 0
    ? recentResponseTimes.reduce((sum, r) => sum + r.duration, 0) / recentResponseTimes.length
    : 0;

  return {
    commands: commandStats.sort((a, b) => b.count - a.count),
    scenes: sceneStats,
    errors: errorStats.sort((a, b) => b.errorCount - a.errorCount),
    performance: {
      avgResponseTime: Math.round(avgResponseTime),
      requestsTracked: recentResponseTimes.length
    }
  };
};

/**
 * Track command usage
 */
const trackCommand = (ctx) => {
  const command = ctx.message?.text?.split(' ')[0];
  if (!command || !command.startsWith('/')) {
    return;
  }

  const userId = ctx.from.id;

  if (!analytics.commands.has(command)) {
    analytics.commands.set(command, { count: 0, users: new Set() });
  }

  const commandData = analytics.commands.get(command);
  commandData.count++;
  commandData.users.add(userId);
};

/**
 * Track scene transitions
 */
export const trackSceneEnter = (sceneName) => {
  if (!analytics.scenes.has(sceneName)) {
    analytics.scenes.set(sceneName, { entered: 0, left: 0 });
  }
  analytics.scenes.get(sceneName).entered++;
};

export const trackSceneLeave = (sceneName) => {
  if (!analytics.scenes.has(sceneName)) {
    analytics.scenes.set(sceneName, { entered: 0, left: 0 });
  }
  analytics.scenes.get(sceneName).left++;
};

/**
 * Track error
 */
export const trackError = (handler, error) => {
  const handlerName = handler || 'unknown';
  const currentCount = analytics.errors.get(handlerName) || 0;
  analytics.errors.set(handlerName, currentCount + 1);

  logger.error(`[Analytics] Error in ${handlerName}:`, {
    error: error.message,
    totalErrorsInHandler: currentCount + 1
  });
};

/**
 * Analytics middleware
 */
export const analyticsMiddleware = async (ctx, next) => {
  const startTime = Date.now();

  // Track command if present
  if (ctx.message?.text) {
    trackCommand(ctx);
  }

  try {
    await next();

    // Track response time
    const duration = Date.now() - startTime;
    analytics.responseTimes.push({
      handler: ctx.updateType,
      duration
    });

    // Keep only last 1000 response times
    if (analytics.responseTimes.length > 1000) {
      analytics.responseTimes.shift();
    }

  } catch (error) {
    // Track error
    trackError(ctx.updateType, error);
    throw error; // Re-throw for error middleware
  }
};

export default analyticsMiddleware;
