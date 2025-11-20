import { memo } from 'react';
import { motion } from 'framer-motion';

/**
 * Ярлык скидки для карточки товара
 *
 * @returns {JSX.Element}
 *
 * Стиль: Ribbon badge в верхнем правом углу
 * Цвет: Ярко-красный (#FF4757) с градиентом
 * Анимация: Subtle пульсация для привлечения внимания
 */
const DiscountBadge = memo(function DiscountBadge() {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
        delay: 0.1,
      }}
      className="absolute top-2 right-2 z-10"
    >
      <motion.div
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="px-3 py-1.5 rounded-full font-bold text-white shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #FF4757 0%, #FF6B35 100%)',
          boxShadow: `
            0 4px 12px rgba(255, 71, 87, 0.4),
            0 2px 6px rgba(255, 71, 87, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.3)
          `,
          letterSpacing: '0.02em',
        }}
        aria-label="Скидка"
      >
        <span className="text-xs font-bold">SALE</span>
      </motion.div>
    </motion.div>
  );
});

export default DiscountBadge;
