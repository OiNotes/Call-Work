import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackButton } from '../../hooks/useBackButton';

const MarkupSliderModal = ({ isOpen, onClose, onConfirm, currentMarkup = 25 }) => {
  const [markup, setMarkup] = useState(currentMarkup);
  const examplePrice = 100; // Пример цены для предпросмотра
  const calculatedPrice = (examplePrice * (1 + markup / 100)).toFixed(2);

  // BackButton integration
  useBackButton(isOpen ? onClose : null);

  useEffect(() => {
    if (isOpen) {
      setMarkup(currentMarkup);
    }
  }, [isOpen, currentMarkup]);

  const handleConfirm = () => {
    onConfirm(markup);
    onClose();
  };

  if (!isOpen) return null;

  // Spring animation preset
  const controlSpring = { type: 'spring', stiffness: 400, damping: 32 };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-elevated rounded-2xl p-6 w-full max-w-md border border-white/10"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={controlSpring}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6">
            <h3 className="text-white text-2xl font-bold tracking-tight mb-2">Настройка наценки</h3>
            <p className="text-gray-400 text-sm">
              Установите процент наценки для перепродажи товаров
            </p>
          </div>

          {/* Markup Value Display */}
          <div className="text-center mb-6">
            <div className="text-6xl font-bold text-orange-primary mb-1">{markup}%</div>
            <div className="text-gray-400 text-sm">Наценка</div>
          </div>

          {/* Slider */}
          <div className="mb-6">
            <div className="relative">
              {/* Track Background */}
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                {/* Active Track */}
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-primary to-orange-light"
                  style={{ width: `${((markup - 1) / 499) * 100}%` }}
                  initial={false}
                  animate={{ width: `${((markup - 1) / 499) * 100}%` }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                />
              </div>

              {/* Range Input */}
              <input
                type="range"
                min="1"
                max="500"
                step="1"
                value={markup}
                onChange={(e) => setMarkup(Number(e.target.value))}
                className="absolute inset-0 w-full h-12 opacity-0 cursor-pointer"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  zIndex: 10,
                }}
              />

              {/* Custom Thumb */}
              <motion.div
                className="absolute w-10 h-10 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing"
                style={{
                  left: `${((markup - 1) / 499) * 100}%`,
                  top: '50%',
                  transform: 'translateY(-50%) translateX(-50%)',
                  boxShadow: '0 0 0 4px rgba(255, 107, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.3)',
                }}
                initial={false}
                animate={{
                  left: `${((markup - 1) / 499) * 100}%`,
                  scale: 1,
                }}
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              />
            </div>

            {/* Min/Max Labels */}
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>1%</span>
              <span>500%</span>
            </div>
          </div>

          {/* Price Preview */}
          <div className="glass-card rounded-xl p-4 mb-6 border border-white/5">
            <div className="text-gray-400 text-xs mb-2">Пример расчёта:</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-400 text-sm">Цена поставщика</div>
                <div className="text-white text-lg font-semibold">${examplePrice}</div>
              </div>

              <motion.svg
                className="w-6 h-6 text-orange-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                initial={{ x: -5, opacity: 0.5 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </motion.svg>

              <div className="text-right">
                <div className="text-gray-400 text-sm">Ваша цена</div>
                <motion.div
                  className="text-orange-primary text-lg font-bold"
                  key={calculatedPrice}
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  ${calculatedPrice}
                </motion.div>
              </div>
            </div>
          </div>

          {/* Quick Select Buttons */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[10, 25, 50, 100].map((value) => (
              <motion.button
                key={value}
                onClick={() => setMarkup(value)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  markup === value
                    ? 'bg-orange-primary text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={controlSpring}
              >
                {value}%
              </motion.button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <motion.button
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-semibold transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={controlSpring}
            >
              Отмена
            </motion.button>
            <motion.button
              onClick={handleConfirm}
              className="flex-1 bg-gradient-to-r from-orange-primary to-orange-light text-white py-3 rounded-xl font-semibold shadow-lg"
              whileHover={{
                scale: 1.02,
                boxShadow: '0 8px 24px rgba(255, 107, 0, 0.3)',
              }}
              whileTap={{
                scale: 0.98,
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
              }}
              transition={controlSpring}
            >
              Применить
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MarkupSliderModal;
