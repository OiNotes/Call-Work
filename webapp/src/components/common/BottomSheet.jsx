import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';
import { useTelegram } from '../../hooks/useTelegram';
import { usePlatform } from '../../hooks/usePlatform';
import { getSpringPreset, getSurfaceStyle, isAndroid } from '../../utils/platform';

export default function BottomSheet({ isOpen, onClose, children, title }) {
  const { triggerHaptic } = useTelegram();
  const platform = usePlatform();
  const android = isAndroid(platform);

  const overlayStyle = useMemo(
    () => getSurfaceStyle('overlay', platform),
    [platform]
  );

  const sheetStyle = useMemo(
    () => getSurfaceStyle('surfacePanel', platform),
    [platform]
  );

  const sheetSpring = useMemo(
    () => getSpringPreset('sheet', platform),
    [platform]
  );

  const controlSpring = useMemo(
    () => getSpringPreset('press', platform),
    [platform]
  );

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: android ? 0.24 : 0.2 }}
            onClick={handleClose}
            style={overlayStyle}
          />

          {/* Bottom Sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
            style={{ maxHeight: 'calc(90vh - var(--tabbar-total))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetSpring}
          >
            <div
              className="rounded-t-[32px] flex flex-col min-h-0"
              style={sheetStyle}
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div
                  className="w-10 h-1 rounded-full bg-white/20"
                  style={{ touchAction: 'none' }}
                />
              </div>

              {/* Header */}
              {title && (
                <div className="flex items-center justify-between px-6 pb-4">
                  <h2
                    className="text-2xl font-bold text-white"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    {title}
                  </h2>
                  <motion.button
                    onClick={handleClose}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400"
                    style={{
                      background: android ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                    whileTap={{ scale: android ? 0.94 : 0.9 }}
                    transition={controlSpring}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6" style={{ paddingBottom: 'var(--tabbar-total)' }}>
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
