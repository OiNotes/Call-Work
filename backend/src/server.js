import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { initWebSocket } from './utils/websocket.js';
import { config } from './config/env.js';
import { testConnection, closePool } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import middleware
import {
  errorHandler,
  notFoundHandler,
  apiLimiter,
  requestLogger,
  sensitiveDataLogger
} from './middleware/index.js';
import { validateOrigin } from './middleware/csrfProtection.js';
import { requestIdMiddleware } from './middleware/requestId.js';

// Import logger
import logger from './utils/logger.js';

// Import routes
import authRoutes from './routes/auth.js';
import shopRoutes from './routes/shops.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import subscriptionRoutes from './routes/subscriptions.js';
import walletRoutes from './routes/wallets.js';
import followRoutes from './routes/follows.js';
import workerRoutes from './routes/workers.js';
import webhookRoutes from './routes/webhooks.js';
import internalRoutes from './routes/internal.js';
import aiRoutes from './routes/ai.js';

// Routes registration (will be added after middleware setup)

// Import cron jobs
import { startSyncCron, stopSyncCron } from './jobs/productSyncCron.js';
import { startSubscriptionJobs, stopSubscriptionJobs } from './jobs/subscriptionChecker.js';

// Import polling service for crypto payments
import pollingService from './services/pollingService.js';

// Import order cleanup service
import orderCleanupService from './services/orderCleanupService.js';

// Import invoice cleanup service
import { startInvoiceCleanup } from './services/invoiceCleanupService.js';

/**
 * ENV Validation - check critical crypto xpubs
 * Validates required environment variables before server startup
 * to catch configuration issues early (fail-fast approach)
 * 
 * Supports both naming schemes:
 * - New: BTC_XPUB, ETH_XPUB, LTC_XPUB
 * - Legacy: HD_XPUB_BTC, HD_XPUB_ETH, HD_XPUB_LTC
 */
function validateEnvironment() {
  const required = [
    { name: 'BTC', new: 'BTC_XPUB', legacy: 'HD_XPUB_BTC' },
    { name: 'ETH', new: 'ETH_XPUB', legacy: 'HD_XPUB_ETH' },
    { name: 'LTC', new: 'LTC_XPUB', legacy: 'HD_XPUB_LTC' },
    // USDT uses same as ETH (ERC20 and TRC20)
  ];

  const missing = [];
  const configured = [];
  
  for (const { name, new: newKey, legacy } of required) {
    const newValue = process.env[newKey];
    const legacyValue = process.env[legacy];
    
    // Check if at least one format is configured
    if ((!newValue || newValue === 'undefined') && (!legacyValue || legacyValue === 'undefined')) {
      missing.push({ name, newKey, legacy });
    } else {
      // Track which key is actually used
      const usedKey = newValue && newValue !== 'undefined' ? newKey : legacy;
      configured.push(usedKey);
    }
  }

  if (missing.length > 0) {
    logger.error('❌ CRITICAL: Missing required environment variables!');
    logger.error('');
    logger.error('Missing crypto xpubs:');
    missing.forEach(({ name, newKey, legacy }) => {
      logger.error(`  ${name}: ${newKey} or ${legacy}`);
    });
    logger.error('');
    logger.error('Please configure these variables in backend/.env:');
    missing.forEach(({ newKey, legacy }) => {
      logger.error(`  ${newKey}=xpub...   (or ${legacy}=xpub...)`);
    });
    logger.error('');
    logger.error('Example: Generate using HD wallet (BIP32/BIP44)');
    logger.error('Exiting...');
    
    process.exit(1);  // Stop server startup
  }

  logger.info('✓ Environment validation passed');
  logger.info(`✓ Crypto xpubs configured: ${configured.join(', ')}`);
}

// Call validation BEFORE starting server
validateEnvironment();

/**
 * Initialize Express app
 */
const app = express();

/**
 * Security middleware
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://telegram.org"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws://localhost:3000", "wss://localhost:3000", "http://localhost:3000", "https://*.ngrok-free.app"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameAncestors: ["'self'", "https://web.telegram.org", "https://*.telegram.org", "https://telegram.org"],
      formAction: ["'self'"], // Prevent forms from submitting to external domains (CSRF protection)
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow Telegram WebApp embed
  frameguard: false, // Disable X-Frame-Options to allow Telegram iframe
}));

/**
 * HTTPS enforcement in production
 */
if (config.nodeEnv === 'production' && process.env.HTTPS_ENABLED === 'true') {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      return next();
    }
    logger.info('HTTP → HTTPS redirect', { url: req.url, ip: req.ip });
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  });

  // Add HSTS header for HTTPS security
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  logger.info('HTTPS enforcement enabled');
}

/**
 * CORS configuration (API-6: Preflight cache added)
 */
app.use(cors({
  origin: config.frontendUrl,
  credentials: true, // Allow cookies and credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // API-6: Cache preflight requests for 24 hours (86400 seconds)
}));

/**
 * CSRF Protection
 * Validates Origin/Referer headers to prevent cross-site request forgery
 * Applied to all state-changing requests (POST, PUT, DELETE, PATCH)
 */
app.use(validateOrigin);

/**
 * Compression middleware (GZIP for all responses)
 * Reduces API response size by ~60-70% for JSON
 */
