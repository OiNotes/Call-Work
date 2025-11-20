import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { useBackButton } from '../../hooks/useBackButton';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  danger = false,
}) => {
  // Spring animation preset
  const controlSpring = { type: 'spring', stiffness: 400, damping: 32 };

  // Telegram BackButton integration
  useBackButton(isOpen ? onClose : null);

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
          {/* Icon */}
          <motion.div
            className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              danger ? 'bg-red-600/20' : 'bg-orange-primary/20'
            }`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, ...controlSpring }}
          >
            {danger ? (
              <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
            ) : (
              <InformationCircleIcon className="w-6 h-6 text-orange-primary" />
            )}
          </motion.div>

          {/* Title */}
          <motion.h3
            className="text-white text-2xl font-bold tracking-tight mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, ...controlSpring }}
          >
            {title}
          </motion.h3>

          {/* Message */}
          <motion.p
            className="text-gray-400 text-sm leading-relaxed mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...controlSpring }}
          >
            {message}
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            className="flex gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, ...controlSpring }}
          >
            <motion.button
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3.5 rounded-xl font-semibold border border-white/10 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={controlSpring}
            >
              {cancelText}
            </motion.button>

            {danger ? (
              <motion.button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-500 text-white py-3.5 rounded-xl font-semibold shadow-lg"
                whileHover={{
                  scale: 1.02,
                  boxShadow: '0 8px 24px rgba(220, 38, 38, 0.3)',
                }}
                whileTap={{
                  scale: 0.98,
                  boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
                }}
                transition={controlSpring}
              >
                {confirmText}
              </motion.button>
            ) : (
              <motion.button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
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
                {confirmText}
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConfirmDialog;
