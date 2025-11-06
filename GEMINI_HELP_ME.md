# GEMINI HELP: React Infinite Re-render Loop

## ПРОБЛЕМА
React приложение (Telegram Mini App) имеет бесконечные циклы re-render. Компоненты многократно монтируются/размонтируются, что приводит к:
- Спиннер загрузки не исчезает
- useTelegram() инициализируется 10+ раз
- useEffect запускается в бесконечном цикле
- Запросы к API постоянно отменяются (CanceledError)

## СИМПТОМЫ ИЗ КОНСОЛИ

```
🔄 Initializing Telegram WebApp... (повторяется 10+ раз)

[Subscriptions] 🔴 CLEANUP - aborting controller
[Subscriptions] 🔵 useEffect triggered {token: true}
[Subscriptions] 🔵 START loadSubscriptions
[Subscriptions] 🟡 ABORTED
(цикл повторяется ~12 раз)

[Catalog] 🔴 CLEANUP - aborting controller
[Catalog] 🔵 useEffect triggered
[Catalog] 🔵 START loadMyShop
[Catalog] 🟡 loadMyShop ABORTED
(цикл повторяется ~8 раз)

API GET /subscriptions/my-shops error: CanceledError
API GET /shops/my error: CanceledError
API GET /products error: CanceledError
```

## ЧТО УЖЕ ИСПРАВЛЕНО (НО НЕ ПОМОГЛО)

