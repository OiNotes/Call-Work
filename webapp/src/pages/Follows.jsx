import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Layout/Header';
import { useApi } from '../hooks/useApi';
import { useStore } from '../store/useStore';
import { useTelegram } from '../hooks/useTelegram';
import { useTranslation } from '../i18n/useTranslation';
import FollowCard from '../components/Follows/FollowCard';


export default function Follows() {
  const { get } = useApi();
  const { setHasFollows, setFollowDetailId } = useStore();
  const { triggerHaptic } = useTelegram();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [follows, setFollows] = useState([]);

  const loadFollows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: shopsResponse } = await get('/shops/my');
      const shops = Array.isArray(shopsResponse?.data) ? shopsResponse.data : [];

      if (!shops.length) {
        setFollows([]);
        setHasFollows(false);
        return;
      }

      const shop = shops[0];
      const { data: followsResponse } = await get('/follows/my', {
        params: { shopId: shop.id }
      });

      const list = Array.isArray(followsResponse?.data) ? followsResponse.data : followsResponse || [];
      setFollows(list);
      setHasFollows(list.length > 0);
    } catch (err) {
      setError('Не удалось загрузить подписки');
      setFollows([]);
      setHasFollows(false);
    } finally {
      setIsLoading(false);
    }
  }, [get, setHasFollows]);

  useEffect(() => {
    loadFollows();
  }, []);

  const handleFollowClick = useCallback((followId) => {
    triggerHaptic('light');
    setFollowDetailId(followId);
  }, [triggerHaptic, setFollowDetailId]);

  return (
    <div
      className="pb-24"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}
    >
      <Header title={t('tabs.follows')} />

      <div className="px-4 py-6 space-y-6">
        {isLoading ? (
          <motion.div
            className="flex flex-col items-center justify-center py-16 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="text-gray-400 text-sm"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Загрузка подписок...
            </motion.div>
          </motion.div>
        ) : error ? (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        ) : follows.length === 0 ? (
          <div className="glass-card rounded-2xl p-4 text-gray-400 text-sm">
            У вас пока нет подписок. Добавьте магазины через бота.
          </div>
        ) : (
          <div className="space-y-3">
            {follows.map((follow) => (
              <FollowCard
                key={follow.id}
                follow={follow}
                onClick={() => handleFollowClick(follow.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
