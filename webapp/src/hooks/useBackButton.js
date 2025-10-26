import { useEffect } from 'react';
import { useTelegram } from './useTelegram';

/**
 * Hook для управления Telegram BackButton API
 *
 * Автоматически показывает BackButton при монтировании компонента
 * и скрывает при размонтировании. Вызывает callback при клике.
 *
 * @param {Function} onBack - Callback функция для обработки клика на BackButton
 *
 * @example
 * ```jsx
 * function MyPage() {
 *   const navigate = useNavigate();
 *   useBackButton(() => navigate(-1));
 *
 *   return <div>Content</div>;
 * }
 * ```
 */
export function useBackButton(onBack) {
  const { tg } = useTelegram();

  useEffect(() => {
    if (!tg) return;

    if (typeof onBack !== 'function') {
      tg.BackButton.hide();
      return undefined;
    }

    const handler = () => onBack();

    tg.BackButton.show();
    tg.BackButton.onClick(handler);

    return () => {
      tg.BackButton.offClick(handler);
      tg.BackButton.hide();
    };
  }, [tg, onBack]);
}
