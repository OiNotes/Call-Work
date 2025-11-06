import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useStore } from '../store/useStore';
import {
  initTelegramApp,
  showMainButton,
  hideMainButton,
  showBackButton,
  hideBackButton,
  hapticFeedback,
  showPopup,
  closeApp
} from '../utils/telegram';

const TelegramContext = createContext(null);

/**
 * TelegramProvider - единый контекст для Telegram WebApp
 * Инициализируется ОДИН РАЗ на весь app, вместо создания хука в каждом компоненте
 */
export function TelegramProvider({ children }) {
  const [telegramData, setTelegramData] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState(null);
  const initializationRef = useRef(false);

  const waitForTelegramSDK = useCallback(async (maxRetries = 10, delay = 200) => {
    for (let i = 0; i < maxRetries; i++) {
      console.log(`Attempt ${i + 1}/${maxRetries}: Checking for Telegram SDK...`);

      if (window.Telegram?.WebApp) {
        console.log('✅ Telegram SDK found!');
        const data = initTelegramApp();
        if (data) {
          return data;
        }
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }

    console.error('❌ Telegram SDK not found after', maxRetries, 'retries');
    return null;
  }, []);

  const validateTelegramAuth = useCallback(async (initData) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

      const response = await axios.post(
        `${API_URL}/auth/telegram-validate`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': initData
          }
        }
      );

      const { user, token } = response.data;

      // Use getState() for stable reference
      const { setUser, setToken } = useStore.getState();
      setUser(user);
      setToken(token);

      console.log('✅ Telegram authentication successful:', user);
      setError(null);

    } catch (err) {
      console.error('❌ Telegram auth validation failed:', err);
      const errorMessage = err.response?.data?.error || err.message;
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []); // Stable forever

  useEffect(() => {
    console.log('🔄 Initializing Telegram WebApp...');

    // ✅ CRITICAL: Prevent multiple initializations across components
    if (initializationRef.current) {
      console.log('⏭️ Already initialized, skipping...');
      return;
    }

    initializationRef.current = true;

    async function initialize() {
      try {
        // Wait for Telegram SDK to load (retry logic)
        const data = await waitForTelegramSDK();

        if (!data) {
          throw new Error('Telegram SDK not loaded after retries');
        }

        setTelegramData(data);
        console.log('✅ Telegram SDK loaded successfully', {
          hasInitData: !!data?.tg?.initData,
          platform: data?.platform,
          version: data?.version
        });

        // Validate initData with backend
        if (data?.tg?.initData) {
          console.log('🔐 Validating initData with backend...');
          await validateTelegramAuth(data.tg.initData);
        } else {
          // Development mode or missing initData
          if (import.meta.env.DEV) {
            console.warn('⚠️ No Telegram initData - running in dev mode');
            setError(null);
          } else {
            console.error('❌ No initData available');
            setError('No initData available. Please open this app from Telegram bot.');
          }
        }

        setIsReady(true);
      } catch (err) {
        console.error('❌ Telegram initialization error:', err);
        setError(err.message);
        setIsReady(true);
      } finally {
        setIsValidating(false);
      }
    }

    initialize();
  }, [validateTelegramAuth, waitForTelegramSDK]); // Runs ONCE per app

  // Main Button
  const setMainButton = useCallback((text, onClick) => {
    showMainButton(text, onClick);
  }, []);

  const removeMainButton = useCallback(() => {
    hideMainButton();
  }, []);

  // Back Button
  const setBackButton = useCallback((onClick) => {
    showBackButton(onClick);
  }, []);

  const removeBackButton = useCallback(() => {
    hideBackButton();
  }, []);

  // Haptic Feedback
  const triggerHaptic = useCallback((type = 'light') => {
    hapticFeedback(type);
  }, []);

  // Popup
  const openPopup = useCallback(async (params) => {
    return await showPopup(params);
  }, []);

  // Close App
  const close = useCallback(() => {
    closeApp();
  }, []);

  // Confirm dialog
  const confirm = useCallback(async (message) => {
    const result = await showPopup({
      title: 'Подтверждение',
      message,
      buttons: [
        { id: 'ok', type: 'ok', text: 'Да' },
        { id: 'cancel', type: 'cancel', text: 'Отмена' }
      ]
    });
    return result === 'ok';
  }, []);

  // Alert dialog
  const alert = useCallback(async (message, title = 'Внимание') => {
    await showPopup({
      title,
      message,
      buttons: [{ id: 'ok', type: 'close', text: 'OK' }]
    });
  }, []);

  // ✅ CRITICAL: Memoize value to prevent re-renders
  const value = useMemo(() => ({
    // Data
    user: telegramData?.user,
    tg: telegramData?.tg,
    platform: telegramData?.platform,
    version: telegramData?.version,
    isReady,
    isValidating,
    error,

    // Methods (all stable via useCallback)
    setMainButton,
    removeMainButton,
    setBackButton,
    removeBackButton,
    triggerHaptic,
    openPopup,
    confirm,
    alert,
    close,
  }), [
    telegramData,
    isReady,
    isValidating,
    error,
    setMainButton,
    removeMainButton,
    setBackButton,
    removeBackButton,
    triggerHaptic,
    openPopup,
    confirm,
    alert,
    close,
  ]);

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

/**
 * useTelegram hook - теперь использует контекст вместо создания нового экземпляра
 * Возвращает стабильные ссылки на весь app
 */
export function useTelegram() {
  const context = useContext(TelegramContext);
  if (!context) {
    throw new Error('useTelegram must be used within TelegramProvider');
  }
  return context;
}
