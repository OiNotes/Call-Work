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
    },
  },
  crossOriginEmbedderPolicy: false,
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
 * CORS configuration
 */
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data']
}));

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
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
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
          logger.error('WebSocket message error', {
            error: error.message
          });
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', {
          error: error.message
        });
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Telegram Shop WebSocket',
        timestamp: Date.now()
      }));
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
