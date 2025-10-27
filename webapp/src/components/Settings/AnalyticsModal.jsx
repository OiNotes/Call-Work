import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PageHeader from '../common/PageHeader';
import { useApi } from '../../hooks/useApi';
import { useBackButton } from '../../hooks/useBackButton';
import { useTelegram } from '../../hooks/useTelegram';

export default function AnalyticsModal({ isOpen, onClose }) {
  const { get } = useApi();
  const { triggerHaptic } = useTelegram();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('7d'); // '7d', '1m', 'custom'
  const [analytics, setAnalytics] = useState(null);
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const formatUSD = useCallback((amount = 0, fractionDigits = 2) => {
    const value = Number(amount) || 0;
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }, []);

  const handleClose = useCallback(() => {
    triggerHaptic('light');
    onClose();
  }, [onClose, triggerHaptic]);

  useBackButton(isOpen ? handleClose : null);

  // Calculate date range based on period
  const getDateRange = useCallback(() => {
    const today = new Date();
    const to = today.toISOString().split('T')[0];

    if (period === 'custom') {
      if (customRange.from && customRange.to) {
        return { from: customRange.from, to: customRange.to };
      }
      return null;
    }

    let from;
    if (period === '7d') {
      const date = new Date(today);
      date.setDate(date.getDate() - 7);
      from = date.toISOString().split('T')[0];
    } else if (period === '1m') {
      const date = new Date(today);
      date.setMonth(date.getMonth() - 1);
      from = date.toISOString().split('T')[0];
    }

    return { from, to };
  }, [period, customRange]);

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    const range = getDateRange();
    if (!range) {
      console.warn('[AnalyticsModal] Пропущен запрос — кастомный период без дат', {
        period,
        customRange,
      });
      return;
    }

    const { from, to } = range;

    console.info('[AnalyticsModal] fetch start', { from, to, period });

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await get(`/orders/analytics?from=${from}&to=${to}`);

      if (error) {
        console.error('Analytics fetch error:', error);
        setError(error);
      } else if (data?.success && data?.data) {
        console.info('[AnalyticsModal] fetch success', {
          totalOrders: data.data.summary?.totalOrders,
          topProducts: data.data.topProducts?.length,
        });
        setAnalytics(data.data);
      } else {
        console.error('Unexpected API response:', data);
        setError('Не удалось загрузить статистику');
      }
    } catch (err) {
      console.error('[AnalyticsModal] fetch exception', err);
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      console.info('[AnalyticsModal] fetch finished');
      setLoading(false);
    }
  }, [get, getDateRange]);

  // Fetch on mount and period change
  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen, period, fetchAnalytics]);

  const handlePeriodChange = (newPeriod) => {
    triggerHaptic('light');
    setPeriod(newPeriod);
    if (newPeriod === 'custom') {
      setShowCustomPicker(true);
    }
    if (newPeriod !== 'custom') {
      setShowCustomPicker(false);
    }
  };

  const handleCustomRangeApply = () => {
    if (!customRange.from || !customRange.to) {
      return;
    }

    triggerHaptic('medium');
    setShowCustomPicker(false);
    fetchAnalytics();
  };

  // Loading skeleton
  if (loading) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-dark-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PageHeader title="Статистика" onBack={handleClose} />
            <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)', paddingBottom: 'var(--tabbar-total)' }} className="px-4">
              {/* Hero skeleton */}
              <div className="glass-card p-6 mt-4 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/3 mb-4" />
                <div className="h-12 bg-gray-700 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-700 rounded w-1/4" />
              </div>

              {/* Buttons skeleton */}
              <div className="flex gap-2 mt-4 animate-pulse">
                <div className="h-11 bg-gray-700 rounded-xl flex-1" />
                <div className="h-11 bg-gray-700 rounded-xl flex-1" />
                <div className="h-11 bg-gray-700 rounded-xl flex-1" />
              </div>

              {/* Products skeleton */}
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card p-4 mt-3 animate-pulse">
                  <div className="h-4 bg-gray-700 rounded w-2/3 mb-2" />
                  <div className="h-2 bg-gray-700 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-700 rounded w-1/4" />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Error state
  if (error) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-dark-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PageHeader title="Статистика" onBack={handleClose} />
            <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }} className="px-4 py-8 text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button onClick={fetchAnalytics} className="bg-orange-primary text-white px-6 py-3 rounded-xl">
                Попробовать снова
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  const { summary, topProducts } = analytics || {};
  const maxRevenue = topProducts?.length > 0 ? topProducts[0].revenue : 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-dark-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PageHeader title="Статистика" onBack={handleClose} />

            <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)', paddingBottom: 'var(--tabbar-total)' }} className="px-4 overflow-y-auto h-full">
              {/* Hero Card */}
              <motion.div
                className="glass-card p-6 mt-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <p className="text-sm text-gray-400 mb-2">Общие продажи</p>
                <h1 className="text-4xl font-bold text-orange-primary mb-1">
                  {formatUSD(summary?.totalRevenue)}
                </h1>
                <p className="text-sm text-gray-400">
                  {summary?.completedOrders || 0} заказов • Средний чек: {formatUSD(summary?.avgOrderValue)}
                </p>
              </motion.div>

              {/* Period Selector */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handlePeriodChange('7d')}
                  className={`period-btn flex-1 ${period === '7d' ? 'active' : ''}`}
                >
                  7 дней
                </button>
                <button
                  onClick={() => handlePeriodChange('1m')}
                  className={`period-btn flex-1 ${period === '1m' ? 'active' : ''}`}
                >
                  Месяц
                </button>
                <button
                  onClick={() => handlePeriodChange('custom')}
                  className={`period-btn flex-1 ${period === 'custom' ? 'active' : ''}`}
                >
                  Период ▼
                </button>
              </div>

              {/* Top Products */}
              <div className="mt-6 mb-4">
                <h2 className="text-lg font-semibold text-white mb-4">Топ товары</h2>

                {topProducts && topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {topProducts.map((product, index) => (
                      <motion.div
                        key={product.id}
                        className="glass-card p-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-white font-medium">{product.name}</span>
                          <span className="text-orange-primary font-bold">
                            {formatUSD(product.revenue, 2)}
                          </span>
                        </div>

                        {/* Bar Chart */}
                        <div className="bar-container mb-2">
                          <motion.div
                            className="bar-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${(product.revenue / maxRevenue) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
                          />
                        </div>

                        <p className="text-xs text-gray-400">{product.quantity} шт продано</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="glass-card p-8 text-center">
                    <p className="text-gray-400">Нет данных за выбранный период</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Custom Date Range Picker */}
          {showCustomPicker && (
            <motion.div
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end"
              style={{ padding: '0 16px calc(var(--tabbar-total) + 20px)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomPicker(false)}
            >
              <motion.div
                className="w-full max-w-xl mx-auto bg-dark-elevated rounded-3xl p-6 shadow-2xl"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-white mb-4">Выбор периода</h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">С</label>
                    <input
                      type="date"
                      value={customRange.from}
                      onChange={(e) => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
                      className="w-full bg-dark-bg text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-orange-primary outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">До</label>
                    <input
                      type="date"
                      value={customRange.to}
                      onChange={(e) => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
                      className="w-full bg-dark-bg text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-orange-primary outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCustomPicker(false)}
                    className="flex-1 bg-dark-bg text-white px-4 py-3 rounded-xl font-medium"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleCustomRangeApply}
                    className="flex-1 bg-orange-primary text-white px-4 py-3 rounded-xl font-medium"
                    disabled={!customRange.from || !customRange.to}
                  >
                    Применить
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
