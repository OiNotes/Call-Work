import { useEffect, useState } from 'react';
import { applyPlatformClasses, normalizePlatform } from '../utils/platform';

function readPlatform() {
  const tgPlatform = window.Telegram?.WebApp?.platform;
  return normalizePlatform(tgPlatform || 'unknown');
}

export function usePlatform() {
  const [platform, setPlatform] = useState(() => readPlatform());

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    const updatePlatform = () => {
      const next = readPlatform();
      setPlatform((prev) => {
        if (prev === next) {
          return prev;
        }
        return next;
      });
      applyPlatformClasses(next);
    };

    updatePlatform();

    tg?.onEvent?.('safeAreaChanged', updatePlatform);
    tg?.onEvent?.('viewportChanged', updatePlatform);
    tg?.onEvent?.('themeChanged', updatePlatform);

    return () => {
      tg?.offEvent?.('safeAreaChanged', updatePlatform);
      tg?.offEvent?.('viewportChanged', updatePlatform);
      tg?.offEvent?.('themeChanged', updatePlatform);
    };
  }, []);

  useEffect(() => {
    applyPlatformClasses(platform);
  }, [platform]);

  return platform;
}
