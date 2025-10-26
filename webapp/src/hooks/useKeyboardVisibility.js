import { useEffect, useState } from 'react';
import { useTelegram } from './useTelegram';

/**
 * Hook для отслеживания видимости клавиатуры в Telegram WebApp
 * @returns {boolean} keyboardVisible - true если клавиатура показана
 */
export function useKeyboardVisibility() {
  const { tg } = useTelegram();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!tg?.onEvent) return;

    const handleViewportChanged = (data) => {
      // Telegram API: когда клавиатура появляется, viewport.isExpanded === false
      // isExpanded: true - полный viewport, false - клавиатура видна
      setKeyboardVisible(!data.isExpanded);
    };

    tg.onEvent('viewportChanged', handleViewportChanged);

    return () => {
      if (tg?.offEvent) {
        tg.offEvent('viewportChanged', handleViewportChanged);
      }
    };
  }, [tg]);

  return keyboardVisible;
}