app.use(compression({
  filter: (req, res) => {
    // Compress all responses except already compressed formats
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses > 1KB
  level: 6 // Compression level (0-9, 6 is optimal balance)
}));

/**
 * Request logging
 */
if (config.nodeEnv === 'development') {
  app.use(sensitiveDataLogger);
} else {
  app.use(requestLogger);
}

/**
 * Rate limiting
 */
app.use('/api/', apiLimiter);

/**
 * Request ID middleware (API-2: X-Request-ID tracing)
 */
app.use(requestIdMiddleware);

/**
 * Body parser middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Serve static files from webapp/dist (for production-like testing with single ngrok tunnel)
 * This allows serving React app from backend when built with npm run build
 */
const webappDistPath = path.join(__dirname, '../../webapp/dist');
if (fs.existsSync(webappDistPath)) {
  logger.info('Serving webapp static files from:', { path: webappDistPath });
  app.use(express.static(webappDistPath));
} else {
  logger.warn('WebApp dist folder not found. Build webapp with: npm run build:webapp');
}

/**
 * Health check endpoint (API-3: Enhanced with database and memory checks)
 */
app.get('/health', async (req, res) => {
  const health = {
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  };

  // Check database connection
  try {
    const { testConnection } = await import('./config/database.js');
    await testConnection();
    health.database = 'Connected';
  } catch (error) {
    health.success = false;
    health.database = 'Disconnected';
    health.databaseError = error.message;
    return res.status(503).json(health);
  }

  res.status(200).json(health);
});

/**
 * API routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/shops', workerRoutes); // Worker management (mounted on /api/shops)
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/shop-follows', followRoutes);
app.use('/api/ai', aiRoutes);
app.use('/webhooks', webhookRoutes); // Crypto payment webhooks
app.use('/api/internal', internalRoutes); // Internal API for bot-backend communication

/**
 * Fallback for React Router: serve index.html for non-API routes
 * This allows client-side routing to work when webapp is served from backend
 */
app.get('*', (req, res, next) => {
  // Skip API routes, webhooks, and file requests (with extensions)
  if (req.path.startsWith('/api') ||
      req.path.startsWith('/webhooks') ||
      req.path.includes('.') ||
      req.path === '/health') {
    return next();
  }

  const indexPath = path.join(webappDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

/**
 * 404 handler
 */
app.use(notFoundHandler);

/**
 * Global error handler
 */
app.use(errorHandler);

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info('Server started successfully', {
        environment: config.nodeEnv,
        port: config.port,
        database: 'Connected'
      });

      console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Telegram Shop Backend Server                     ║
║                                                        ║
║   Environment: ${config.nodeEnv.padEnd(39)}║
║   Port:        ${config.port.toString().padEnd(39)}║
║   Database:    Connected ✓                            ║
║                                                        ║
║   API:         http://localhost:${config.port}/api              ║
║   Health:      http://localhost:${config.port}/health           ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);

      // Start product sync cron job
      startSyncCron();

      // Start subscription cron jobs
      startSubscriptionJobs();

      // Start polling service for ETH/TRON payments
      pollingService.startPolling();
      logger.info('Payment polling service started');

      // Start order cleanup service
      orderCleanupService.startOrderCleanup();
      logger.info('Order cleanup service started');

      // Start invoice cleanup service (cleanup expired invoices every hour)
      startInvoiceCleanup();
      logger.info('Invoice cleanup service started');
    });

    // Setup WebSocket server for real-time updates
    const wss = new WebSocketServer({ server });

    // Initialize WebSocket module for use in controllers
    initWebSocket(wss);

    wss.on('connection', (ws, req) => {
      logger.info('WebSocket client connected', {
        ip: req.socket.remoteAddress
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          logger.debug('WebSocket message received', { data });

          // Handle different message types
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch (error) {
          // API-9: Enhanced error handling for WebSocket messages
          logger.error('WebSocket message error', {
            error: error.message,
            stack: error.stack,
            rawMessage: message?.toString().substring(0, 100) // Log first 100 chars
          });

          // Send error response to client
          try {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Invalid message format',
              timestamp: Date.now()
            }));
          } catch (sendError) {
            logger.error('Failed to send error response', { error: sendError.message });
          }
        }
      });

      ws.on('close', (code, reason) => {
        logger.info('WebSocket client disconnected', {
          code,
          reason: reason?.toString() || 'No reason provided'
        });
      });

      ws.on('error', (error) => {
        // API-9: Enhanced WebSocket error logging
        logger.error('WebSocket error', {
          error: error.message,
          stack: error.stack,
          code: error.code,
          errno: error.errno
        });
      });

      // Send welcome message with error handling
      try {
        ws.send(JSON.stringify({
          type: 'connected',
          message: 'Connected to Telegram Shop WebSocket',
          timestamp: Date.now()
        }));
      } catch (error) {
        logger.error('Failed to send welcome message', {
          error: error.message
        });
      }
    });

    // API-9: Global WebSocket server error handler
    wss.on('error', (error) => {
      logger.error('WebSocket server error', {
        error: error.message,
        stack: error.stack
      });
    });

    // Broadcast function for real-time updates
    global.broadcastUpdate = (data) => {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify(data));
        }
      });
    };

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      // Stop subscription cron jobs
      stopSubscriptionJobs();

      // Stop polling service
      pollingService.stopPolling();
      logger.info('Payment polling service stopped');

      // Stop Telegram bot
      if (global.botInstance) {
        try {
          await global.botInstance.stop();
          logger.info('Telegram bot stopped');
        } catch (error) {
          logger.error('Error stopping bot:', error);
        }
      }

      // Stop product sync cron job
      stopSyncCron();

      server.close(async () => {
        logger.info('HTTP server closed');

        // Close WebSocket connections
        wss.clients.forEach((client) => {
          client.close();
        });
        wss.close(() => {
          logger.info('WebSocket server closed');
        });

        // Close database pool
        await closePool();

        logger.info('Shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Start the server (but not in test environment)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
