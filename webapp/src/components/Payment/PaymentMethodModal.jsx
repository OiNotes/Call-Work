import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useTelegram } from '../../hooks/useTelegram';
import { useTranslation } from '../../i18n/useTranslation';
import { useApi } from '../../hooks/useApi';
import { CRYPTO_OPTIONS } from '../../utils/paymentUtils';
import { usePlatform } from '../../hooks/usePlatform';
import { getSpringPreset, getSurfaceStyle, getSheetMaxHeight, isAndroid } from '../../utils/platform';
import { useBackButton } from '../../hooks/useBackButton';

export default function PaymentMethodModal() {
  const { paymentStep, selectCrypto, setPaymentStep, currentShop, selectedCrypto } = useStore();
  const { triggerHaptic } = useTelegram();
  const { t } = useTranslation();
  const api = useApi();
  const platform = usePlatform();
  const android = isAndroid(platform);

  const [availableWallets, setAvailableWallets] = useState([]);
  const [loading, setLoading] = useState(false);

  const overlayStyle = useMemo(
    () => getSurfaceStyle('overlay', platform),
    [platform]
  );

  const sheetStyle = useMemo(
    () => getSurfaceStyle('surfacePanel', platform),
    [platform]
  );

  const cardBaseStyle = useMemo(
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

  const isOpen = paymentStep === 'method';

  const handleClose = () => {
    triggerHaptic('light');
    setPaymentStep('idle');
  };

  const handleSelectCrypto = async (cryptoId) => {
    triggerHaptic('medium');
    
    try {
      // Вызываем selectCrypto из store - создаёт order + invoice + переход к details
      await selectCrypto(cryptoId);
      // Store автоматически выставит paymentStep = 'details'
    } catch (error) {
      console.error('[PaymentMethodModal] Failed to select crypto:', error);
      triggerHaptic('error');
      // Можно добавить toast notification для пользователя
    }
  };

  useBackButton(isOpen ? handleClose : null);

  // Load shop wallets when modal opens
  useEffect(() => {
    if (!isOpen || !currentShop?.id) {
      console.log('🔍 [DEBUG] Modal closed or no shop ID:', { isOpen, shopId: currentShop?.id });
      return;
    }

    const loadWallets = async () => {
      try {
        setLoading(true);
        console.log('🔍 [DEBUG] Loading wallets for shop:', currentShop.id);

        const { data, error } = await api.get(`/shops/${currentShop.id}/wallets`);

        console.log('🔍 [DEBUG] API response:', {
          error,
          data,
          hasDataProp: !!data?.data,
          dataType: typeof data?.data
        });
        console.log('🔍 [DEBUG] data?.data contents:', data?.data);

        if (!error && data?.data) {
          // Transform API response { wallet_btc: "...", wallet_eth: null, ... } to array ["BTC", "ETH"]
          const currencies = Object.entries(data.data)
            .filter(([key, value]) => {
              const startsWithWallet = key.startsWith('wallet_');
              const hasValue = !!value;
              const isString = typeof value === 'string';
              const isTrimmed = isString && !!value.trim();

              console.log(`🔍 [DEBUG] Wallet ${key}:`, {
                value: `"${value}"`,
                startsWithWallet,
                hasValue,
                isString,
                isTrimmed,
                willInclude: startsWithWallet && hasValue && isString && isTrimmed
              });

              return startsWithWallet && value && isString && value.trim();
            })
            .map(([key]) => key.replace('wallet_', '').toUpperCase());

          console.log('🔍 [DEBUG] Extracted currencies:', currencies);
          setAvailableWallets(currencies);
        } else {
          // If no data - don't show fallback, keep empty
          console.warn('[PaymentMethodModal] No wallet data received', { error, hasData: !!data?.data });
          setAvailableWallets([]);
        }
      } catch (err) {
        console.error('[PaymentMethodModal] Failed to load wallets:', err);
        // При ошибке API - не показываем fallback криптовалюты
        setAvailableWallets([]);
      } finally {
        setLoading(false);
      }
    };

    loadWallets();
  }, [isOpen, currentShop?.id, api]);

  // Фильтруем криптовалюты - показываем только те, для которых есть кошельки
  const availableCryptoOptions = useMemo(() => {
    console.log('🔍 [DEBUG] Filtering crypto options:', {
      loading,
      availableWallets,
      availableWalletsLength: availableWallets.length
    });

    // Во время загрузки - не показываем криптовалюты
    if (loading) {
      console.log('🔍 [DEBUG] Still loading, returning empty array');
      return [];
    }

    // Если нет кошельков - не показываем криптовалюты
    if (availableWallets.length === 0) {
      console.log('🔍 [DEBUG] No wallets available, returning empty array');
      return [];
    }

    const filtered = CRYPTO_OPTIONS.filter(crypto => {
      const isIncluded = availableWallets.includes(crypto.id);
      console.log(`🔍 [DEBUG] Checking crypto ${crypto.id}:`, isIncluded ? '✅ INCLUDED' : '❌ EXCLUDED');
      return isIncluded;
    });

    console.log('🔍 [DEBUG] Final filtered options:', filtered.map(c => c.id));
    return filtered;
  }, [availableWallets, loading]);

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
            style={{ maxHeight: getSheetMaxHeight(platform, 32) }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetSpring}
          >
            <div
              className="rounded-t-[32px] flex flex-col"
              style={sheetStyle}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div>
                  <h2
                    className="text-2xl font-bold text-white"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    {t('payment.selectCrypto')}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {t('payment.selectMethod')}
                  </p>
                </div>
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

              {/* Crypto Options */}
              <div
                className="flex-1 overflow-y-auto px-6 pt-4"
                style={{ paddingBottom: 'calc(var(--tabbar-total) + 72px)' }}
              >
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : availableCryptoOptions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-400 mb-2">
                      {t('payment.noWallets') || 'No payment methods'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('payment.noWalletsDesc') || 'Please configure wallets in shop settings'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {availableCryptoOptions.map((crypto) => {

                      return (
                        <motion.button
                          key={crypto.id}
                          onClick={() => handleSelectCrypto(crypto.id)}
                          className="relative overflow-hidden rounded-2xl p-5 text-left"
                          style={{
                            ...cardBaseStyle,
                            background: `linear-gradient(145deg, rgba(26, 26, 26, ${android ? '0.94' : '0.9'}) 0%, rgba(20, 20, 20, ${android ? '0.96' : '0.95'}) 100%)`,
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                          }}
                          whileHover={{ scale: android ? 1.015 : 1.02, y: android ? -1 : -2 }}
                          whileTap={{ scale: android ? 0.985 : 0.98 }}
                          transition={quickSpring}
                        >
                          {/* Gradient overlay */}
                          <motion.div
                            className="absolute inset-0 opacity-0 hover:opacity-100"
                            style={{
                              background: `radial-gradient(600px circle at center, ${crypto.color}15, transparent 40%)`
                            }}
                            transition={{ duration: 0.3 }}
                          />

                          <div className="relative space-y-3">
                            {/* Icon */}
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold"
                              style={{
                                background: `linear-gradient(135deg, ${crypto.gradient})`,
                                boxShadow: `0 4px 12px ${crypto.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                              }}
                            >
                              {crypto.icon}
                            </div>

                            {/* Info */}
                            <div>
                              <h3
                                className="text-white font-bold text-lg"
                                style={{ letterSpacing: '-0.01em' }}
                              >
                                {crypto.name}
                              </h3>
                              <p
                                className="text-gray-400 text-xs mt-1"
                                style={{ letterSpacing: '0.01em' }}
                              >
                                {crypto.network}
                              </p>
                            </div>

                            {/* Navigation arrow */}
                            <div className="flex justify-end">
                              <svg 
                                className="w-5 h-5 text-orange-primary flex-shrink-0" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={2.5} 
                                  d="M9 5l7 7-7 7" 
                                />
                              </svg>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
