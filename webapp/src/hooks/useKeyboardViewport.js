import { useEffect } from 'react';

const KEYBOARD_THRESHOLD = 100; // px difference to detect keyboard

/**
 * Hook для управления viewport при открытии клавиатуры в Telegram Mini App
 * - Обновляет --vh-dynamic CSS переменную
 * - Добавляет класс .kb-open на <html> при открытии клавиатуры
 * - Поддержка: Telegram viewportChanged + fallback visualViewport (iOS)
 */
export function useKeyboardViewport() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const html = document.documentElement;

    const setVH = (px) => html.style.setProperty('--vh-dynamic', `${px}px`);
    const setKB = (open) => html.classList.toggle('kb-open', !!open);

    const compute = () => {
      // Всегда пересчитываем stable height (не кешируем)
      const stable = tg?.viewportStableHeight || window.innerHeight;
      const current = 
        tg?.viewportHeight || 
        window.visualViewport?.height || 
        window.innerHeight;
      
      // Определяем открыта ли клавиатура
      const isKB = current < stable - KEYBOARD_THRESHOLD;
      
      // Обновляем CSS переменную и класс
      setVH(current);
      setKB(isKB);
    };

    // Подписка на события Telegram WebApp
    if (tg?.onEvent) {
      tg.onEvent('viewportChanged', compute);
      tg.expand?.();
      compute(); // Initial computation
    } 
    // Fallback для iOS Safari (visualViewport API)
    else if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', compute);
      compute(); // Initial computation
    } 
    // Fallback для других сред
    else {
      setVH(window.innerHeight);
      setKB(false);
    }

    // Cleanup
    return () => {
      tg?.offEvent?.('viewportChanged', compute);
      window.visualViewport?.removeEventListener('resize', compute);
    };
  }, []);
}
