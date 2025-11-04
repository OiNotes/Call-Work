# 🤖 GEMINI 2.0 - Help Needed

> Привет, Gemini! Нужна твоя помощь с двумя критическими проблемами в Telegram Mini App (React + Vite).

---

## ⚠️ ПРОБЛЕМА 1: Бесконечный Spinner

### Описание:
В разделе "Подписки" показывается spinner загрузки, который **НЕ исчезает** даже после успешной загрузки данных.

### Код компонента:

**Файл:** `webapp/src/pages/Subscriptions.jsx`

```javascript
// useState
const [subscriptions, setSubscriptions] = useState([]);
const [loading, setLoading] = useState(true);  // ← Изначально true
const [error, setError] = useState(null);

// Функция загрузки
const loadSubscriptions = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);
    console.log('[Subscriptions] Loading subscriptions...');

    const { data, error: apiError } = await getSubscriptions(); // API call

    console.log('[Subscriptions] Response:', { data, apiError });

    if (apiError) {
      console.error('[Subscriptions] API error:', apiError);
      setError('Failed to load subscriptions');
      return; // Early exit
    }

    // Normalize data
    const rawData = Array.isArray(data?.data) ? data.data :
                   Array.isArray(data) ? data : [];

    const normalized = rawData.map((item) => ({
      id: item.id,
      sourceShopId: item.shop_id,
      sourceShopName: item.shop_name,
      subscribedAt: item.subscribed_at,
      sourceShopLogo: item.source_shop_logo,
      sourceProductsCount: item.source_products_count,
    }));

    setSubscriptions(normalized);
  } catch (err) {
    console.error('[Subscriptions] Exception:', err);
    setError('Failed to load subscriptions');
  } finally {
    console.log('[Subscriptions] Loading complete, setLoading(false)');
    setLoading(false); // ← ВСЕГДА должен выполниться
  }
}, [getSubscriptions]); // ← Dependency: getSubscriptions

// useEffect для автозагрузки
useEffect(() => {
  loadSubscriptions();
}, [loadSubscriptions]); // ← Dependency: loadSubscriptions

// Рендеринг
{loading ? (
  <div className="flex items-center justify-center py-12">
    <div className="w-8 h-8 border-4 border-orange-primary border-t-transparent rounded-full animate-spin" />
  </div>
) : error ? (
  <div>Error: {error}</div>
) : !hasSubscriptions ? (
  <div>Empty state</div>
) : (
  <div>Content with subscriptions</div>
)}
```

### API Hook:

```javascript
// webapp/src/hooks/useApi.js
const getSubscriptions = useCallback(async () => {
  return await api.get('/api/subscriptions'); // GET запрос
}, [api]);
```

### Что происходит:

1. Компонент монтируется → `loading = true` → spinner показывается
2. `useEffect` запускается → вызывает `loadSubscriptions()`
3. API запрос выполняется → получает данные
4. `finally` блок выполняется → `setLoading(false)`
5. **НО:** Spinner **НЕ исчезает!** Продолжает крутиться бесконечно

### Console логи показывают:

```
[Subscriptions] Loading subscriptions...
[Subscriptions] Response: { data: {...}, apiError: undefined }
[Subscriptions] Loading complete, setLoading(false)
```

Логи говорят что `setLoading(false)` **вызван**, но UI **НЕ обновляется**.

### ❓ ВОПРОСЫ К GEMINI:

1. **Почему `setLoading(false)` не обновляет UI?**
   - В логах видно что finally выполнился
   - Но spinner продолжает крутиться

2. **Может ли быть infinite loop из-за dependencies?**
   ```javascript
   const loadSubscriptions = useCallback(async () => {
     // ...
   }, [getSubscriptions]); // ← getSubscriptions может пересоздаваться?

   useEffect(() => {
     loadSubscriptions();
   }, [loadSubscriptions]); // ← loadSubscriptions пересоздаётся → infinite loop?
   ```

3. **Правильно ли используется useCallback + useEffect?**
   - Должны ли мы добавить `// eslint-disable-next-line react-hooks/exhaustive-deps`?
   - Должен ли useEffect иметь пустой dependency array `[]`?

4. **Может ли проблема быть в React 18 concurrent mode?**
   - State updates batching?
   - Stale closure?

### 💡 ЧТО МЫ УЖЕ ПРОБОВАЛИ:

- ✅ Добавили `finally` блок → не помогло
- ✅ Добавили console.log → подтвердили что `setLoading(false)` вызывается
- ✅ Добавили timeout (15 секунд) для API запросов → не помогло
- ❌ Spinner всё равно крутится бесконечно

