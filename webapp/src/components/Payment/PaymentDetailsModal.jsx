import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState, lazy, Suspense } from 'react';
import { useStore } from '../../store/useStore';
import { useTelegram } from '../../hooks/useTelegram';
import { useTranslation } from '../../i18n/useTranslation';
import { CRYPTO_OPTIONS, calculateCryptoAmount } from '../../utils/paymentUtils';
import { usePlatform } from '../../hooks/usePlatform';
import { getSpringPreset, getSurfaceStyle, getSheetMaxHeight, isAndroid, isIOS } from '../../utils/platform';
import { useBackButton } from '../../hooks/useBackButton';

// Lazy load QR code library (14KB gzipped)
const QRCodeSVG = lazy(() =>
  import('qrcode.react').then(module => ({ default: module.QRCodeSVG }))
);

export default function PaymentDetailsModal() {
  const {
    paymentStep,
    selectedCrypto,
    paymentWallet,
    currentOrder,
    cryptoAmount,
    setPaymentStep
  } = useStore();
  const { triggerHaptic } = useTelegram();
  const { t } = useTranslation();
  const platform = usePlatform();
  const android = isAndroid(platform);
  const ios = isIOS(platform);
  const [copied, setCopied] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);

  const overlayStyle = useMemo(
    () => getSurfaceStyle('overlay', platform),
    [platform]
  );

  const sheetStyle = useMemo(
    () => getSurfaceStyle('surfacePanel', platform),
    [platform]
  );

  const cardStyle = useMemo(
    () => getSurfaceStyle('glassCard', platform),
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

  const quickSpring = useMemo(
    () => getSpringPreset('quick', platform),
    [platform]
  );

  const isOpen = paymentStep === 'details';

  const cryptoInfo = CRYPTO_OPTIONS.find(c => c.id === selectedCrypto);

  const handleClose = () => {
    triggerHaptic('light');
    setPaymentStep('method');
  };

  const handleCopyWallet = async () => {
    try {
      await navigator.clipboard.writeText(paymentWallet);
      setCopied(true);
      triggerHaptic('success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyAmount = async () => {
    try {
      await navigator.clipboard.writeText(`${cryptoAmount} ${selectedCrypto}`);
      setCopiedAmount(true);
      triggerHaptic('success');
      setTimeout(() => setCopiedAmount(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handlePaid = () => {
    triggerHaptic('medium');
    setPaymentStep('hash');
  };

  useBackButton(isOpen ? handleClose : null);

  if (!cryptoInfo || !currentOrder) return null;

  const itemCount = currentOrder.quantity || 1;
  const qrSize = ios ? 140 : 160;

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

          {/* Modal */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
            style={{ maxHeight: getSheetMaxHeight(platform, ios ? -24 : 32) }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={sheetSpring}
          >
            <div
              className="rounded-t-[32px] flex flex-col"
              style={sheetStyle}
            >
              {/* Header - Compact */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400"
                    style={{
                      background: android ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                    whileTap={{ scale: android ? 0.94 : 0.9 }}
                    transition={controlSpring}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </motion.button>
                  <div>
                    <h2
                      className="text-lg font-bold text-white"
                      style={{ letterSpacing: '-0.01em' }}
                    >
                      {t('payment.payWith', { crypto: cryptoInfo.name })}
                    </h2>
                    <p className="text-xs text-gray-400">
                      {cryptoInfo.network}
                    </p>
                  </div>
                </div>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${cryptoInfo.gradient})`,
                    boxShadow: `0 4px 12px ${cryptoInfo.color}40`
                  }}
                >
                  {cryptoInfo.icon}
                </div>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ paddingBottom: 'calc(var(--tabbar-total) + 16px)' }}>
                {/* QR Code - Compact */}
                <div className="flex justify-center">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.1 }}
                    className="p-3 rounded-xl"
                    style={{
                      background: 'white',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <Suspense fallback={
                      <div className="flex items-center justify-center" style={{ width: qrSize, height: qrSize }}>
                        <div className="w-8 h-8 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    }>
                      <QRCodeSVG
                        value={paymentWallet}
                        size={qrSize}
                        level="H"
                        includeMargin={false}
                      />
                    </Suspense>
                  </motion.div>
                </div>

                {/* Wallet Address - Compact */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-2 rounded-lg p-2"
                  style={{
                    ...cardStyle,
                    background: android ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div className="flex-1 break-all text-white font-mono text-xs tabular-nums">
                    {paymentWallet}
                  </div>
                  <motion.button
                    onClick={handleCopyWallet}
                    className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                    style={{
                      background: copied ? 'rgba(34, 197, 94, 0.24)' : 'rgba(255, 107, 0, 0.22)',
                      border: copied ? '1px solid rgba(34, 197, 94, 0.36)' : '1px solid rgba(255, 107, 0, 0.32)'
                    }}
                    whileTap={{ scale: android ? 0.95 : 0.9 }}
                    transition={controlSpring}
                  >
                    {copied ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-orange-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </motion.button>
                </motion.div>

                {/* Amount Summary - Compact & Centered & Copyable */}
                <motion.button
                  onClick={handleCopyAmount}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="w-full rounded-xl p-4 text-center space-y-2 cursor-pointer"
                  style={{
                    ...cardStyle,
                    background: 'linear-gradient(145deg, rgba(26, 26, 26, 0.9) 0%, rgba(20, 20, 20, 0.95) 100%)',
                    border: copiedAmount
                      ? '1px solid rgba(34, 197, 94, 0.36)'
                      : '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                  whileTap={{ scale: android ? 0.985 : 0.98 }}
                  transition={{ ...quickSpring, delay: 0.3 }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-gray-400 text-xs">
                      {t('cart.items', { count: itemCount })}
                    </p>
                    {copiedAmount && (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mb-1">
                    ${currentOrder.total_price?.toFixed(2) || '0.00'} USD
                  </p>
                  <div
                    className="text-orange-primary font-bold text-3xl tabular-nums"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {cryptoAmount} {selectedCrypto}
                  </div>
                  <p className="text-gray-500 text-[10px] mt-2">
                    {copiedAmount ? 'Скопировано!' : 'Нажмите для копирования'}
                  </p>
                </motion.button>
              </div>

              {/* Footer - Compact */}
              <div className="p-4 border-t border-white/10" style={{ paddingBottom: 'calc(var(--tabbar-total) + 16px)' }}>
                <motion.button
                  onClick={handlePaid}
                  className="w-full h-12 text-white font-bold rounded-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #FF6B00 0%, #FF8F3D 100%)',
                    boxShadow: android
                      ? '0 4px 16px rgba(255, 107, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                      : `
                          0 4px 12px rgba(255, 107, 0, 0.3),
                          0 8px 24px rgba(255, 107, 0, 0.15),
                          inset 0 1px 0 rgba(255, 255, 255, 0.2)
                        `,
                    letterSpacing: '-0.01em'
                  }}
                  whileTap={{ scale: android ? 0.985 : 0.98 }}
                  transition={controlSpring}
                >
                  {t('payment.iPaid')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
