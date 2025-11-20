import { getAnalyticsSummary } from '../middleware/analytics.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * P1-BOT-015: Health Check Command
 *
 * Features:
 * - Bot status (uptime, memory usage)
 * - Command usage stats
 * - Error rates
 * - Scene activity
 * - Admin-only access
 *
 * Usage:
 *   /health - Show bot health
 */

// Admin user IDs (from environment or config)
const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((id) => parseInt(id.trim(), 10))
  .filter((id) => !isNaN(id));

const BOT_START_TIME = Date.now();

/**
 * Format uptime
 */
const formatUptime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}д ${hours % 24}ч`;
  }
  if (hours > 0) {
    return `${hours}ч ${minutes % 60}м`;
  }
  if (minutes > 0) {
    return `${minutes}м ${seconds % 60}с`;
  }
  return `${seconds}с`;
};

/**
 * Format memory usage
 */
const formatMemory = (bytes) => {
  const mb = Math.round(bytes / 1024 / 1024);
  return `${mb} MB`;
};

/**
 * Handle /health command
 */
export const handleHealthCommand = async (ctx) => {
  try {
    const userId = ctx.from.id;

    // Check if user is admin
    if (ADMIN_IDS.length === 0 || !ADMIN_IDS.includes(userId)) {
      await ctx.reply('⛔ Эта команда доступна только администраторам.');
      logger.warn('Unauthorized /health command attempt', { userId });
      return;
    }

    logger.info('Admin health check', { userId, username: ctx.from.username });

    // Get system info
    const uptime = Date.now() - BOT_START_TIME;
    const memUsage = process.memoryUsage();

    // Get analytics
    const analytics = getAnalyticsSummary();

    // Build health report
    const lines = [];

    lines.push('🏥 BOT HEALTH CHECK\n');

    // System info
    lines.push('📊 Система:');
    lines.push(`Uptime: ${formatUptime(uptime)}`);
    lines.push(`Memory: ${formatMemory(memUsage.heapUsed)} / ${formatMemory(memUsage.heapTotal)}`);
    lines.push(`Node.js: ${process.version}`);
    lines.push('');

    // Commands
    lines.push('💬 Команды (топ-5):');
    analytics.commands.slice(0, 5).forEach((cmd) => {
      lines.push(`${cmd.command}: ${cmd.count} раз, ${cmd.uniqueUsers} польз.`);
    });
    if (analytics.commands.length === 0) {
      lines.push('Нет данных');
    }
    lines.push('');

    // Scenes
    lines.push('🎭 Сцены:');
    analytics.scenes.forEach((scene) => {
      if (scene.activeNow > 0) {
        lines.push(`${scene.scene}: ${scene.activeNow} активных`);
      }
    });
    if (analytics.scenes.filter((s) => s.activeNow > 0).length === 0) {
      lines.push('Нет активных');
    }
    lines.push('');

    // Errors
    lines.push('❌ Ошибки (топ-3):');
    analytics.errors.slice(0, 3).forEach((err) => {
      lines.push(`${err.handler}: ${err.errorCount} ошибок`);
    });
    if (analytics.errors.length === 0) {
      lines.push('✅ Нет ошибок');
    }
    lines.push('');

    // Performance
    lines.push('⚡ Производительность:');
    lines.push(`Среднее время отклика: ${analytics.performance.avgResponseTime}ms`);
    lines.push(`Запросов отслежено: ${analytics.performance.requestsTracked}`);

    const healthReport = lines.join('\n');

    await ctx.reply(healthReport);
  } catch (error) {
    logger.error('Error in /health command:', error);
    await ctx.reply('❌ Ошибка при получении статуса бота.');
  }
};

export default handleHealthCommand;
