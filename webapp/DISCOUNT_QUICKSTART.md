# Discount Components - Quick Start

> Быстрый старт для использования компонентов скидок

---

## 🚀 Быстрый старт (5 минут)

### 1. Проверь Backend API

Убедись что твой Backend возвращает эти поля:

```javascript
// GET /api/products?shopId=123
{
  "data": [
    {
      "id": 1,
      "name": "Product name",
      "price": 75,                    // ✅ Цена СО скидкой
      "original_price": 100,          // ✅ Оригинальная цена
      "discount_percentage": 25,      // ✅ Процент (0-100)
      "discount_expires_at": "2025-11-02T18:00:00.000Z", // ✅ ISO timestamp
      "stock": 10,
      "availability": "stock"
    }
  ]
}
```

**Важно:**
- `price` - цена ПОСЛЕ скидки (то что пользователь платит)
- `original_price` - цена ДО скидки (зачёркивается)
- `discount_expires_at` - может быть `null` (постоянная скидка)

---

### 2. Используй компоненты

Компоненты уже интегрированы в `ProductCard.jsx`:

```jsx
import ProductCard from './components/Product/ProductCard';

// В твоём компоненте
<ProductCard product={product} />
```

**ProductCard автоматически:**
- ✅ Показывает badge скидки (если есть)
- ✅ Запускает countdown таймер (если временная скидка)
- ✅ Зачёркивает оригинальную цену
- ✅ Меняет цвет цены на красный
- ✅ Выделяет карточку красным градиентом

---

### 3. Тестируй

Открой демо страницу:

1. Запусти WebApp:
```bash
cd webapp
npm run dev
```

2. Открой http://localhost:5173

3. Перейди в **Settings** → **Демо: Скидки**

4. Увидишь 8 примеров товаров с разными скидками

---

## 📦 Использование отдельных компонентов

### CountdownTimer

```jsx
import CountdownTimer from './components/common/CountdownTimer';

<CountdownTimer expiresAt="2025-11-02T18:00:00.000Z" />
```

**Props:**
- `expiresAt` (string, required) - ISO timestamp

**Автоматически:**
- Обновляется каждую секунду
- Меняет цвет (orange → red → pulsing)
- Исчезает когда истекло

---

### DiscountBadge

```jsx
import DiscountBadge from './components/common/DiscountBadge';

<DiscountBadge percentage={50} />
```

**Props:**
- `percentage` (number, required) - Процент скидки (0-100)

**Автоматически:**
- Красно-оранжевый градиент
- Пульсирует (subtle animation)
- Абсолютное позиционирование (top-right)

---

## 🎨 Кастомизация

### Изменить цвета

Отредактируй компоненты:

**CountdownTimer.jsx:**
```javascript
// Строка 60-65
let colorClass = 'text-orange-500'; // ← Измени на свой цвет
if (isWarning || isUrgent) {
  colorClass = 'text-red-500'; // ← Измени на свой цвет
}
```

**DiscountBadge.jsx:**
```javascript
// Строка 42
background: 'linear-gradient(135deg, #FF4757 0%, #FF6B35 100%)'
// ↑ Измени градиент на свой
```

---

### Изменить пороги времени

**CountdownTimer.jsx:**
```javascript
// Строка 57-59
const isUrgent = timeLeft.totalHours < 1; // ← Измени на 0.5 (30 минут)
const isWarning = timeLeft.totalHours >= 1 && timeLeft.totalHours < 3; // ← Измени пороги
```

---

### Изменить формат таймера

**CountdownTimer.jsx:**
```javascript
// Строка 62-68
if (timeLeft.hours > 0) {
  displayText = `${timeLeft.hours}ч ${timeLeft.minutes}м`;
} else if (timeLeft.minutes > 0) {
  displayText = `${timeLeft.minutes}м ${timeLeft.seconds}с`;
} else {
  displayText = `${timeLeft.seconds}с`;
}

// ↑ Измени формат на свой, например:
// displayText = `${timeLeft.hours}:${timeLeft.minutes}:${timeLeft.seconds}`;
```

---

## 🐛 Troubleshooting

### Таймер не обновляется

**Проблема:** Таймер показывает статичное время

**Решение:**
1. Проверь что `expiresAt` валидный ISO timestamp
2. Проверь console на ошибки
3. Проверь что `setInterval` не блокируется

