# Leaderboard Components

Компоненты для лидерборда с геймификацией.

## Компоненты

### LeaderboardTable
Таблица лидерборда с медалями и статистикой.

**Features:**
- 🏆 Медали (золото, серебро, бронза) для топ-3
- 📊 Статистика: сделки, продажи, средний чек, конверсия
- 🎯 Прогресс к цели (если установлена)
- 🎨 Градиентные фоны для медалистов
- ⚡ Плавные анимации с Framer Motion
- 📅 Переключение периодов (день/неделя/месяц)

**Props:**
```typescript
interface LeaderboardTableProps {
  leaderboard: LeaderboardItem[]
  period: 'day' | 'week' | 'month'
  onPeriodChange: (period: string) => void
}
```

### VirtualGong
Невидимый компонент для real-time уведомлений о закрытых сделках.

**Features:**
- 🎉 Toast уведомления при закрытии сделок
- 🎊 Confetti анимация
- 🔔 Real-time через Server-Sent Events (SSE)
- 🎯 Автоматическое переподключение при ошибках

**Usage:**
```tsx
import { VirtualGong } from '@/components/leaderboard/VirtualGong'

// В root layout - глобально на всех страницах
<VirtualGong />
```

## Геймификация

### Medals System
- 🥇 **Золото** (1 место): `from-yellow-400 to-yellow-600`
- 🥈 **Серебро** (2 место): `from-gray-300 to-gray-500`
- 🥉 **Бронза** (3 место): `from-amber-600 to-amber-800`

### Confetti
При закрытии сделки:
- 100 частиц
- Spread 70°
- Цвета: золотой, оранжевый, акцентный (#FF6B00)

### Toast Notifications
- Позиция: top-right
- Длительность: 5 секунд
- Формат: "🎉 {Имя} закрыл {N} сделок на {Сумма}!"
- Auto-dismiss

## API Integration

### SSE Endpoint: `/api/sse/deals`
```typescript
// Формат данных
{
  employeeName: string
  dealsCount: number
  amount: number
}
```

### REST Endpoint: `/api/leaderboard?period=month`
```typescript
// Response
{
  leaderboard: LeaderboardItem[]
  period: { start: Date, end: Date, type: string }
  stats: {
    totalEmployees: number
    totalSales: number
    totalDeals: number
  }
}
```

## Dependencies
- `sonner` - Toast notifications
- `canvas-confetti` - Confetti animations
- `framer-motion` - Плавные анимации
- `lucide-react` - Иконки

## Files
```
components/leaderboard/
├── LeaderboardTable.tsx   # Таблица лидерборда
├── VirtualGong.tsx        # SSE listener для уведомлений
└── README.md              # Документация

app/dashboard/leaderboard/
└── page.tsx               # Страница лидерборда
```

## Examples

### Использование на странице
```tsx
'use client'

import { useState, useEffect } from 'react'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import { VirtualGong } from '@/components/leaderboard/VirtualGong'

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([])
  const [period, setPeriod] = useState('month')

  useEffect(() => {
    fetch(`/api/leaderboard?period=${period}`)
      .then(res => res.json())
      .then(data => setLeaderboard(data.leaderboard))
  }, [period])

  return (
    <>
      <VirtualGong />
      <LeaderboardTable
        leaderboard={leaderboard}
        period={period}
        onPeriodChange={setPeriod}
      />
    </>
  )
}
```

## Performance
- ✅ Client-side rendering (Real-time updates)
- ✅ Minimal re-renders через React state
- ✅ SSE auto-reconnect
- ✅ Framer Motion GPU-accelerated animations
- ✅ Lazy loading confetti library

## Accessibility
- ✅ Keyboard navigation
- ✅ Semantic HTML
- ✅ ARIA labels на кнопках
- ✅ Color contrast compliance
- ✅ Screen reader friendly
