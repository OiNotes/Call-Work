import { useState, useEffect, useCallback } from 'react';
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

/**
 * Hook для работы с Telegram WebApp SDK
 * Includes automatic initData validation and JWT token generation
 * @returns {Object} Объект с методами и данными Telegram
 */
export function useTelegram() {
  const [telegramData, setTelegramData] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState(null);

  const { setUser, setToken } = useStore();

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

      // Wait before next retry
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

      // Save to store
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
  }, [setUser, setToken]);

  useEffect(() => {
    async function initialize() {
      try {
        console.log('🔄 Initializing Telegram WebApp...');

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
            console.log('Debug info:', {
              hasTelegram: !!window.Telegram,
              hasWebApp: !!window.Telegram?.WebApp,
              initData: window.Telegram?.WebApp?.initData,
              initDataUnsafe: window.Telegram?.WebApp?.initDataUnsafe
            });
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
  }, [validateTelegramAuth, waitForTelegramSDK]);

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

  return {
    // Data
    user: telegramData?.user,
    tg: telegramData?.tg,
    platform: telegramData?.platform,
    version: telegramData?.version,
    isReady,
    isValidating,
    error,

    // Methods
    setMainButton,
    removeMainButton,
    setBackButton,
    removeBackButton,
    triggerHaptic,
    openPopup,
    confirm,
    alert,
    close,
  };
}