### 🎯 НУЖНО РЕШЕНИЕ:

Как гарантировать что `setLoading(false)` обновит UI и скроет spinner?

---

## ⚠️ ПРОБЛЕМА 2: Кнопки "прыгают" при появлении клавиатуры

### Описание:

В модальном окне добавления кошельков есть кнопки "Сохранить" и "Отмена" внизу экрана.

**Проблема:**
- Когда пользователь фокусируется на поле ввода (BTC, ETH, USDT, LTC)
- iOS клавиатура появляется снизу
- Кнопки **"прыгают" вверх** вместе с клавиатурой
- Результат: кнопки летают, UI скачет, пользователь в шоке

### Код кнопок:

**Файл:** `webapp/src/components/Settings/WalletsModal.jsx`

```jsx
{showForm && (
  <div
    className="fixed bottom-0 left-0 right-0 p-4 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-white/5"
    style={{
      paddingBottom: 'calc(var(--tabbar-total) + 16px)',
      zIndex: 1000
    }}
  >
    <div className="flex items-center gap-3">
      <motion.button
        className="flex-1 py-3 rounded-xl font-medium transition-all bg-[#FF6B00] text-white"
        onClick={handleSaveWallets}
        disabled={saving || !hasValidAddress}
        whileTap={{ scale: 0.98 }}
      >
        {saving ? 'Загрузка...' : 'Сохранить'}
      </motion.button>

      <motion.button
        className="flex-1 py-3 rounded-xl font-medium transition-all bg-white/5 text-white/60"
        onClick={resetForm}
        disabled={saving}
      >
        Отмена
      </motion.button>
    </div>
  </div>
)}
```

### Структура:

- **Position:** `fixed`
- **Bottom:** `0` (неявно, через `bottom-0` в className)
- **Padding bottom:** `calc(var(--tabbar-total) + 16px)` (~116px)
- **Z-index:** `1000`

### Keyboard Viewport Hook:

У нас есть кастомный hook `useKeyboardViewport()` который:

1. Слушает `focusin`/`focusout` events
2. Обнаруживает открытие iOS клавиатуры
3. Устанавливает CSS переменную `--vh-dynamic` (высота viewport без клавиатуры)
4. Добавляет класс `.kb-open` к `<html>` когда клавиатура открыта

**Но:** В `WalletsModal.jsx` этот hook **НЕ используется!**

```javascript
// WalletsModal.jsx - НЕТ импорта!
import { useBackButton } from '../../hooks/useBackButton';
// ❌ ОТСУТСТВУЕТ: import { useKeyboardViewport } from '../../hooks/useKeyboardViewport';
```

### Что происходит:

1. Пользователь кликает на поле "BTC адрес"
2. iOS клавиатура появляется снизу (высота ~300px)
3. **Визуальный viewport сжимается** с 844px до 544px
4. **Кнопки с `position: fixed` и `bottom: 0`** остаются привязаны к новому `bottom`
5. **Результат:** Кнопки летят вверх на 300px (к верху клавиатуры)

### ❓ ВОПРОСЫ К GEMINI:

1. **Как сделать чтобы кнопки НЕ прыгали при клавиатуре?**

   **Варианты:**
   - A) Использовать `position: sticky` вместо `fixed`?
   - B) Использовать `transform: translateY()` вместо `bottom`?
   - C) Добавить CSS с `.kb-open` класом для скрытия кнопок?
   - D) Использовать `--vh-dynamic` CSS переменную?

2. **Нужна ли кнопка "Отмена" вообще?**

   Пользователь хочет **только кнопку "Сохранить"**. Кнопка "Отмена" лишняя.

   **Как правильно реализовать ОДНУ кнопку снизу?**
   - Должна ли она быть `fixed`?
   - Как она должна вести себя при клавиатуре?
   - Нужно ли скрывать кнопку когда клавиатура открыта?

3. **Стоит ли использовать Telegram MainButton API?**

   ```javascript
   window.Telegram.WebApp.MainButton.setText('Сохранить');
   window.Telegram.WebApp.MainButton.onClick(handleSave);
   window.Telegram.WebApp.MainButton.show();
   ```

   **Плюсы:**
   - Нативная кнопка Telegram (всегда внизу)
   - НЕ прыгает при клавиатуре
   - Автоматически скрывается когда нужно

   **Минусы:**
   - Меньше контроля над стилями
   - API ограничен

4. **Какой CSS использовать для smooth transition?**

   Текущий код использует Framer Motion `whileTap={{ scale: 0.98 }}`.

   Нужен ли дополнительный CSS для предотвращения прыжков?

