# Analytics Components

Компоненты для визуализации аналитики продаж.

## ForecastChart

Компонент для отображения прогноза выполнения месячного плана продаж.

### Функциональность

- **3 KPI карточки:**
  - Факт на сегодня (синяя) - текущие продажи и средняя за день
  - Прогноз на конец месяца (оранжевая) - projected value и % выполнения
  - Темп выполнения (зелёная/красная) - опережение/отставание от плана

- **Интерактивный график (Recharts):**
  - Линия плана (серый пунктир)
  - Линия факта (синяя сплошная)
  - Линия прогноза (оранжевый пунктир)
  - Reference line цели (зелёная)
  - Кастомный Tooltip с деталями

- **Дополнительная аналитика:**
  - Требуемая дневная сумма для достижения цели
  - Отклонение от ожидаемого темпа

### Использование

```tsx
import { ForecastChart } from '@/components/analytics/ForecastChart'

<ForecastChart
  data={forecastData}
  userName="Иван Иванов"
/>
```

### Props

```typescript
interface ForecastChartProps {
  data: ForecastData
  userName?: string
}

interface ForecastData {
  forecast: {
    current: number          // текущие продажи
    goal: number             // цель месяца
    projected: number        // прогноз на конец месяца
    completion: number       // % выполнения
    pacing: number           // темп (+ или -)
    isPacingGood: boolean    // опережаем ли план
    daysInMonth: number
    daysPassed: number
    daysRemaining: number
    dailyAverage: number     // средняя за день
    dailyRequired: number    // нужно в день для цели
    expectedByNow: number    // ожидалось к текущему дню
  }
  chartData: Array<{
    day: number
    plan?: number
    actual?: number
    forecast?: number
  }>
}
```

### Дизайн

- **Цветовая палитра (iOS-стиль):**
  - Синий: `#007AFF` (факт)
  - Оранжевый: `#FF9500` (прогноз)
  - Зелёный: `#34C759` (успех)
  - Красный: `#FF3B30` (отставание)
  - Серый: `#86868B` (план)

- **Анимации:**
  - Framer Motion для fade-in карточек (stagger delay)
  - Smooth transitions на hover
  - Gradient backgrounds для КPI карточек

- **Типографика:**
  - Заголовки: `font-semibold tracking-tight`
  - Числа: `text-3xl font-semibold`
  - Подписи: `text-sm text-[#86868B]`

### Зависимости

- `recharts` - графики
- `framer-motion` - анимации
- `lucide-react` - иконки
- `date-fns` - форматирование дат (опционально)

### Страница

Страница доступна по маршруту: `/dashboard/forecast`

Требует авторизации через NextAuth.
