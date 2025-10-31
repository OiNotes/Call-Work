import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PencilIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const EditMarkupModal = ({ isOpen, onClose, currentMarkup, onSave }) => {
  const [markup, setMarkup] = useState(currentMarkup || '');
  const [error, setError] = useState('');

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
      return;
    }

    onSave(value);
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
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
            <h3 className="text-white text-2xl font-bold tracking-tight mb-2">
              Изменить наценку
            </h3>
            <p className="text-gray-400 text-sm">
              Укажите новый процент наценки для всех товаров
            </p>
          </div>

          {/* Input Field */}
          <div className="mb-6">
            <label className="block text-gray-400 text-sm font-medium mb-2">
              Наценка (1-500%)
            </label>
            <motion.input
              type="number"
              min="1"
              max="500"
              value={markup}
              onChange={(e) => {
                setMarkup(e.target.value);
                setError('');
              }}
              onKeyPress={handleKeyPress}
              className="w-full bg-white/5 text-white rounded-xl px-4 py-3.5
                         border border-white/10
                         focus:outline-none focus:ring-2 focus:ring-orange-primary focus:border-transparent
                         placeholder:text-gray-500
                         transition-all duration-200
                         text-lg font-semibold tracking-tight"
              placeholder="Введите процент"
              autoFocus
              whileFocus={{
                scale: 1.01,
                borderColor: 'rgba(255, 107, 0, 0.5)'
              }}
              transition={controlSpring}
            />
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={controlSpring}
                  className="mt-2 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-400 text-sm font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Current Value Preview */}
          {markup && !error && (
            <motion.div
              className="glass-card rounded-xl p-3 mb-6 border border-white/5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={controlSpring}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Пример: $100</span>
                <ArrowRightIcon className="w-4 h-4 text-orange-primary" />
                <span className="text-orange-primary font-bold">
                  ${(100 * (1 + (parseInt(markup, 10) || 0) / 100)).toFixed(2)}
                </span>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <motion.button
              onClick={onClose}
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
                boxShadow: '0 8px 24px rgba(255, 107, 0, 0.3)'
              }}
              whileTap={{
                scale: 0.98,
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
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
