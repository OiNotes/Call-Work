import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Layout/Header';
import { useShopApi } from '../hooks/useApi';
import { useStore } from '../store/useStore';
import { useTelegram } from '../hooks/useTelegram';
import { useTranslation } from '../i18n/useTranslation';

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const api = useShopApi();
  const { triggerHaptic } = useTelegram();
  const { t } = useTranslation();

  const loadSubscriptions = useCallback(async (isCancelled) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[Subscriptions] Loading shop subscriptions...');

      // Use new endpoint for shop payment subscriptions
      const { data, error: apiError } = await api.get('/subscriptions/my-shops');

      console.log('[Subscriptions] Response:', { data, apiError });

      // Check if component unmounted during request
      if (isCancelled()) {
        console.log('[Subscriptions] Component unmounted, skipping state updates');
        return;
      }

      if (apiError) {
        console.error('[Subscriptions] API error:', apiError);
        setError('Failed to load subscriptions');
        return; // Early exit, loading will be reset in finally
      }

      // Normalize data for shop subscriptions (payment tier data)
      const rawData = Array.isArray(data?.data) ? data.data :
                     Array.isArray(data) ? data : [];

      const normalized = rawData.map((item) => ({
        id: item.id,
        shopId: item.shop_id,
        shopName: item.shop_name,
        tier: item.tier,
        amount: item.amount,
        currency: item.currency,
        periodStart: item.period_start,
        periodEnd: item.period_end,
        status: item.status,
        createdAt: item.created_at,
        verifiedAt: item.verified_at,
      }));

      setSubscriptions(normalized);
    } catch (err) {
      console.error('[Subscriptions] Exception:', err);
      if (!isCancelled()) {
        setError('Failed to load subscriptions');
      }
    } finally {
      console.log('[Subscriptions] Loading complete, setLoading(false)');
      if (!isCancelled()) {
        setLoading(false); // ALWAYS resets loading state
      }
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;

    loadSubscriptions(isCancelled);

    return () => {
      cancelled = true;
    };
  }, [loadSubscriptions]);

  const handleShopClick = (subscription) => {
    triggerHaptic('medium');
    const { setCurrentShop, setActiveTab } = useStore.getState();

    setCurrentShop({
      id: subscription.shopId,
      name: subscription.shopName,
      logo: null, // Shop subscriptions don't include logo
    });

    setActiveTab('catalog');
  };



  const hasSubscriptions = useMemo(() => subscriptions.length > 0, [subscriptions]);

  return (
    <div
      className="h-screen overflow-y-auto"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
        paddingBottom: 'calc(var(--tabbar-total) + 20px)'
      }}
    >
      <Header title={t('subscriptions.title')} />

      <div className="px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-400 mb-2">{error}</h3>
            <motion.button
              onClick={loadSubscriptions}
              className="touch-target bg-orange-primary hover:bg-orange-light text-white font-semibold px-6 rounded-xl transition-colors duration-300 mt-4"
              whileTap={{ scale: 0.95 }}
            >
              Retry
            </motion.button>
          </div>
        ) : !hasSubscriptions ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-400 mb-2">{t('subscriptions.empty')}</h3>
            <p className="text-sm text-gray-500">{t('subscriptions.emptyDesc')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <motion.div
                key={subscription.id}
                onClick={() => handleShopClick(subscription)}
                className="glass-card rounded-2xl p-5 cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  {/* Название магазина */}
                  <h3 className="text-xl font-bold text-white" style={{ letterSpacing: '-0.01em' }}>
                    {subscription.shopName}
                  </h3>
                  
                  {/* Стрелка навигации */}
                  <svg 
                    className="w-6 h-6 text-orange-primary flex-shrink-0" 
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
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
