import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EditMarkupModal = ({ isOpen, onClose, currentMarkup, onSave }) => {
  const [markup, setMarkup] = useState(currentMarkup || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    const value = parseInt(markup, 10);

    if (isNaN(value) || value < 1 || value > 500) {
      setError('Наценка должна быть от 1% до 500%');
      return;
    }

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
          className="bg-[#1A1A1A] rounded-2xl p-6 w-full max-w-sm"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-white text-xl font-bold mb-4">Изменить наценку</h3>

          <div className="mb-4">
            <label className="block text-gray-400 text-sm mb-2">
              Наценка (1-500%)
            </label>
            <input
              type="number"
              min="1"
              max="500"
              value={markup}
              onChange={(e) => {
                setMarkup(e.target.value);
                setError('');
              }}
              className="w-full bg-[#0A0A0A] text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
              placeholder="Введите процент"
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 text-white py-3 rounded-xl font-semibold"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-[#FF6B00] text-white py-3 rounded-xl font-semibold"
            >
              Сохранить
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditMarkupModal;
