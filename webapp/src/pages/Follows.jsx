import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Layout/Header';
import { useApi } from '../hooks/useApi';
import { useStore } from '../store/useStore';
import { useTelegram } from '../hooks/useTelegram';
import { useTranslation } from '../i18n/useTranslation';

const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '0';
  }
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
};

const modeLabel = (mode, markup) => {
  if (mode === 'resell') {
    const suffix = Number.isFinite(markup) ? ` (+${Math.round(markup)}%)` : '';
    return `Перепродажа${suffix}`;
  }
  return 'Мониторинг';
};

export default function Follows() {
  const { get } = useApi();
  const { setHasFollows } = useStore();
  const { triggerHaptic } = useTelegram();
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [follows, setFollows] = useState([]);
  const [selectedFollowId, setSelectedFollowId] = useState(null);
  const [selectedFollow, setSelectedFollow] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);

  const fetchProducts = useCallback(async (follow) => {
    if (!follow) {
      setProducts([]);
      return;
    }

    setProductsLoading(true);
    setProductsError(null);
    try {
      const { data } = await get(`/shop-follows/${follow.id}/products`);
      const payload = data?.data || data || {};
      setProducts(Array.isArray(payload.products) ? payload.products : []);
      setSelectedFollow({ ...follow, mode: payload.mode || follow.mode });
    } catch (err) {
      setProducts([]);
      setProductsError('Не удалось загрузить товары');
    } finally {
      setProductsLoading(false);
    }
  }, [get]);

  const loadFollows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: shopsResponse } = await get('/shops/my');
      const shops = Array.isArray(shopsResponse?.data) ? shopsResponse.data : [];

      if (!shops.length) {
        setFollows([]);
        setHasFollows(false);
        setSelectedFollowId(null);
        setSelectedFollow(null);
        setProducts([]);
        setProductsError(null);
        return;
      }

      const shop = shops[0];
      const { data: followsResponse } = await get('/shop-follows', {
        params: { shop_id: shop.id }
      });

      const list = Array.isArray(followsResponse?.data) ? followsResponse.data : followsResponse || [];
      setFollows(list);
      setHasFollows(list.length > 0);

      if (list.length > 0) {
        const first = list[0];
        setSelectedFollowId(first.id);
        setSelectedFollow(first);
        await fetchProducts(first);
      } else {
        setSelectedFollowId(null);
        setSelectedFollow(null);
        setProducts([]);
        setProductsError(null);
      }
    } catch (err) {
      setError('Не удалось загрузить подписки');
      setFollows([]);
      setHasFollows(false);
      setSelectedFollowId(null);
      setSelectedFollow(null);
      setProducts([]);
      setProductsError(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProducts, get, setHasFollows]);

  useEffect(() => {
    loadFollows();
  }, [loadFollows]);

  const handleSelectFollow = useCallback(async (follow) => {
    if (!follow) {
      return;
    }
    triggerHaptic('light');
    setError(null);
    setSelectedFollowId(follow.id);
    setSelectedFollow(follow);
    await fetchProducts(follow);
  }, [fetchProducts, triggerHaptic]);

  const productsView = useMemo(() => {
    if (!selectedFollow) {
      return null;
    }

    if (productsLoading) {
      return (
        <div className="flex items-center justify-center py-10">
          <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (productsError) {
      return (
        <p className="text-sm text-red-400">{productsError}</p>
      );
    }

    if (!products.length) {
      return (
        <p className="text-gray-400 text-sm">
          {selectedFollow.mode === 'resell'
            ? 'Нет скопированных товаров.'
            : 'У поставщика пока нет товаров.'}
        </p>
      );
    }

    return (
      <div className="space-y-3">
        {products.map((product, index) => {
          if (selectedFollow.mode === 'resell') {
            const synced = product.synced_product || product.syncedProduct || {};
            const name = synced.name || product.source_product?.name || product.name || `Товар #${product.id}`;
            const price = synced.price ?? product.pricing?.expected_price ?? product.source_product?.price ?? 0;
            const stock = synced.stock_quantity ?? product.source_product?.stock_quantity ?? 0;
            return (
              <div key={product.id || `${name}-${index}`} className="flex items-center justify-between text-sm text-gray-200">
                <span className="truncate mr-2">{name}</span>
                <span className="flex-shrink-0 text-gray-400">${formatMoney(price)} • {Number(stock) || 0} шт</span>
              </div>
            );
          }

          const name = product.name || `Товар #${product.id}`;
          const price = product.price ?? 0;
          const stock = product.stock_quantity ?? 0;
          return (
            <div key={product.id || `${name}-${index}`} className="flex items-center justify-between text-sm text-gray-200">
              <span className="truncate mr-2">{name}</span>
              <span className="flex-shrink-0 text-gray-400">${formatMoney(price)} • {Number(stock) || 0} шт</span>
            </div>
          );
        })}
      </div>
    );
  }, [products, productsError, productsLoading, selectedFollow]);

  return (
    <div
      className="pb-24"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}
    >
      <Header title={t('tabs.follows')} />

      <div className="px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        ) : follows.length === 0 ? (
          <div className="glass-card rounded-2xl p-4 text-gray-400 text-sm">
            У вас пока нет подписок. Добавьте магазины через бота.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {follows.map((follow) => {
                const isActive = follow.id === selectedFollowId;
                const infoMarkup = Number(follow.markup_percentage ?? follow.markup ?? 0);
                const totalProducts = follow.synced_products_count ?? follow.source_products_count ?? 0;

                return (
                  <motion.button
                    key={follow.id}
                    onClick={() => handleSelectFollow(follow)}
                    className={`w-full text-left rounded-2xl border transition-colors ${
                      isActive
                        ? 'border-orange-primary/40 bg-orange-primary/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white font-semibold truncate">{follow.source_shop_name || follow.name || 'Магазин'}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{totalProducts} товаров</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{modeLabel(follow.mode, infoMarkup)}</span>
                        <span className="text-orange-primary font-medium">Открыть</span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {selectedFollow && (
              <div className="glass-card rounded-2xl p-4 space-y-3">
                <div>
                  <h2 className="text-white text-lg font-semibold">
                    {selectedFollow.source_shop_name || selectedFollow.name || 'Магазин'}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {modeLabel(selectedFollow.mode, selectedFollow.markup_percentage ?? selectedFollow.markup)}
                  </p>
                </div>
                {productsView}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
