import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { aiProductController } from '../controllers/aiProductController.js';

const router = express.Router();

router.post('/products/chat', verifyToken, aiProductController.chat);

export default router;