1. ✅ ProductGrid.jsx - хуки перемещены в начало компонента (React Error #310)
2. ✅ Subscriptions.jsx - переключение с useShopApi() на useApi()
3. ✅ useTelegram.js - использование useStore.getState() вместо деструктуризации
4. ✅ Catalog.jsx - использование useStore.getState()
5. ✅ App.jsx - использование useStore.getState()
6. ✅ Follows.jsx - использование useStore.getState()
7. ✅ FollowDetail.jsx - использование useStore.getState()

**НО ПРОБЛЕМА ОСТАЛАСЬ!**

## КЛЮЧЕВЫЕ КУСКИ КОДА

### 1. useTelegram.js (ПРОБЛЕМНЫЙ ХУК)

```javascript
import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '../store/useStore';

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);
  const initializationRef = useRef(false);

  // ✅ ИСПРАВЛЕНО: validateTelegramAuth использует getState()
  const validateTelegramAuth = useCallback(async (initData) => {
    console.log('🔐 Validating initData with backend...');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      if (!response.ok) throw new Error('Auth failed');

      const { user, token } = await response.json();
      console.log('✅ Telegram authentication successful:', user);

      // ✅ ИСПРАВЛЕНО: используем getState() вместо деструктуризации
      const { setUser, setToken } = useStore.getState();
      setUser(user);
      setToken(token);

      return { user, token };
    } catch (error) {
      console.error('❌ Telegram auth error:', error);
      throw error;
    }
  }, []); // ✅ Пустой массив зависимостей

  // ❓ ВОЗМОЖНАЯ ПРОБЛЕМА: useEffect инициализации
  useEffect(() => {
    console.log('🔄 Initializing Telegram WebApp...');

    if (initializationRef.current) {
      console.log('⏭️ Already initialized, skipping...');
      return;
    }

    initializationRef.current = true;

    const initTelegram = async () => {
      // ... код инициализации Telegram SDK ...

      if (window.Telegram?.WebApp?.initData) {
        await validateTelegramAuth(window.Telegram.WebApp.initData);
      }

      setIsReady(true);
    };

    initTelegram();
  }, [validateTelegramAuth]); // ❓ Зависит от validateTelegramAuth

  return {
    webApp: window.Telegram?.WebApp,
    user: window.Telegram?.WebApp?.initDataUnsafe?.user,
    isReady,
    triggerHaptic: useCallback((style = 'medium') => {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
    }, []),
  };
}
```

**❓ ВОПРОС**: Почему `useTelegram()` инициализируется 10+ раз, если есть `initializationRef.current` проверка?

### 2. Subscriptions.jsx (БЕСКОНЕЧНЫЙ ЦИКЛ)

```javascript
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useStore } from '../store/useStore';
import { useTelegram } from '../hooks/useTelegram';

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { get } = useApi(); // ✅ Стабильная ссылка
  const { triggerHaptic } = useTelegram(); // ❓ ПРОБЛЕМА ЗДЕСЬ?
  const token = useStore((state) => state.token);

  // ✅ ИСПРАВЛЕНО: loadSubscriptions зависит только от get
  const loadSubscriptions = useCallback(async (signal) => {
    console.log('[Subscriptions] 🔵 START loadSubscriptions', { signal: signal?.aborted });

    const { data, error } = await get('/subscriptions/my-shops', { signal });

    if (signal?.aborted) {
      console.log('[Subscriptions] 🟡 ABORTED');
      return { status: 'aborted' };
    }

    if (error) {
      console.error('[Subscriptions] 🔴 ERROR:', error);
      return { status: 'error', error: 'Failed to load subscriptions' };
    }

    const subscriptionsList = data?.data || [];
    const normalized = subscriptionsList.map((item) => ({
      id: item.id,
      shopId: item.shop_id,
      shopName: item.shop_name,
      // ... остальные поля
    }));

    console.log('[Subscriptions] 🟢 SUCCESS - setting subscriptions:', normalized);
    setSubscriptions(normalized);
    return { status: 'success' };
  }, [get]); // ✅ Только стабильный get

  // ❓ ВОЗМОЖНАЯ ПРОБЛЕМА: useEffect цикл
  useEffect(() => {
    console.log('[Subscriptions] 🔵 useEffect triggered', { token: !!token });

    if (!token) {
      console.log('[Subscriptions] 🟡 NO TOKEN - skipping load');
      setLoading(false);
      return;
    }

    console.log('[Subscriptions] 🔵 Starting load with token');
    setLoading(true);
    setError(null);

    const controller = new AbortController();

    loadSubscriptions(controller.signal)
      .then(result => {
        console.log('[Subscriptions] 🔵 Load result:', result);
        if (!controller.signal.aborted && result?.status === 'error') {
          setError(result.error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          console.log('[Subscriptions] 🟢 DONE - setLoading(false)');
          setLoading(false);
        } else {
          console.log('[Subscriptions] 🟡 Aborted in finally');
        }
      });

    return () => {
      console.log('[Subscriptions] 🔴 CLEANUP - aborting controller');
      controller.abort();
    };
  }, [token, loadSubscriptions]); // ❓ token и loadSubscriptions

  // ... остальной код компонента
}
```

**❓ ВОПРОС**: Почему `useEffect` триггерится ~12 раз подряд с одинаковым token?

### 3. Catalog.jsx (АНАЛОГИЧНАЯ ПРОБЛЕМА)

```javascript
export default function Catalog() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [myShop, setMyShop] = useState(null);

  const products = useStore((state) => state.products);
  const currentShop = useStore((state) => state.currentShop);
  const token = useStore((state) => state.token);

  const { triggerHaptic } = useTelegram(); // ❓ ПРОБЛЕМА?
  const { get } = useApi();

  // ✅ ИСПРАВЛЕНО: loadMyShop использует getState()
  const loadMyShop = useCallback(async (signal) => {
    const { data, error: apiError } = await get('/shops/my', { signal });
    if (signal?.aborted) return { status: 'aborted' };
    if (apiError) return { status: 'error', error: apiError };
    if (data?.data && data.data.length > 0) {
      setMyShop(data.data[0]);
      return { status: 'success', shop: data.data[0] };
    }
    return { status: 'success', shop: null };
  }, [get]);

  // ✅ ИСПРАВЛЕНО: loadProducts использует getState()
  const loadProducts = useCallback(async (shopId, signal) => {
    const { data, error: apiError } = await get('/products', {
      params: { shopId },
      signal
    });
    if (signal?.aborted) return { status: 'aborted' };
    if (apiError) return { status: 'error', error: 'Failed to load products' };

    const items = Array.isArray(data?.data) ? data.data : [];
    useStore.getState().setProducts(items, shopId); // ✅ getState()
    return { status: 'success' };
  }, [get]);

  // ❓ ВОЗМОЖНАЯ ПРОБЛЕМА: useEffect цикл
  useEffect(() => {
    console.log('[Catalog] 🔵 useEffect triggered', { token: !!token, currentShop });

    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const signal = controller.signal;

    loadMyShop(signal)
      .then(result => {
        if (signal.aborted || result?.status !== 'success') return;
        const shop = currentShop || result.shop;
        if (shop) return loadProducts(shop.id, signal);
      })
      .then(result => {
        if (!signal.aborted && result?.status === 'error') {
          setError(result.error);
        }
      })
      .finally(() => {
        if (!signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      console.log('[Catalog] 🔴 CLEANUP - aborting controller');
      controller.abort();
    };
  }, [currentShop, token, loadMyShop, loadProducts]); // ❓ Много зависимостей

  // ... остальной код
}
```

**❓ ВОПРОС**: Почему Catalog.jsx циклится ~8 раз, если все callbacks стабильны?

### 4. useApi.js (СТАБИЛЬНЫЙ ХУК)

```javascript
import { useRef } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';

export function useApi() {
  const apiRef = useRef(null);

  if (!apiRef.current) {
    const getToken = () => useStore.getState().token;

    apiRef.current = {
      get: async (endpoint, config = {}) => {
        try {
          const token = getToken();
          const response = await axios.get(
            `${import.meta.env.VITE_API_URL}${endpoint}`,
            {
              ...config,
              headers: {
                ...config.headers,
                ...(token && { Authorization: `Bearer ${token}` }),
              },
            }
          );
          return { data: response.data, error: null };
        } catch (error) {
          if (axios.isCancel(error) || error.name === 'CanceledError') {
            console.log(`API GET ${endpoint} aborted`);
            return { data: null, error: 'Request cancelled' };
          }
          console.error(`API GET ${endpoint} error:`, error);
          return { data: null, error: error.message };
        }
      },
      // ... post, put, delete
    };
  }

  return apiRef.current; // ✅ Всегда одна и та же ссылка
}
```

**✅ ПОДТВЕРЖДЕНО**: useApi() возвращает стабильную ссылку через useRef.

### 5. useStore.js (Zustand Store)

```javascript
import { create } from 'zustand';

export const useStore = create((set) => ({
  // Auth
  user: null,
  token: null,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),

  // Products
  products: [],
  setProducts: (products) => set({ products }),

  // Current shop
  currentShop: null,
  setCurrentShop: (shop) => set({ currentShop: shop }),

  // ... остальное состояние
}));
```

**✅ ПОДТВЕРЖДЕНО**: Zustand store настроен правильно.

## ГИПОТЕЗЫ О ПРИЧИНЕ

### Гипотеза 1: useTelegram() нестабилен
- `useTelegram()` возвращает новый объект `{ webApp, user, isReady, triggerHaptic }` каждый рендер
- Это приводит к пересозданию компонентов, которые его используют
- **ВОЗМОЖНОЕ РЕШЕНИЕ**: Мемоизировать возвращаемый объект через useMemo

### Гипотеза 2: triggerHaptic пересоздаётся
- `triggerHaptic` создаётся через `useCallback(, [])`, но всё равно может быть нестабильным
- Компоненты используют `const { triggerHaptic } = useTelegram()`
- **ВОЗМОЖНОЕ РЕШЕНИЕ**: Проверить, действительно ли triggerHaptic стабилен

### Гипотеза 3: React StrictMode в production
- Возможно, React StrictMode включён в production билде
- Это вызывает двойной mount/unmount компонентов
- **ВОЗМОЖНОЕ РЕШЕНИЕ**: Проверить vite.config.js и main.jsx

### Гипотеза 4: Множественные экземпляры useTelegram
- Каждый компонент вызывает `useTelegram()` отдельно
- Это приводит к множественным инициализациям
- **ВОЗМОЖНОЕ РЕШЕНИЕ**: Создать единый TelegramProvider контекст

### Гипотеза 5: token меняется слишком часто
- Zustand store обновляет token, что триггерит все useEffect зависящие от token
- **ВОЗМОЖНОЕ РЕШЕНИЕ**: Проверить, почему token обновляется многократно

## ВОПРОСЫ К GEMINI

1. **Почему useTelegram() инициализируется 10+ раз, несмотря на initializationRef.current проверку?**
   - Создаётся ли новый хук на каждый компонент?
   - Как сделать единый экземпляр для всего приложения?

2. **Почему useEffect триггерится ~12 раз подряд с одинаковыми зависимостями?**
   - token не меняется, loadSubscriptions стабилен (useCallback с [get])
   - Что может вызывать повторные триггеры?

3. **Правильно ли использован pattern useStore.getState() в callbacks?**
   - Мы заменили деструктуризацию на getState() внутри callbacks
   - Но это не помогло остановить циклы

4. **Нужен ли TelegramProvider контекст вместо хука useTelegram()?**
   - Чтобы инициализация происходила 1 раз на весь app
   - Как правильно его реализовать?

5. **Есть ли другие причины бесконечных re-renders, которые мы пропустили?**
   - Может быть проблема в Framer Motion?
   - Может быть проблема в React Router?
   - Может быть проблема в Vite build конфигурации?

## STACK

- React 18.3.1
- Zustand 4.5.2
- Vite 5.4.20
- Telegram WebApp SDK 9.1
- Framer Motion 11.x
- Axios для HTTP

## ЧТО НУЖНО

**Найди точную причину infinite re-render loop и предложи рабочее решение.**

Если нужны дополнительные куски кода - спрашивай, предоставлю любые файлы.

---

**СПАСИБО ЗА ПОМОЩЬ!** 🙏