### 💡 ЧТО МЫ УЖЕ ПРОБОВАЛИ:

- ✅ Изменили `paddingBottom` с 180px на 100px → не помогло (кнопки всё равно прыгают)
- ✅ Добавили `z-index: 1000` → не помогло
- ✅ Добавили `disableVerticalSwipes()` для Telegram → помогло с swipe gesture, но не с клавиатурой
- ❌ Кнопки всё равно прыгают при появлении iOS клавиатуры

### 🎯 НУЖНО РЕШЕНИЕ:

1. **Основное:** Как сделать чтобы кнопка "Сохранить" НЕ прыгала при клавиатуре?
2. **Дополнительно:** Убрать кнопку "Отмена" и оставить ТОЛЬКО "Сохранить"
3. **Best practice:** Какой правильный паттерн для fixed buttons в Telegram Mini App с клавиатурой?

---

## 📱 Контекст проекта:

- **Stack:** React 18 + Vite + TailwindCSS + Framer Motion
- **Platform:** Telegram Mini App (iOS + Android)
- **State:** Zustand (in-memory, no persist)
- **API:** Axios + custom hooks

---

## 🙏 Помощь нужна:

Gemini, пожалуйста помоги найти решение для обеих проблем. Мы застряли и не знаем как исправить.

**Нужны:**
1. Конкретные изменения в коде (с номерами строк если возможно)
2. Объяснение ПОЧЕМУ текущий код не работает
3. Best practices для Telegram Mini App + iOS клавиатура

Заранее спасибо! 🚀

---

## 📎 Дополнительные файлы:

<details>
<summary>useKeyboardViewport.js (полный код)</summary>

```javascript
import { useEffect, useRef } from 'react';

const IOS_THRESHOLD = window.innerHeight * 0.25;
const ANDROID_THRESHOLD = window.innerHeight * 0.2;

export function useKeyboardViewport() {
  const stableRef = useRef(null);
  const forceOpenRef = useRef(false);
  const focusTimeoutRef = useRef(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const html = document.documentElement;

    const setVH = (px) => {
      if (typeof px === 'number' && !Number.isNaN(px) && px > 0) {
        html.style.setProperty('--vh-dynamic', `${px}px`);
      }
    };

    const setKB = (open) => html.classList.toggle('kb-open', !!open);

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const THRESHOLD = isIOS ? IOS_THRESHOLD : ANDROID_THRESHOLD;
    const fallbackHeight = window.innerHeight || html.clientHeight || 0;

    const compute = () => {
      const resolvedBaseline = /* расчет baseline viewport height */;
      const resolvedCurrent = /* расчет current viewport height */;
      const heightDelta = resolvedBaseline - resolvedCurrent;
      const keyboardOpen = heightDelta > THRESHOLD;

      setVH(resolvedCurrent); // Устанавливает --vh-dynamic
      setKB(keyboardOpen);    // Добавляет .kb-open класс
    };

    const focusin = (event) => {
      const target = event.target;
      if (isKeyboardTarget(target)) {
        forceOpenRef.current = true;
        setKB(true);
        requestAnimationFrame(compute);
      }
    };

    const focusout = () => {
      setTimeout(() => {
        if (!isKeyboardTarget(document.activeElement)) {
          forceOpenRef.current = false;
          compute();
        }
      }, 100);
    };

    // Listeners
    tg?.onEvent?.('viewportChanged', compute);
    window.visualViewport?.addEventListener('resize', compute);
    document.addEventListener('focusin', focusin, true);
    document.addEventListener('focusout', focusout, true);

    compute(); // Initial

    return () => {
      // Cleanup
      tg?.offEvent?.('viewportChanged', compute);
      window.visualViewport?.removeEventListener('resize', compute);
      document.removeEventListener('focusin', focusin, true);
      document.removeEventListener('focusout', focusout, true);
    };
  }, []);
}
```

</details>

<details>
<summary>CSS переменные (globals.css)</summary>

```css
:root {
  --tabbar-height: 80px;
  --safe-bottom: max(var(--tg-content-safe-area-inset-bottom), env(safe-area-inset-bottom), 20px);
  --tabbar-total: calc(var(--tabbar-height) + var(--safe-bottom));

  /* Устанавливается через useKeyboardViewport */
  --vh-dynamic: 100vh; /* default */
}

/* Класс добавляется когда клавиатура открыта */
html.kb-open {
  /* Какие стили нужны здесь? */
}
```

</details>

---

**Дата:** 2025-11-04
**Статус:** 🔴 CRITICAL - блокирует релиз
