import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { aiProductController } from '../controllers/aiProductController.js';
import { aiRequestLimiter } from '../middleware/rateLimiter.js';
import { aiValidation } from '../middleware/validation.js';

const router = express.Router();

/**
 * @route   POST /api/ai/products/chat
 * @desc    Chat with AI for product management
 * @access  Private (Shop owner only - verified in controller)
 * @security Rate limited to 10 req/hour, max 1000 chars per message
 */
router.post(
  '/products/chat',
  verifyToken,
  aiRequestLimiter,
  aiValidation.chat,
  aiProductController.chat
);

export default router;
