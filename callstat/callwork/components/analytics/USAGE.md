# Analytics Components - Руководство по использованию

## FullFunnelChart - Классическая воронка-треугольник

### Быстрый старт

```tsx
import { FullFunnelChart } from '@/components/analytics'
import { calculateFullFunnel } from '@/lib/calculations/funnel'

// В вашем компоненте
const totals = {
  zoom: 150,
  pzm: 90,
  vzm: 54,
  contract: 40,
  deals: 30,
  sales: 28,
  refusals: 15,
  warming: 25,
}

const { funnel, sideFlow } = calculateFullFunnel(totals)

return (
  <FullFunnelChart
    funnel={funnel}
    sideFlow={sideFlow}
    onStageClick={(stage) => {
      console.log('Clicked:', stage)
    }}
  />
)
```

### Интеграция с API (Server Component)

```tsx
// app/analytics/page.tsx
import { FullFunnelChart } from '@/components/analytics'
import { calculateFullFunnel } from '@/lib/calculations/funnel'
import { prisma } from '@/lib/prisma'

export default async function AnalyticsPage() {
  // Получение данных из БД
  const data = await prisma.report.aggregate({
    _sum: {
      zoom_total: true,
      pzm_total: true,
      vzm_total: true,
      contract_total: true,
      deals_total: true,
      sales_total: true,
      refusals_total: true,
      warming_total: true,
    },
  })

  const totals = {
    zoom: data._sum.zoom_total ?? 0,
    pzm: data._sum.pzm_total ?? 0,
    vzm: data._sum.vzm_total ?? 0,
    contract: data._sum.contract_total ?? 0,
    deals: data._sum.deals_total ?? 0,
    sales: data._sum.sales_total ?? 0,
    refusals: data._sum.refusals_total ?? 0,
    warming: data._sum.warming_total ?? 0,
  }

  const { funnel, sideFlow } = calculateFullFunnel(totals)

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Воронка продаж</h1>
      <FullFunnelChart funnel={funnel} sideFlow={sideFlow} />
    </div>
  )
}
```

### Интеграция с API (Client Component + API Route)

```tsx
// app/analytics/FunnelClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { FullFunnelChart } from '@/components/analytics'
import { calculateFullFunnel, type FunnelTotals } from '@/lib/calculations/funnel'

export function FunnelClient({ employeeId }: { employeeId?: number }) {
  const [totals, setTotals] = useState<FunnelTotals | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const url = employeeId
        ? `/api/analytics/funnel?employeeId=${employeeId}`
        : '/api/analytics/funnel'

      const response = await fetch(url)
      const data = await response.json()

      setTotals({
        zoom: data.zoom_total ?? 0,
        pzm: data.pzm_total ?? 0,
        vzm: data.vzm_total ?? 0,
        contract: data.contract_total ?? 0,
        deals: data.deals_total ?? 0,
        sales: data.sales_total ?? 0,
        refusals: data.refusals_total ?? 0,
        warming: data.warming_total ?? 0,
      })
    }

    fetchData()
  }, [employeeId])

  if (!totals) {
    return <div>Загрузка...</div>
  }

  const { funnel, sideFlow } = calculateFullFunnel(totals)

  return <FullFunnelChart funnel={funnel} sideFlow={sideFlow} />
}
```

### Обработка кликов на этапы

```tsx
'use client'

import { useState } from 'react'
import { FullFunnelChart } from '@/components/analytics'
import type { FunnelStage } from '@/lib/calculations/funnel'

export function FunnelWithDetails({ funnel, sideFlow }) {
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null)

  return (
    <>
      <FullFunnelChart
        funnel={funnel}
        sideFlow={sideFlow}
        onStageClick={setSelectedStage}
      />

      {selectedStage && (
        <div className="mt-6 glass-card p-6">
          <h3 className="text-xl font-bold mb-2">{selectedStage.stage}</h3>
          <p className="text-slate-600">Количество: {selectedStage.value}</p>
          <p className="text-slate-600">Конверсия: {selectedStage.conversion}%</p>
          {selectedStage.isRedZone && (
            <p className="text-red-600 font-semibold mt-2">⚠️ Red Zone - требует внимания!</p>
          )}
        </div>
      )}
    </>
  )
}
```

### Адаптивная версия для мобильных устройств

```tsx
'use client'

import { FullFunnelChart } from '@/components/analytics'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export function ResponsiveFunnel({ funnel, sideFlow }) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <div className={isMobile ? 'grid-cols-1' : 'grid grid-cols-[1fr_300px] gap-8'}>
      <FullFunnelChart funnel={funnel} sideFlow={sideFlow} />
    </div>
  )
}
```

## Сравнение с InteractiveFunnelChart

| Характеристика        | FullFunnelChart                   | InteractiveFunnelChart    |
| --------------------- | --------------------------------- | ------------------------- |
| Визуализация          | CSS clip-path трапеции            | Recharts bar chart        |
| Боковая панель        | ✅ Да (Отказы + Подогрев)         | ❌ Нет                    |
| Библиотека для графов | ❌ Нет (чистый CSS)               | ✅ Recharts               |
| Размер бандла         | Меньше (~10kb)                    | Больше (~80kb + recharts) |
| Кастомизация          | Легче (CSS styles)                | Сложнее (Recharts API)    |
| Анимации              | Framer Motion (плавные)           | Recharts (базовые)        |
| Интерактивность       | onClick + hover                   | onClick + hover + tooltip |
| Подходит для          | Презентации, дашборды, печать     | Детальная аналитика       |

## Выбор компонента

**Используй FullFunnelChart когда:**
- Нужна классическая воронка-треугольник
- Важна визуальная презентация
- Нужно показать Отказы и Подогрев рядом
- Хочешь меньший размер бандла
- Печатная версия отчётов

**Используй InteractiveFunnelChart когда:**
- Нужны детальные tooltips
- Работа с большими данными (zoom, pan)
- Сложная интерактивность
- Уже используется Recharts в проекте

## Troubleshooting

### Ошибка: "Cannot find module '@/lib/calculations/funnel'"

Убедитесь что файл существует:
```bash
ls lib/calculations/funnel.ts
```

Проверьте tsconfig.json:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Стили glass-card не применяются

Проверьте что в `app/globals.css` есть:
```css
.glass-card {
  @apply bg-[var(--card)]/80 backdrop-blur-xl border border-[var(--border)] shadow-[var(--shadow-md)];
}
```

### Анимации не работают

Проверьте установку framer-motion:
```bash
npm install framer-motion
```

## Полная документация

См. файлы:
- `FullFunnelChart.README.md` - детальная документация компонента
- `FullFunnelChart.example.tsx` - примеры использования
- `@/lib/calculations/funnel.ts` - логика расчётов

## Дополнительные ресурсы

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Next.js 14 Docs](https://nextjs.org/docs)
