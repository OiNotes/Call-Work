import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '../common/PageHeader';
import { useTelegram } from '../../hooks/useTelegram';
import { useApi } from '../../hooks/useApi';
import { useBackButton } from '../../hooks/useBackButton';

// Product Card Component
function ProductCard({ product, onEdit, onDelete }) {
  const { triggerHaptic, confirm } = useTelegram();

  const handleDelete = async () => {
    triggerHaptic('medium');
    const confirmed = await confirm(`Удалить "${product.name}"?`);
    if (confirmed) {
      triggerHaptic('success');
      onDelete(product.id);
    }
  };

  return (
    <motion.div
      className="glass-card rounded-2xl p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      layout
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-white font-semibold">{product.name}</h3>
            {!product.is_available && (
              <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                Недоступен
              </span>
            )}
            {(product.is_preorder || product.availability === 'preorder') && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-200 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-400/50">
                <span>🔖</span>
                <span>Предзаказ</span>
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-gray-400 text-sm mb-2">{product.description}</p>
          )}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-orange-primary font-bold">
              ${product.price}
            </span>
            <span className="text-gray-500">
              В наличии: {product.stock || 0}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <motion.button
            onClick={() => onEdit(product)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-blue-400"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </motion.button>
          <motion.button
            onClick={handleDelete}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-red-400"
            style={{
              background: 'rgba(255, 59, 48, 0.1)',
              border: '1px solid rgba(255, 59, 48, 0.2)'
            }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// Product Form Component
function ProductForm({ product, formData, setFormData, onSubmit, saving, editingProduct }) {
  return (
    <motion.div
      className="glass-card rounded-2xl p-4 space-y-3"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div>
        <label className="text-sm text-gray-400 mb-2 block">
          Название товара *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Windows 11 Pro"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-primary transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            Цена ($) *
          </label>
          <input
            type="number"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="29.99"
            step="0.01"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-primary transition-colors"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-2 block">
            В наличии
          </label>
          <input
            type="number"
            value={formData.stock}
            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
            placeholder="100"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-primary transition-colors"
          />
        </div>
      </div>

      {/* Inline Save Button */}
      <motion.button
        onClick={onSubmit}
        disabled={!formData.name || !formData.price || saving}
        className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-50 mt-2"
        style={{
          background: formData.name && formData.price
            ? 'linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)'
            : 'rgba(255, 255, 255, 0.1)'
        }}
        whileTap={formData.name && formData.price ? { scale: 0.98 } : {}}
      >
        {saving ? 'Сохранение...' : (editingProduct ? 'Сохранить' : 'Создать')}
      </motion.button>
    </motion.div>
  );
}

// Main Modal Component
export default function ProductsModal({ isOpen, onClose }) {
  const { triggerHaptic, alert } = useTelegram();
  const { fetchApi } = useApi();

  const [showAIChat, setShowAIChat] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [lastAIPrompt, setLastAIPrompt] = useState('');

  const handleOpenAIChat = () => {
    triggerHaptic('medium');
    setShowAIChat(true);
  };

  const handleCloseAIChat = useCallback(() => {
    setShowAIChat(false);
    setAiError(null);
    setLastAIPrompt('');
  }, []);

  const [myShop, setMyShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [limitStatus, setLimitStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    is_available: true
  });

  const mapProduct = useCallback((product) => {
    const stock = product.stock_quantity ?? product.stock ?? 0;
    const isAvailable = product.is_available ?? product.isActive ?? true;
    const availability = !isAvailable ? 'unavailable' : stock > 0 ? 'stock' : 'preorder';

    return {
      ...product,
      price: typeof product.price === 'number' ? product.price : Number(product.price) || 0,
      stock,
      stock_quantity: stock,
      is_available: isAvailable,
      isAvailable,
      isPreorder: availability === 'preorder',
      availability,
    };
  }, []);

  const handleClose = useCallback(() => {
    setShowForm(false);
    setEditingProduct(null);
    setShowAIChat(false);
    onClose();
  }, [onClose]);

  useBackButton(isOpen ? (showAIChat ? handleCloseAIChat : handleClose) : null);

  // Disable vertical swipes when modal is open (Telegram Mini App)
  useEffect(() => {
    if (isOpen && window.Telegram?.WebApp) {
      window.Telegram.WebApp.disableVerticalSwipes();
      return () => {
        window.Telegram.WebApp.enableVerticalSwipes();
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (showAIChat && aiHistory.length === 0) {
      setAiHistory([
        {
          role: 'assistant',
          content: 'Привет! Я AI-ассистент магазина. Напишите, какие товары нужно добавить или изменить — всё сделаю за вас.'
        }
      ]);
    }
  }, [showAIChat, aiHistory.length]);

  const handleSendAIMessage = async (text) => {
    const value = text.trim();
    if (!value) return;

    setLastAIPrompt(value); // Save for retry
    const optimisticHistory = [...aiHistory, { role: 'user', content: value }];
    setAiHistory(optimisticHistory);
    setAiLoading(true);
    setAiError(null);

    try {
      const historyPayload = optimisticHistory.map(({ role, content }) => ({ role, content }));

      const response = await fetchApi('/ai/products/chat', {
        method: 'POST',
        body: JSON.stringify({
          shopId: myShop?.id,
          message: value,
          history: historyPayload
        })
      });

      if (response?.data) {
        const { reply, history: serverHistory, productsChanged } = response.data;
        if (Array.isArray(serverHistory) && serverHistory.length) {
          setAiHistory(serverHistory);
        } else if (reply) {
          setAiHistory((current) => [...current, { role: 'assistant', content: reply }]);
        }

        if (productsChanged) {
          await loadData();
        }
      } else {
        throw new Error('Пустой ответ AI-сервиса');
      }
    } catch (error) {
      const errorMessage = error.message || 'Не удалось обработать запрос. Попробуйте позже.';
      setAiError(errorMessage);
      setAiHistory((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'Не получилось обработать команду. Попробуйте еще раз или сформулируйте иначе.'
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRetryAIMessage = () => {
    if (lastAIPrompt && !aiLoading) {
      triggerHaptic('light');
      handleSendAIMessage(lastAIPrompt);
    }
  };

  const loadData = useCallback(async (signal) => {
    // 1. Load my shop
    const shopsRes = await fetchApi('/shops/my', { signal });

    if (signal?.aborted) return { status: 'aborted' };

    // ✅ FIX: Safe array extraction with validation
    const shops = Array.isArray(shopsRes?.data) ? shopsRes.data : [];
    if (shops.length === 0) {
      return { status: 'error', error: 'Failed to load shop' };
    }

    const shop = shops[0];
    setMyShop(shop);

    // 2. Load products
    const productsRes = await fetchApi(`/products?shopId=${shop.id}`, { signal });

    if (signal?.aborted) return { status: 'aborted' };

    // ✅ FIX: Already safe - keeping as is
    const items = Array.isArray(productsRes?.data) ? productsRes.data : [];
    setProducts(items.map(mapProduct));

    // 3. Load limit status
    const limitRes = await fetchApi(`/products/limit-status/${shop.id}`, { signal });

    if (signal?.aborted) return { status: 'aborted' };

    setLimitStatus(limitRes);
    return { status: 'success' };
  }, [fetchApi, mapProduct]);

  useEffect(() => {
    if (!isOpen) return;
    
    setLoading(true);
    
    const controller = new AbortController();
    
    loadData(controller.signal)
      .then(result => {
        if (!controller.signal.aborted && result?.status === 'error') {
          console.error(result.error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    
    return () => controller.abort();
  }, [isOpen, loadData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMyShop(null);
      setProducts([]);
      setShowForm(false);
      setEditingProduct(null);
      setShowAIChat(false);
      setAiError(null);
      setLastAIPrompt('');
      setFormData({ name: '', description: '', price: '', stock: '', is_available: true });
    }
  }, [isOpen]);

  const handleSubmitProduct = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (!formData.name || !formData.price) {
        return;
      }

      const price = Number(formData.price);
      const stockValue = formData.stock === '' || formData.stock === null || formData.stock === undefined
        ? undefined
        : Number(formData.stock);

      const payload = {
        ...formData,
        price: Number.isFinite(price) ? price : formData.price,
        stock: stockValue,
        stockQuantity: stockValue,
      };

      if (editingProduct) {
        // Edit mode
        await fetchApi(`/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        // Create mode
        if (!myShop?.id) {
          await alert('Не удалось определить магазин');
          return;
        }
        await fetchApi('/products', {
          method: 'POST',
          body: JSON.stringify({ ...payload, shopId: myShop.id })
        });
      }

      triggerHaptic('success');
      await loadData();
      setShowForm(false);
      setEditingProduct(null);
      setFormData({ name: '', description: '', price: '', stock: '', is_available: true });
    } catch (error) {
      await alert(error.message || 'Ошибка сохранения товара');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await fetchApi(`/products/${productId}`, {
        method: 'DELETE'
      });

      triggerHaptic('success');
      await loadData();
    } catch (error) {
      await alert(error.message || 'Ошибка удаления товара');
    }
  };

  // No shop - show empty state
  if (!loading && !myShop) {
    return (
      <AnimatePresence>
        {isOpen && !showAIChat && (
          <motion.div
            className="fixed inset-0 z-50 bg-dark-bg"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <PageHeader title="Мои товары" onBack={handleClose} />
            <div
              className="flex-1 overflow-y-auto"
              style={{
                paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
                paddingBottom: 'calc(var(--tabbar-total) + 100px)',
                maxHeight: '100vh',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch'
              }}
            >
              <div className="px-4 py-6">
                <div className="text-center py-12">
                  <svg
                    className="w-20 h-20 mx-auto mb-4 text-gray-600"
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
                  <h3 className="text-xl font-bold text-white mb-2">
                    У вас еще нет магазина
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">
                    Создайте магазин для продажи товаров
                  </p>
                  <motion.button
                    onClick={() => {
                      triggerHaptic('medium');
                      alert('Создание магазина через бота ($25)');
                    }}
                    className="h-12 px-6 rounded-xl font-semibold text-white"
                    style={{
                      background: 'linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)',
                      boxShadow: '0 4px 16px rgba(255, 107, 0, 0.3)'
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Создать магазин ($25)
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-dark-bg flex flex-col"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <PageHeader
            title="Мои товары"
            onBack={handleClose}
          />
          <div
            className="flex-1 overflow-y-auto"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 56px)',
              paddingBottom: 'calc(var(--tabbar-total) + 100px)',
              maxHeight: '100vh',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="px-4 py-6 space-y-4">
        {/* Add product button */}
        {!showForm && !loading && (
          <motion.button
            onClick={() => {
              if (limitStatus && limitStatus.canAdd) {
                triggerHaptic('light');
                setShowForm(true);
                setEditingProduct(null);
                setFormData({ name: '', description: '', price: '', stock: '', is_available: true });
              } else {
                alert(`Лимит достигнут! Доступно: ${limitStatus?.tier}`);
              }
            }}
            disabled={limitStatus && !limitStatus.canAdd}
            className="w-full h-14 rounded-2xl font-semibold text-white disabled:opacity-50"
            style={{
              background: limitStatus && limitStatus.canAdd
                ? 'linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)'
                : 'rgba(255, 255, 255, 0.1)',
              boxShadow: limitStatus && limitStatus.canAdd ? '0 4px 16px rgba(255, 107, 0, 0.3)' : 'none'
            }}
            whileTap={limitStatus && limitStatus.canAdd ? { scale: 0.98 } : {}}
          >
            + Добавить товар
          </motion.button>
        )}

        {/* Product form */}
        <AnimatePresence>
          {showForm && (
            <ProductForm
              product={editingProduct}
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmitProduct}
              saving={saving}
              editingProduct={editingProduct}
            />
          )}
        </AnimatePresence>

        {/* Products list */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-orange-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : products.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 px-2">
              Список товаров
            </h3>
            <AnimatePresence mode="popLayout">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={(p) => {
                    const mapped = mapProduct(p);
                    setEditingProduct(mapped);
                    setFormData({
                      name: mapped.name || '',
                      description: mapped.description || '',
                      price: mapped.price || '',
                      stock: mapped.stock ?? mapped.stock_quantity ?? '',
                      is_available: mapped.is_available ?? true
                    });
                    setShowForm(true);
                  }}
                  onDelete={handleDeleteProduct}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : !showForm && (
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <h3 className="text-xl font-bold text-white mb-2">
              Управление товарами
            </h3>
            <p className="text-gray-400 text-sm mb-1">
              Добавляйте и редактируйте товары здесь.
            </p>
            <p className="text-gray-400 text-sm mb-6">
              После добавления покупатели увидят их в каталоге.
            </p>

            <motion.button
              onClick={handleOpenAIChat}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl font-medium text-orange-primary"
              style={{
                background: 'rgba(255, 107, 0, 0.1)',
                border: '1px solid rgba(255, 107, 0, 0.3)'
              }}
              whileTap={{ scale: 0.98 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Добавить через AI чат
            </motion.button>
          </div>
        )}
            </div>
          </div>
        </motion.div>
      )}
      {isOpen && showAIChat && (
        <motion.div
          key="ai-chat-panel"
          className="fixed inset-0 z-50 bg-dark-bg"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        >
          <PageHeader title="AI ассистент" onBack={handleCloseAIChat} />
          <div
            className="flex flex-col min-h-screen"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}
          >
            <div className="flex-1 px-4 pt-6 pb-36 overflow-y-auto space-y-4">
              {aiHistory.map((entry, index) => (
                <motion.div
                  key={`${entry.role}-${index}`}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 whitespace-pre-line leading-relaxed ${
                    entry.role === 'user'
                      ? 'ml-auto bg-orange-primary/10 text-orange-primary'
                      : 'mr-auto bg-white/5 text-gray-200 border border-white/10'
                  }`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {entry.content}
                </motion.div>
              ))}

              {aiLoading && (
                <motion.div
                  className="flex items-center gap-2 text-gray-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-primary"></span>
                  </span>
                  Думаю над ответом…
                </motion.div>
              )}

              {aiError && (
                <motion.div
                  className="flex flex-col gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-xs text-red-400">
                    Ошибка: {aiError}
                  </p>
                  <motion.button
                    onClick={handleRetryAIMessage}
                    disabled={aiLoading}
                    className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                    whileTap={!aiLoading ? { scale: 0.98 } : {}}
                  >
                    {aiLoading ? 'Повторная попытка…' : '🔄 Повторить запрос'}
                  </motion.button>
                </motion.div>
              )}
            </div>

            <div
              className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-4 bg-[#0A0A0A] border-t border-white/5 z-50"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
            >
              <AIChatInput
                disabled={aiLoading}
                onSend={handleSendAIMessage}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AIChatInput({ disabled, onSend }) {
  const { triggerHaptic } = useTelegram();
  const [value, setValue] = useState('');

  const handleSubmit = (evt) => {
    evt.preventDefault();
    if (!value.trim() || disabled) return;
    triggerHaptic('light');
    onSend(value);
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl px-4 py-3 flex items-center gap-3 border border-white/10 bg-white/5 backdrop-blur-sm">
      <textarea
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Напишите, что нужно сделать…"
        className="flex-1 resize-none bg-transparent text-base text-white focus:outline-none placeholder:text-gray-400"
        disabled={disabled}
        autoFocus
      />
      <motion.button
        type="submit"
        disabled={disabled || !value.trim()}
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white disabled:opacity-40"
        style={{
          background: 'linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)'
        }}
        whileTap={!disabled && value.trim() ? { scale: 0.94 } : {}}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </motion.button>
    </form>
  );
}
