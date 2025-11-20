import { handleProductAI, resolveUserShop } from '../services/aiProductService.js';
import logger from '../utils/logger.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';

export const aiProductController = {
  async chat(req, res) {
    try {
      const { message, history = [], shopId } = req.body || {};

      if (!message || typeof message !== 'string') {
        throw new ValidationError('Введите сообщение для AI.');
      }

      const shop = await resolveUserShop(req.user.id, shopId);
      if (!shop) {
        throw new UnauthorizedError('Магазин не найден или доступ запрещён.');
      }

      const result = await handleProductAI({
        shop,
        message,
        history,
      });

      return res.status(200).json({
        success: true,
        data: {
          reply: result.reply,
          history: result.history,
          operations: result.operations,
          productsChanged: result.productsChanged,
        },
      });
    } catch (error) {
      logger.error('AI chat error:', {
        error: error.message,
        stack: error.stack,
      });
      return res.status(500).json({
        success: false,
        error: error.message || 'Не удалось обработать запрос AI.',
      });
    }
  },
};

export default aiProductController;