```javascript
// Debug в CountdownTimer.jsx
useEffect(() => {
  console.log('Timer started for:', expiresAt);
  // ...
}, [expiresAt]);
```

---

### Badge не показывается

**Проблема:** Badge скидки не виден

**Решение:**
1. Проверь что `discount_percentage > 0`
2. Проверь z-index (должен быть 10)
3. Проверь что родитель имеет `position: relative`

```javascript
// Debug в ProductCard.jsx
console.log('hasDiscount:', hasDiscount);
console.log('discountPercentage:', discountPercentage);
```

---

### Цена не зачёркивается

**Проблема:** Оригинальная цена не показывается

**Решение:**
1. Проверь что Backend возвращает `original_price`
2. Проверь fallback логику:

```javascript
// В ProductCard.jsx
const originalPrice = product.original_price || product.price;
console.log('Original:', originalPrice, 'Current:', product.price);
```

---

### Таймер показывает отрицательное время

**Проблема:** Таймер показывает "-5м -30с"

**Решение:**
Проверь что время в будущем:

```javascript
const now = new Date();
const end = new Date(expiresAt);
console.log('Now:', now.toISOString());
console.log('End:', end.toISOString());
console.log('Diff:', end - now); // Должно быть положительное
```

---

## 📚 Дополнительная документация

- **Полная документация:** `DISCOUNT_COMPONENTS.md`
- **UI Guide с визуалами:** `DISCOUNT_UI_GUIDE.md`
- **API контракт:** См. "Backend API контракт" в `DISCOUNT_COMPONENTS.md`

---

## 🎯 Примеры использования

### Пример 1: Постоянная скидка

```javascript
const product = {
  id: 1,
  name: "Premium Headphones",
  price: 70,
  original_price: 100,
  discount_percentage: 30,
  discount_expires_at: null, // ← null = постоянная скидка
  stock: 10
};

<ProductCard product={product} />
```

**Результат:**
- Badge: -30%
- Цена: $70 (красная)
- Зачёркнуто: $100
- Таймера нет

---

### Пример 2: Временная скидка (flash sale)

```javascript
const product = {
  id: 2,
  name: "Gaming Mouse",
  price: 50,
  original_price: 100,
  discount_percentage: 50,
  discount_expires_at: "2025-11-02T18:00:00.000Z", // ← Временная
  stock: 5
};

<ProductCard product={product} />
```

**Результат:**
- Badge: -50%
- Цена: $50 (красная)
- Зачёркнуто: $100
- Таймер: ⏰ 5ч 23м (оранжевый/красный)

---

### Пример 3: Срочная скидка (<1 час)

```javascript
const now = new Date();
const expiresIn45Min = new Date(now.getTime() + 45 * 60 * 1000);

const product = {
  id: 3,
  name: "URGENT SALE",
  price: 40,
  original_price: 100,
  discount_percentage: 60,
  discount_expires_at: expiresIn45Min.toISOString(), // ← 45 минут
  stock: 2
};

<ProductCard product={product} />
```

**Результат:**
- Badge: -60%
- Цена: $40 (красная)
- Зачёркнуто: $100
- Таймер: ⏰ 45м 32с (красный + пульсация)

---

## ✅ Чек-лист перед продакшеном

- [ ] Backend возвращает все нужные поля
- [ ] `discount_expires_at` в ISO формате (UTC)
- [ ] `price` - цена ПОСЛЕ скидки
- [ ] `original_price` - цена ДО скидки
- [ ] Протестировано на mobile (iOS/Android)
- [ ] Протестировано на desktop
- [ ] Таймеры обновляются корректно
- [ ] Нет memory leaks (cleanup setInterval)
- [ ] Цвета соответствуют дизайну
- [ ] Accessibility проверена (ARIA labels)

---

## 🆘 Поддержка

**Вопросы?**
1. Проверь `DISCOUNT_COMPONENTS.md` (полная документация)
2. Проверь `DISCOUNT_UI_GUIDE.md` (визуальное руководство)
3. Открой демо страницу для примеров

**Нашёл баг?**
1. Проверь console на ошибки
2. Проверь что Backend возвращает правильные данные
3. Проверь что компоненты импортированы корректно

---

**Готово!** 🎉

Теперь у тебя есть премиум система скидок с live таймерами.
