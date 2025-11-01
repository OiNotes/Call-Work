import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeftIcon, EyeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useStore } from '../store/useStore';
import { useFollowsApi } from '../hooks/useApi';
import ProductList from '../components/Follows/ProductList';
import EditMarkupModal from '../components/Follows/EditMarkupModal';
import MarkupSliderModal from '../components/Follows/MarkupSliderModal';
import ConfirmDialog from '../components/Follows/ConfirmDialog';
import Tabs from '../components/Follows/Tabs';
import ActionsList from '../components/Follows/ActionsList';
import { useTelegram } from '../hooks/useTelegram';

const FollowDetail = () => {
  const followsApi = useFollowsApi();
  const { triggerHaptic } = useTelegram();
  const { followDetailId, setFollowDetailId, currentFollow, setCurrentFollow, followProducts, setFollowProducts } = useStore();

  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'manage'
  const [showEditMarkup, setShowEditMarkup] = useState(false);
  const [showMarkupSlider, setShowMarkupSlider] = useState(false);
  const [showSwitchMode, setShowSwitchMode] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [newMode, setNewMode] = useState(null);

  // Spring animation preset
  const controlSpring = { type: 'spring', stiffness: 400, damping: 32 };

  useEffect(() => {
    loadData();
  }, [followDetailId]);

  const loadData = async () => {
    if (!followDetailId) return;

    try {
      setLoading(true);

      // Загрузить детали + товары параллельно
      const [followData, productsData] = await Promise.all([
        followsApi.getDetail(followDetailId),
        followsApi.getProducts(followDetailId, { limit: 100 })
      ]);

      const follow = followData?.data || followData;
      const productsPayload = productsData?.data || productsData;
      const productsList = productsPayload.products || [];

      setCurrentFollow(follow);
      setFollowProducts(productsList);

      // Проверяем есть ли еще товары
      const total = productsPayload.pagination?.total || productsList.length;
      setHasMore(productsList.length < total);
    } catch (error) {
      console.error('Error loading follow detail:', error);
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const currentLength = followProducts.length;
      const moreData = await followsApi.getProducts(followDetailId, {
        limit: 100,
        offset: currentLength
      });

      const productsPayload = moreData?.data || moreData;
      const newProducts = productsPayload.products || [];
      setFollowProducts([...followProducts, ...newProducts]);

      const total = productsPayload.pagination?.total || 0;
      setHasMore((currentLength + newProducts.length) < total);
    } catch (error) {
      console.error('Error loading more products:', error);
      triggerHaptic('error');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSaveMarkup = async (markup) => {
    try {
      await followsApi.updateMarkup(followDetailId, markup);
      await loadData();
      triggerHaptic('success');
    } catch (error) {
      console.error('Error updating markup:', error);
      triggerHaptic('error');
    }
  };

  const handleSwitchMode = async () => {
    triggerHaptic('light');
    const targetMode = currentFollow.mode === 'monitor' ? 'resell' : 'monitor';
    setNewMode(targetMode);

    if (targetMode === 'resell') {
      setShowMarkupSlider(true);
    } else {
      setShowSwitchMode(true);
    }
  };

  const confirmSwitchToMonitor = async () => {
    try {
      await followsApi.switchMode(followDetailId, 'monitor', null);
      await loadData();
      triggerHaptic('success');
    } catch (error) {
      console.error('Error switching mode:', error);
      triggerHaptic('error');
    }
  };

  const confirmSwitchToResell = async (markup) => {
    try {
      await followsApi.switchMode(followDetailId, 'resell', markup);
      await loadData();
      triggerHaptic('success');
    } catch (error) {
      console.error('Error switching mode:', error);
      triggerHaptic('error');
    }
  };

  const handleDelete = async () => {
    try {
      await followsApi.deleteFollow(followDetailId);
      triggerHaptic('success');
      setFollowDetailId(null);
    } catch (error) {
      console.error('Error deleting follow:', error);
      triggerHaptic('error');
    }
  };

  const handleBack = () => {
    triggerHaptic('light');
    setFollowDetailId(null);
  };

  const handleTabChange = (tabId) => {
    triggerHaptic('light');
    setActiveTab(tabId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={controlSpring}
        >
          <motion.div
            className="w-16 h-16 border-4 border-orange-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="text-white text-sm"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            Загрузка подписки...
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (!currentFollow) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">😔</div>
          <div className="text-white text-lg font-semibold mb-2">Подписка не найдена</div>
          <div className="text-gray-400 text-sm mb-6">Эта подписка была удалена или не существует</div>
          <motion.button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-orange-primary font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Вернуться назад
          </motion.button>
        </div>
      </div>
    );
  }

  const modeLabel = currentFollow.mode === 'monitor' ? 'Мониторинг' : 'Перепродажа';
  const ModeIcon = currentFollow.mode === 'monitor' ? EyeIcon : ArrowPathIcon;
  const productsCount = currentFollow.mode === 'resell'
    ? (currentFollow.synced_products_count || 0)
    : (currentFollow.source_products_count || 0);

  const tabs = [
    { id: 'products', label: 'Товары' },
    { id: 'manage', label: 'Управление' }
  ];

  return (
    <div className="min-h-screen bg-dark-bg text-white pb-20">
      {/* Header - Fixed */}
      <motion.div
        className="fixed top-0 left-0 right-0 z-40 bg-dark-bg/95 backdrop-blur-lg border-b border-white/5"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...controlSpring, delay: 0.05 }}
      >
        {/* Back button + Shop name */}
        <div className="px-4 py-4 flex items-center gap-3">
          <motion.button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white hover:bg-white/5 -ml-2"
            whileTap={{ scale: 0.95 }}
            transition={controlSpring}
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </motion.button>

          <div className="flex-1 min-w-0">
            <h1 className="text-white text-xl font-bold truncate" style={{ letterSpacing: '-0.02em' }}>
              {currentFollow.source_shop_name}
            </h1>
          </div>
        </div>

        {/* Stats Row */}
        <div className="px-4 pb-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5">
            <ModeIcon className="w-4 h-4 text-gray-400" />
            <span className="text-white font-medium">{modeLabel}</span>
          </div>

          {currentFollow.mode === 'resell' && currentFollow.markup_percentage && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-primary/10 border border-orange-primary/20">
              <span className="text-orange-primary font-bold text-sm">
                Наценка: +{currentFollow.markup_percentage}%
              </span>
            </div>
          )}

          <div className="text-gray-400">
            <span className="font-medium text-white">{productsCount}</span> товаров
          </div>
        </div>
      </motion.div>

      {/* Content with padding for fixed header */}
      <div className="px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 120px)' }}>

        {/* Tabs Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'products' ? (
            <motion.div
              key="products"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={controlSpring}
            >
              <ProductList
                products={followProducts}
                mode={currentFollow.mode}
                onLoadMore={loadMore}
                hasMore={hasMore}
                loadingMore={loadingMore}
              />
            </motion.div>
          ) : (
            <motion.div
              key="manage"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={controlSpring}
            >
              <ActionsList
                mode={currentFollow.mode}
                markup={currentFollow.markup_percentage}
                onEditMarkup={() => {
                  triggerHaptic('light');
                  setShowEditMarkup(true);
                }}
                onSwitchMode={handleSwitchMode}
                onDelete={() => {
                  triggerHaptic('light');
                  setShowDelete(true);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <EditMarkupModal
        isOpen={showEditMarkup}
        onClose={() => {
          triggerHaptic('light');
          setShowEditMarkup(false);
        }}
        currentMarkup={currentFollow.markup_percentage}
        onSave={handleSaveMarkup}
      />

      <MarkupSliderModal
        isOpen={showMarkupSlider}
        onClose={() => {
          triggerHaptic('light');
          setShowMarkupSlider(false);
        }}
        currentMarkup={currentFollow.markup_percentage || 25}
        onConfirm={confirmSwitchToResell}
      />

      <ConfirmDialog
        isOpen={showSwitchMode}
        onClose={() => {
          triggerHaptic('light');
          setShowSwitchMode(false);
        }}
        onConfirm={confirmSwitchToMonitor}
        title="Переключить на Мониторинг"
        message="Вы уверены что хотите переключиться на режим Мониторинг? Скопированные товары останутся в вашем каталоге."
        confirmText="Переключить"
      />

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => {
          triggerHaptic('light');
          setShowDelete(false);
        }}
        onConfirm={handleDelete}
        title="Удалить подписку"
        message="Вы уверены что хотите удалить эту подписку? Это действие нельзя отменить."
        confirmText="Удалить"
        danger={true}
      />
    </div>
  );
};

export default FollowDetail;
