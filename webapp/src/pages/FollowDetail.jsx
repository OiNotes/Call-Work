import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useFollowsApi } from '../hooks/useApi';
import ProductList from '../components/Follows/ProductList';
import EditMarkupModal from '../components/Follows/EditMarkupModal';
import ConfirmDialog from '../components/Follows/ConfirmDialog';
import { useTelegram } from '../hooks/useTelegram';

const FollowDetail = () => {
  const followsApi = useFollowsApi();
  const { triggerHaptic } = useTelegram();
  const { followDetailId, setFollowDetailId, currentFollow, setCurrentFollow, followProducts, setFollowProducts } = useStore();

  const [loading, setLoading] = useState(true);
  const [showEditMarkup, setShowEditMarkup] = useState(false);
  const [showSwitchMode, setShowSwitchMode] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [newMode, setNewMode] = useState(null);

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
        followsApi.getProducts(followDetailId, { limit: 25 })
      ]);

      const follow = followData?.data || followData;
      const productsPayload = productsData?.data || productsData;

      setCurrentFollow(follow);
      setFollowProducts(productsPayload.products || []);
    } catch (error) {
      console.error('Error loading follow detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMarkup = async (markup) => {
    try {
      await followsApi.updateMarkup(followDetailId, markup);
      await loadData(); // Перезагрузить данные
      triggerHaptic('success');
    } catch (error) {
      console.error('Error updating markup:', error);
      triggerHaptic('error');
    }
  };

  const handleSwitchMode = async () => {
    const targetMode = currentFollow.mode === 'monitor' ? 'resell' : 'monitor';
    setNewMode(targetMode);
    setShowSwitchMode(true);
  };

  const confirmSwitchMode = async () => {
    try {
      let markup = null;

      // Если переключаем на Resell - запросить наценку
      if (newMode === 'resell') {
        const value = prompt('Введите наценку (1-500%):');
        markup = parseInt(value, 10);

        if (isNaN(markup) || markup < 1 || markup > 500) {
          alert('Некорректная наценка');
          return;
        }
      }

      await followsApi.switchMode(followDetailId, newMode, markup);
      await loadData(); // Перезагрузить данные
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
      setFollowDetailId(null); // Вернуться назад
    } catch (error) {
      console.error('Error deleting follow:', error);
      triggerHaptic('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  if (!currentFollow) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-white">Подписка не найдена</div>
      </div>
    );
  }

  const modeLabel = currentFollow.mode === 'monitor' ? 'Мониторинг' : 'Перепродажа';
  const modeEmoji = currentFollow.mode === 'monitor' ? '🔍' : '💰';

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-20">
      {/* Header */}
      <div className="bg-[#1A1A1A] p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              triggerHaptic('light');
              setFollowDetailId(null);
            }}
            className="text-[#FF6B00]"
          >
            ← Назад
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏪</span>
            <h1 className="text-lg font-bold">{currentFollow.source_shop_name}</h1>
          </div>
        </div>
      </div>

      {/* Info Block */}
      <div className="p-4">
        <div className="bg-[#1A1A1A] rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span>{modeEmoji}</span>
            <span className="text-white font-semibold">{modeLabel}</span>
            {currentFollow.mode === 'resell' && currentFollow.markup_percentage && (
              <span className="text-[#FF6B00]">+{currentFollow.markup_percentage}%</span>
            )}
          </div>

          <div className="text-sm text-gray-400 space-y-1">
            <div>Товаров в их каталоге: {currentFollow.source_products_count || 0}</div>
            {currentFollow.mode === 'resell' && (
              <div>Скопировано к вам: {currentFollow.synced_products_count || 0}</div>
            )}
          </div>
        </div>

        {/* Products List */}
        <div className="mb-4">
          <h2 className="text-lg font-bold mb-3">Каталог товаров</h2>
          <ProductList products={followProducts} mode={currentFollow.mode} />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {currentFollow.mode === 'resell' && (
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowEditMarkup(true);
              }}
              className="w-full bg-[#FF6B00] text-white py-3 rounded-xl font-semibold"
            >
              Изменить наценку
            </button>
          )}

          <button
            onClick={() => {
              triggerHaptic('light');
              handleSwitchMode();
            }}
            className="w-full bg-[#1A1A1A] text-white py-3 rounded-xl font-semibold border border-gray-700"
          >
            Сменить режим на {currentFollow.mode === 'monitor' ? 'Перепродажу' : 'Мониторинг'}
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setShowDelete(true);
            }}
            className="w-full bg-red-600/20 text-red-500 py-3 rounded-xl font-semibold border border-red-600/50"
          >
            Удалить подписку
          </button>
        </div>
      </div>

      {/* Modals */}
      <EditMarkupModal
        isOpen={showEditMarkup}
        onClose={() => setShowEditMarkup(false)}
        currentMarkup={currentFollow.markup_percentage}
        onSave={handleSaveMarkup}
      />

      <ConfirmDialog
        isOpen={showSwitchMode}
        onClose={() => setShowSwitchMode(false)}
        onConfirm={confirmSwitchMode}
        title="Сменить режим"
        message={`Переключить на режим ${newMode === 'monitor' ? 'Мониторинг' : 'Перепродажа'}?`}
        confirmText="Переключить"
      />

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
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
