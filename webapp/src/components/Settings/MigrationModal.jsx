import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClockIcon } from '@heroicons/react/24/outline';
import PageHeader from '../common/PageHeader';
import { useTelegram } from '../../hooks/useTelegram';
import { useBackButton } from '../../hooks/useBackButton';
import { useApi } from '../../hooks/useApi';

export default function MigrationModal({ isOpen, onClose }) {
  const { triggerHaptic, confirm, alert } = useTelegram();
  const { get, post } = useApi();
  const [step, setStep] = useState(1); // 1: info, 2: eligibility, 3: input, 4: result
  const [newChannel, setNewChannel] = useState('');
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [shop, setShop] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [migrationError, setMigrationError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [channelError, setChannelError] = useState(null);

  /**
   * Parse and validate Telegram channel input
   * Removes common prefixes and validates format
   * Returns { isValid, cleaned, error }
   */
  /**
   * Get proper Russian declension for "days"
   * 1 день, 2 дня, 5 дней
   */
  const getDaysLabel = (count) => {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return 'дней';
    }
    
    if (lastDigit === 1) {
      return 'день';
    }
    
    if (lastDigit >= 2 && lastDigit <= 4) {
      return 'дня';
    }
    
    return 'дней';
  };

  const parseChannelInput = (input) => {
    if (!input || !input.trim()) {
      return {
        isValid: false,
        cleaned: '',
        error: 'Введите название канала'
      };
    }

    // Remove common prefixes
    let cleaned = input.trim();
    cleaned = cleaned.replace(/^https?:\/\//, ''); // Remove https://
    cleaned = cleaned.replace(/^t\.me\//, '');      // Remove t.me/
    cleaned = cleaned.replace(/^@/, '');             // Remove @
    
    // Validate format: 5-32 characters, alphanumeric + underscore
    const channelRegex = /^[a-zA-Z0-9_]{5,32}$/;
    
    if (!channelRegex.test(cleaned)) {
      let error = 'Неверный формат канала';
      
      if (cleaned.length < 5) {
        error = 'Минимум 5 символов';
      } else if (cleaned.length > 32) {
        error = 'Максимум 32 символа';
      } else {
        error = 'Только латиница, цифры и _ (подчеркивание)';
      }
      
      return {
        isValid: false,
        cleaned,
        error
      };
    }
    
    return {
      isValid: true,
      cleaned: `@${cleaned}`, // Add @ prefix back for consistency
      error: null
    };
  };

  // Back button support
  useBackButton(isOpen, () => {
    if (step > 1) {
      setStep(step - 1);
      setMigrationError(null); // Очистить migration error при возврате
    } else {
      onClose();
    }
  });

  // Step 2: Check eligibility when opening modal
  useEffect(() => {
    if (isOpen) {
      checkEligibility();
    }
  }, [isOpen]);

  const checkEligibility = async () => {
    setLoading(true);
    setErrorMessage(null); // Сброс ошибки перед проверкой

    try {
      // Get user's shop
      const { data: shopsResponse, error: shopsError } = await get('/shops/my', {
        timeout: 10000  // 10 second timeout to prevent infinite loading
      });

      if (shopsError) {
        setErrorMessage('Ошибка загрузки магазина. Попробуйте позже.');
        setStep(1);
        return;
      }

      const shops = Array.isArray(shopsResponse?.data) ? shopsResponse.data : [];

      if (!shops.length) {
        setErrorMessage('У вас нет магазина. Создайте магазин через бота.');
        setStep(1);
        return;
      }

      const primaryShop = shops[0];
      setShop(primaryShop);

      // Check migration eligibility
      const { data: eligibilityData, error: eligibilityError } = await get(`/shops/${primaryShop.id}/migration/check`, {
        timeout: 10000  // 10 second timeout to prevent infinite loading
      });

      if (eligibilityError) {
        setErrorMessage('Ошибка проверки прав на миграцию. Попробуйте позже.');
        setStep(1);
        return;
      }

      setEligibility(eligibilityData);

      if (!eligibilityData?.eligible) {
        const reason = eligibilityData?.reason || eligibilityData?.message || 'Миграция недоступна';
        setErrorMessage(reason);
        setStep(1);
        return;
      }

      // Success - переход к step 3 (input)
      setStep(3);

    } catch (err) {
      console.error('Eligibility check failed:', err);
      setErrorMessage('Ошибка проверки прав. Попробуйте позже.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    triggerHaptic('light');
    setStep(step + 1);
  };



  const handleMigrate = async () => {
    setMigrationError(null);
    
    // Validate and clean channel input
    const { isValid, cleaned, error } = parseChannelInput(newChannel);
    
    if (!isValid) {
      setChannelError(error);
      await alert(error || 'Неверный формат канала');
      return;
    }

    const confirmed = await confirm(
      `Отправить уведомления всем ${eligibility?.subscriberCount || 0} подписчикам о миграции на новый канал?`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const { data, error } = await post(`/shops/${shop.id}/migration`, {
        newChannelUrl: cleaned, // Use cleaned value
        oldChannelUrl: shop.channel_url
      });

      if (error) {
        setMigrationError(error || 'Ошибка миграции');
        setLoading(false);
        return;
      }

      setMigrationResult(data);
      setStep(4);
      triggerHaptic('success');

      // Haptic feedback для успеха
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      // Автоматическое закрытие через 3 секунды с countdown
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            onClose();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Migration failed:', err);
      setMigrationError('Ошибка миграции. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-dark-bg overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <PageHeader
            title={step === 1 ? 'Миграция канала' : step === 2 ? 'Проверка прав' : step === 3 ? 'Новый канал' : 'Готово'}
            onBack={step === 1 ? onClose : () => setStep(step - 1)}
          />

          <div
            className="px-4 py-6 pb-20"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 72px)' }}
          >
            {loading && step === 2 ? (
              // Loading state
              <motion.div
                className="flex flex-col items-center justify-center py-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="w-16 h-16 border-4 border-orange-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-400">Проверяем права на миграцию...</p>
              </motion.div>
            ) : step === 1 ? (
              // Info screen
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Error Message */}
                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-red-400 text-sm mb-3">{errorMessage}</p>
                        
                        {/* Retry Button */}
                        <motion.button
                          onClick={async () => {
                            setErrorMessage(null);
                            triggerHaptic('light');
                            setStep(2); // Перейти в loading state
                            await checkEligibility();
                          }}
                          disabled={loading}
                          className="text-sm text-orange-500 hover:text-orange-400 disabled:opacity-50
                                     font-medium flex items-center gap-2 transition-colors"
                          whileTap={!loading ? { scale: 0.95 } : {}}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {loading ? 'Проверяем...' : 'Попробовать снова'}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-orange-primary/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-white">Канал заблокирован?</h2>
                  </div>

                  <div className="space-y-4 text-gray-300">
                    <p>
                      Функция миграции позволяет уведомить всех ваших подписчиков о переезде на новый канал.
                    </p>

                    <div className="bg-white/5 rounded-xl p-4 space-y-3">
                      <h3 className="font-semibold text-white">Как это работает:</h3>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <span className="text-orange-primary mt-0.5">1.</span>
                          <span>Вы указываете новый канал</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-orange-primary mt-0.5">2.</span>
                          <span>Система отправляет уведомления всем подписчикам</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-orange-primary mt-0.5">3.</span>
                          <span>Старый магазин автоматически деактивируется</span>
                        </li>
                      </ul>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                      <p className="text-yellow-400 text-sm">
                        ⚠️ Внимание: это действие нельзя отменить. Убедитесь, что новый канал готов к приёму подписчиков.
                      </p>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                      <h3 className="font-semibold text-white mb-2">Требования:</h3>
                      <ul className="space-y-1 text-sm text-blue-400">
                        <li>✓ PRO подписка активна</li>
                        <li>✓ Нет недавних миграций (1 раз в 30 дней)</li>
                      </ul>
                    </div>

                    {/* Rate Limit Info */}
                    {eligibility?.limits && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl"
                      >
                        <div className="flex items-start gap-3">
                          <ClockIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-blue-400 mb-2">
                              Информация о лимитах
                            </h4>
                            
                            {eligibility.limits.lastMigrationDate && (
                              <p className="text-sm text-gray-300 mb-2">
                                Последняя миграция: {' '}
                                <span className="text-white font-medium">
                                  {new Date(eligibility.limits.lastMigrationDate).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                  })}
                                </span>
                              </p>
                            )}
                            
                            {eligibility.limits.daysUntilNext > 0 ? (
                              <>
                                <p className="text-sm text-gray-300 mb-3">
                                  Следующая миграция доступна через: {' '}
                                  <span className="text-orange-500 font-medium">
                                    {eligibility.limits.daysUntilNext} {getDaysLabel(eligibility.limits.daysUntilNext)}
                                  </span>
                                </p>
                                
                                {/* Progress bar */}
                                <div className="mt-3">
                                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ 
                                        width: `${Math.max(0, Math.min(100, 
                                          ((30 - eligibility.limits.daysUntilNext) / 30) * 100
                                        ))}%` 
                                      }}
                                      transition={{ duration: 0.8, ease: 'easeOut' }}
                                      className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {30 - eligibility.limits.daysUntilNext} из 30 дней прошло
                                  </p>
                                </div>
                              </>
                            ) : (
                              <p className="text-sm text-green-400 font-medium">
                                ✓ Миграция доступна прямо сейчас
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                <motion.button
                  onClick={handleNext}
                  disabled={eligibility?.limits?.daysUntilNext > 0}
                  className="w-full h-12 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: eligibility?.limits?.daysUntilNext > 0
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)'
                  }}
                  whileTap={eligibility?.limits?.daysUntilNext > 0 ? {} : { scale: 0.98 }}
                >
                  {eligibility?.limits?.daysUntilNext > 0 
                    ? `Доступно через ${eligibility.limits.daysUntilNext} ${getDaysLabel(eligibility.limits.daysUntilNext)}`
                    : 'Продолжить'
                  }
                </motion.button>
              </motion.div>
            ) : step === 3 ? (
              // Input screen
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Migration Error Message */}
                {migrationError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-red-400 text-sm mb-3">{migrationError}</p>
                        
                        {/* Retry Button */}
                        <motion.button
                          onClick={async () => {
                            setMigrationError(null);
                            triggerHaptic('light');
                            await handleMigrate();
                          }}
                          disabled={loading || !newChannel.trim() || channelError !== null}
                          className="text-sm text-orange-500 hover:text-orange-400 disabled:opacity-50
                                     font-medium flex items-center gap-2 transition-colors"
                          whileTap={!loading && newChannel.trim() && !channelError ? { scale: 0.95 } : {}}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {loading ? 'Отправка...' : 'Попробовать снова'}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="glass-card rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-white mb-4">Новый канал</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Telegram канал
                      </label>
                      <input
                        type="text"
                        value={newChannel}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewChannel(value);
                          
                          // Real-time validation
                          if (value) {
                            const { isValid, error } = parseChannelInput(value);
                            setChannelError(error);
                          } else {
                            setChannelError(null);
                          }
                        }}
                        placeholder="@your_channel или https://t.me/your_channel"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-orange-primary transition-colors"
                        autoFocus
                      />

                      {/* Validation Error */}
                      {channelError && (
                        <motion.p
                          className="text-red-400 text-sm mt-2 flex items-center gap-2"
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {channelError}
                        </motion.p>
                      )}

                      {/* Helper Text */}
                      {!channelError && newChannel && (
                        <motion.div
                          className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl"
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <p className="text-sm text-green-400">
                            ✓ Канал будет сохранён как: <strong>{parseChannelInput(newChannel).cleaned}</strong>
                          </p>
                        </motion.div>
                      )}

                      {!newChannel && (
                        <p className="text-gray-500 text-sm mt-2">
                          Формат: @channel_name или https://t.me/channel_name
                        </p>
                      )}
                    </div>

                    {eligibility && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <p className="text-blue-400 text-sm">
                          📊 Уведомления получат {eligibility.subscriberCount || 0} подписчиков
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <motion.button
                  onClick={handleMigrate}
                  disabled={loading || !newChannel.trim() || channelError !== null}
                  className="w-full h-12 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: (!loading && newChannel.trim() && !channelError)
                      ? 'linear-gradient(135deg, #FF6B00 0%, #FF8533 100%)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }}
                  whileTap={(!loading && newChannel.trim() && !channelError) ? { scale: 0.98 } : {}}
                >
                  {loading ? 'Отправка уведомлений...' : 'Запустить миграцию'}
                </motion.button>
              </motion.div>
            ) : step === 4 ? (
              // Success screen
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="glass-card rounded-2xl p-6 text-center">
                  <motion.div
                    className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>

                  <h2 className="text-2xl font-bold text-white mb-2">Миграция запущена!</h2>
                  <p className="text-gray-400 mb-4">
                    Уведомления отправляются всем подписчикам
                  </p>

                  {countdown !== null && (
                    <motion.p
                      className="text-sm text-gray-500 mb-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      Закроется через {countdown}...
                    </motion.p>
                  )}

                  {migrationResult && (
                    <div className="space-y-3 text-left">
                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-sm text-gray-400 mb-1">Новый канал:</p>
                        <p className="text-white font-semibold">{migrationResult.newChannelUrl}</p>
                      </div>

                      <div className="bg-white/5 rounded-xl p-4">
                        <p className="text-sm text-gray-400 mb-1">Статус уведомлений:</p>
                        <p className="text-green-400 font-semibold">
                          {migrationResult.notificationsSent || 0} отправлено
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <motion.button
                  onClick={() => {
                    setCountdown(null); // Остановить countdown
                    onClose();
                  }}
                  className="w-full h-12 rounded-xl font-semibold text-white"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)'
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  Закрыть сейчас
                </motion.button>
              </motion.div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
