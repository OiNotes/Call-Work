import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Layout/Header';
import ProductGrid from '../components/Product/ProductGrid';
import CartButton from '../components/Cart/CartButton';
import { useStore } from '../store/useStore';
import { useTelegram } from '../hooks/useTelegram';
import { useBackButton } from '../hooks/useBackButton';
import { useTranslation } from '../i18n/useTranslation';
import { useApi } from '../hooks/useApi';

// Skeleton loader component
function ProductCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-4 space-y-3 animate-pulse border border-white/10">
      {/* Image skeleton */}
      <div className="w-full aspect-square rounded-xl bg-white/5" />
      {/* Title skeleton */}
      <div className="h-5 bg-white/10 rounded-lg w-3/4" />
      {/* Description skeleton */}
      <div className="h-3 bg-white/5 rounded w-full" />
      <div className="h-3 bg-white/5 rounded w-2/3" />
      {/* Price & button skeleton */}
      <div className="flex items-center justify-between mt-4">
        <div className="h-6 bg-white/10 rounded-lg w-20" />
        <div className="h-9 bg-white/5 rounded-lg w-24" />
      </div>
    </div>
  );
}

export default function Catalog() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [myShop, setMyShop] = useState(null);

  const products = useStore((state) => state.products);
  const currentShop = useStore((state) => state.currentShop);
  const setCurrentShop = useStore((state) => state.setCurrentShop);
  const setCartOpen = useStore((state) => state.setCartOpen);
  const token = useStore((state) => state.token);
  const { triggerHaptic } = useTelegram();
  const { t } = useTranslation();
  const { get } = useApi();
  const [activeSection, setActiveSection] = useState('stock');

  // ✅ REMOVED: Unnecessary empty useEffect - logic handled in main useEffect

  // ✅ FIX: Stable callback with only 'get' dependency (from useApi hook)
  // Accepts AbortSignal for cleanup on unmount/re-render
  const loadMyShop = useCallback(
    async (signal) => {
      const { data, error: apiError } = await get('/shops/my', { signal });

      // ✅ Check abort signal to prevent race conditions
      if (signal?.aborted) {
        return { status: 'aborted' };
      }

      if (apiError) {
        console.error('[Catalog] 🔴 loadMyShop ERROR:', apiError);
        return { status: 'error', error: apiError };
      }

      if (data?.data && data.data.length > 0) {
        setMyShop(data.data[0]);
        return { status: 'success', shop: data.data[0] };
      }

      return { status: 'success', shop: null };
    },
    [get]
  );

  // ✅ FIX: Stable callback with only 'get' dependency
  // Uses getState() to avoid setProducts in dependencies (prevents unnecessary re-renders)
  const loadProducts = useCallback(
    async (shopId, signal) => {
      const { data, error: apiError } = await get('/products', {
        params: { shopId },
        signal,
      });

      // ✅ Check abort signal to prevent race conditions
      if (signal?.aborted) {
        return { status: 'aborted' };
      }

      if (apiError) {
        console.error('[Catalog] 🔴 loadProducts ERROR:', apiError);
        return { status: 'error', error: 'Failed to load products' };
      }

      const items = Array.isArray(data?.data) ? data.data : [];

      // ✅ FIX: Use getState() for stable reference (no dependency on setProducts)
      useStore.getState().setProducts(items, shopId);
      return { status: 'success' };
    },
    [get]
  ); // ✅ FIX: Only depend on stable 'get' from useApi

  // ✅ FIX: Main data loading effect with stable dependencies
  useEffect(() => {
    // ✅ Wait for token
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const signal = controller.signal;

    // Load my shop first, then load products
    loadMyShop(signal)
      .then((result) => {
        if (signal.aborted || result?.status !== 'success') {
          return;
        }

        const shop = currentShop || result.shop;

        if (shop) return loadProducts(shop.id, signal);
      })
      .then((result) => {
        if (!signal.aborted && result?.status === 'error') {
          setError(result.error);
        }
      })
      .finally(() => {
        if (!signal.aborted) {
          setLoading(false);
        } else {
        }
      });

    // ✅ FIX: Cleanup function aborts pending requests on unmount or deps change
    // Prevents race conditions when component unmounts or re-renders
    return () => {
      controller.abort();
    };
  }, [currentShop, token, loadMyShop, loadProducts]); // ✅ Dependencies are stable (useCallback wrapped)

  const handleBack = useCallback(() => {
    triggerHaptic('light');
    setCurrentShop(null);
    // ✅ FIX: Use getState() for stable reference
    useStore.getState().setProducts([], null);
  }, [triggerHaptic, setCurrentShop]);

  const handleBackToMyShop = useCallback(() => {
    triggerHaptic('light');
    setCurrentShop(null);
    // Товары автоматически загрузятся через useEffect
  }, [triggerHaptic, setCurrentShop]);

  // Определяем, какой магазин показывать
  const displayShop = currentShop || myShop;
  const displayShopLogo = displayShop?.logo || displayShop?.image || null;
  const isViewingOwnShop = !currentShop && myShop;
  const isViewingSubscription = currentShop && myShop && currentShop.id !== myShop.id;

  // Telegram BackButton support - показывать только когда есть куда вернуться
  const backHandler = useMemo(() => {
    if (isViewingSubscription) return handleBackToMyShop;
    if (currentShop) return handleBack;
    return null; // Скрыть BackButton когда на главной
  }, [isViewingSubscription, currentShop, handleBackToMyShop, handleBack]);

  useBackButton(backHandler);

  const productSections = useMemo(() => {
    const byStock = [];
    const byPreorder = [];

    (products || []).forEach((product) => {
      if (product.availability === 'preorder') {
        byPreorder.push(product);
      } else if (product.availability === 'stock') {
        byStock.push(product);
      }
    });

    return {
      stock: byStock,
      preorder: byPreorder,
    };
  }, [products]);

  const displayedProducts =
    activeSection === 'preorder' ? productSections.preorder : productSections.stock;

  const handleSectionChange = useCallback(
    (sectionId) => {
      if (sectionId === activeSection) return;
      triggerHaptic('light');
      setActiveSection(sectionId);
    },
    [activeSection, triggerHaptic]
  );

  // Если нет магазина - показываем loading или пустой экран
  if (!displayShop) {
    return (
      <div className="pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
        <Header title={t('catalog.title')} />

        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          {loading ? (
            <>
              <div className="w-12 h-12 border-4 border-orange-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-400">{t('common.loading')}</p>
            </>
          ) : (
            <>
              <svg
                className="w-20 h-20 text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <h3 className="text-xl font-bold text-white mb-2">{t('catalog.selectShop')}</h3>
              <p className="text-gray-400 mb-6">{t('catalog.selectShopDesc')}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
      {/* Shop Header with Navigation */}
      <div className="bg-dark-card/80 backdrop-blur-lg p-4 sticky top-0 z-10">
        {/* Back button - показывать только если просматриваем подписку */}
        {isViewingSubscription && (
          <motion.button
            onClick={handleBackToMyShop}
            className="flex items-center gap-2 text-orange-primary mb-2"
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-medium">{t('catalog.backToMyShop')}</span>
          </motion.button>
        )}

        {/* Clear selection - показывать если просматриваем НЕ свой магазин */}
        {currentShop && !isViewingSubscription && (
          <motion.button
            onClick={handleBack}
            className="flex items-center gap-2 text-orange-primary mb-2"
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-medium">{t('common.back')}</span>
          </motion.button>
        )}

        <div className="flex items-center gap-4">
          {displayShopLogo && (
            <div className="w-12 h-12 rounded-xl bg-dark-elevated overflow-hidden flex-shrink-0">
              <img
                src={displayShopLogo}
                alt={displayShop.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-white text-2xl font-bold">
              {displayShop.name}
              {isViewingOwnShop && (
                <span className="ml-2 text-sm text-orange-primary">(Мой магазин)</span>
              )}
            </h1>
            <p className="text-gray-400 text-sm">
              {activeSection === 'preorder'
                ? `${productSections.preorder.length} в предзаказе`
                : `${productSections.stock.length} в наличии`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="relative flex bg-white/5 backdrop-blur rounded-2xl p-1">
          {['stock', 'preorder'].map((sectionId) => {
            const isActive = activeSection === sectionId;
            const label = sectionId === 'stock' ? 'Наличие' : 'Предзаказ';
            const count =
              sectionId === 'stock'
                ? productSections.stock.length
                : productSections.preorder.length;

            return (
              <button
                key={sectionId}
                type="button"
                onClick={() => handleSectionChange(sectionId)}
                className={`relative flex-1 py-2.5 rounded-xl transition-colors ${
                  isActive ? 'text-white' : 'text-white/60'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="catalog-section-highlight"
                    className="absolute inset-0 bg-white/16 shadow-[0_10px_30px_rgba(10,10,10,0.35)] rounded-xl"
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  />
                )}
                <span
                  className="relative z-10 text-sm font-semibold"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {label}
                </span>
                <span
                  className={`relative z-10 ml-2 text-xs font-semibold ${isActive ? 'text-orange-primary' : 'text-white/35'}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="px-4 py-6">
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <svg
            className="w-16 h-16 text-red-500 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-400 mb-2">{error}</h3>
          <motion.button
            onClick={() => {
              // ✅ FIX: Trigger reload through currentShop change to use proper AbortController
              setError(null);
              setCurrentShop(displayShop);
            }}
            className="bg-orange-primary hover:bg-orange-light text-white font-semibold px-6 py-3 rounded-xl transition-colors mt-4"
            whileTap={{ scale: 0.95 }}
          >
            Retry
          </motion.button>
        </div>
      )}

      {/* Products Grid */}
      {!error && (
        <ProductGrid
          products={displayedProducts}
          loading={loading}
          emptyTitle={
            activeSection === 'preorder' ? 'Нет товаров в предзаказе' : t('catalog.empty')
          }
          emptyDescription={
            activeSection === 'preorder'
              ? 'Мы сообщим, как только появятся новые позиции для предзаказа'
              : t('catalog.emptyDesc')
          }
          emptyIcon={activeSection === 'preorder' ? '🕒' : '📦'}
        />
      )}

      {/* Floating Cart Button */}
      <CartButton onClick={() => setCartOpen(true)} />
    </div>
  );
}
