import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelegram } from '../../hooks/useTelegram';
import { useBackButton } from '../../hooks/useBackButton';

const EditMarkupModal = ({ isOpen, onClose, currentMarkup, onSave }) => {
  const [markup, setMarkup] = useState(currentMarkup || '');
  const [error, setError] = useState('');
  const lastHapticRef = useRef(0);
  const { triggerHaptic } = useTelegram();

  // Telegram BackButton integration
  useBackButton(isOpen ? onClose : null);

  // Spring animation preset
  const controlSpring = { type: 'spring', stiffness: 400, damping: 32 };

  useEffect(() => {
    if (isOpen) {
      setMarkup(currentMarkup || '');
      setError('');
    }
  }, [isOpen, currentMarkup]);

  const handleSave = () => {
    const value = parseInt(markup, 10);

    if (isNaN(value) || value < 1 || value > 500) {
      setError('Наценка должна быть от 1% до 500%');
      triggerHaptic('error');
      return;
    }

    triggerHaptic('success');
    onSave(value);
    onClose();
  };

  if (!isOpen) return null;

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
          className="glass-elevated rounded-2xl p-6 w-full max-w-sm border border-white/10"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={controlSpring}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6">
            <h3 className="text-white text-2xl font-bold tracking-tight mb-2">Изменить наценку</h3>
            <p className="text-gray-400 text-sm">Укажите новый процент наценки для всех товаров</p>
          </div>

          {/* Markup Value Display */}
          <div className="text-center mb-6">
            <div className="text-6xl font-bold text-orange-primary mb-1">{markup || 0}%</div>
            <div className="text-gray-400 text-sm">Наценка</div>
          </div>

          {/* Slider */}
          <div className="mb-6">
            <div className="relative">
              {/* Track Background */}
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                {/* Active Track */}
                <div
                  className="h-full bg-gradient-to-r from-orange-primary to-orange-light transition-none"
                  style={{ width: `${(((markup || 1) - 1) / 499) * 100}%` }}
                />
              </div>

              {/* Range Input */}
              <input
                type="range"
                min="1"
                max="500"
                step="1"
                value={markup || 1}
                onChange={(e) => {
                  const newValue = Number(e.target.value);
                  setMarkup(newValue);
                  setError('');

                  const now = Date.now();
                  if (now - lastHapticRef.current > 100) {
                    triggerHaptic('light');
                    lastHapticRef.current = now;
                  }
                }}
                className="absolute inset-0 w-full h-12 opacity-0 cursor-pointer"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  zIndex: 10,
                }}
              />

              {/* Custom Thumb */}
              <motion.div
                className="absolute w-6 h-6 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing pointer-events-none"
                style={{
                  left: `calc(${(((markup || 1) - 1) / 499) * 100}% - ${(((markup || 1) - 1) / 499) * 24}px)`,
                  top: '-8px',
                  boxShadow: '0 0 0 3px rgba(255, 107, 0, 0.15), 0 3px 10px rgba(0, 0, 0, 0.2)',
                }}
                initial={false}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.15 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </div>

            {/* Min/Max Labels */}
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>1%</span>
              <span>500%</span>
            </div>
          </div>

          {/* Quick Select Buttons */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[10, 25, 50, 100].map((value) => (
              <motion.button
                key={value}
                onClick={() => {
                  setMarkup(value);
                  setError('');
                  triggerHaptic('medium');
                }}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  markup === value
                    ? 'bg-orange-primary text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {value}%
              </motion.button>
            ))}
          </div>

          {/* Price Preview */}
          <div className="glass-card rounded-xl p-4 mb-6 border border-white/5">
            <div className="text-gray-400 text-xs mb-2">Пример расчёта:</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-400 text-sm">Цена поставщика</div>
                <div className="text-white text-lg font-semibold">$100</div>
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
                  key={markup}
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  ${(100 * (1 + (parseInt(markup, 10) || 0) / 100)).toFixed(2)}
                </motion.div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={controlSpring}
                className="mb-6 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3"
              >
                <svg
                  className="w-4 h-4 text-red-400 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-red-400 text-sm font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <motion.button
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3.5 rounded-xl font-semibold border border-white/10 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={controlSpring}
            >
              Отмена
            </motion.button>
            <motion.button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-orange-primary to-orange-light text-white py-3.5 rounded-xl font-semibold shadow-lg"
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
              Сохранить
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditMarkupModal;
