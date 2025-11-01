import { useState, useEffect, useMemo } from 'react';
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
  const { getSubscriptions } = useShopApi();
  const { triggerHaptic } = useTelegram();
  const { t } = useTranslation();

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: apiError } = await getSubscriptions();

      if (apiError) {
        setError('Failed to load subscriptions');
      } else {
        const normalized = (data?.data || []).map((item) => ({
          id: item.id,
          sourceShopId: item.source_shop_id,
          sourceShopName: item.source_shop_name,
          subscribedAt: item.created_at,
          sourceShopLogo: item.source_shop_logo,
        }));

        setSubscriptions(normalized);
      }
    } catch (err) {
      setError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleShopClick = (subscription) => {
    triggerHaptic('medium');
    const { setCurrentShop, setActiveTab } = useStore.getState();

    setCurrentShop({
      id: subscription.sourceShopId,
      name: subscription.sourceShopName,
      logo: subscription.sourceShopLogo,
    });

    setActiveTab('catalog');
  };

  const handleUnsubscribe = (e, shopId) => {
    e.stopPropagation(); // Prevent shop click
    triggerHaptic('medium');
    // TODO: Implement unsubscribe API call
    console.log('Unsubscribe from shop:', shopId);
    // После реализации API, обновить список подписок
    // setSubscriptions(subscriptions.filter(sub => sub.shopId !== shopId));
  };

  const hasSubscriptions = useMemo(() => subscriptions.length > 0, [subscriptions]);

  return (
    <div
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
        paddingBottom: 'var(--tabbar-total)',
        overflowY: subscriptions?.length > 5 ? 'auto' : 'visible'
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
                className="glass-card rounded-2xl p-4 cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {subscription.sourceShopName}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {new Date(subscription.subscribedAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={(e) => handleUnsubscribe(e, subscription.id)}
                      className="touch-target bg-dark-elevated hover:bg-dark-card text-gray-400 font-semibold px-3 py-2 rounded-xl transition-colors text-sm"
                      whileTap={{ scale: 0.95 }}
                    >
                      {t('subscriptions.unsubscribe')}
                    </motion.button>
                    <svg className="w-6 h-6 text-orange-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
