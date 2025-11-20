/**
 * Пример использования FullFunnelChart компонента
 *
 * Этот файл показывает как использовать FullFunnelChart с реальными данными
 */

import { FullFunnelChart } from './FullFunnelChart'
import { calculateFullFunnel, type FunnelTotals } from '@/lib/calculations/funnel'

export function FullFunnelExample() {
  // Пример данных (в реальном проекте получать из API или props)
  const totals: FunnelTotals = {
    zoomBooked: 150,        // Zoom записи
    zoom1Held: 90,          // Первый Zoom проведено (60% от zoomBooked)
    zoom2Held: 54,          // Второй Zoom проведено (60% от zoom1Held)
    contractReview: 40,     // Разбор договора (74% от zoom2Held)
    push: 35,               // Дожим (87.5% от contractReview)
    deals: 30,              // Сделки (85.7% от push)
    sales: 28,              // Продажи
    refusals: 15,           // Отказы от первого Zoom
    warming: 25,            // В подогреве
  }

  // Расчёт воронки и боковых потоков
  const { funnel, sideFlow } = calculateFullFunnel(totals)

  // Обработчик клика на этап воронки
  const handleStageClick = (stage: typeof funnel[0]) => {
    console.log('Clicked stage:', stage)
    // Здесь можно открыть модальное окно с деталями этапа
    // или перейти на страницу детализации
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Воронка конверсии</h2>

      <FullFunnelChart
        funnel={funnel}
        sideFlow={sideFlow}
        onStageClick={handleStageClick}
      />

      {/* Дополнительная информация */}
      <div className="mt-8 glass-card p-4">
        <h3 className="font-semibold mb-2">Показатели</h3>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <li>Общая конверсия Zoom → Сделки: {((totals.deals / totals.zoomBooked) * 100).toFixed(1)}%</li>
          <li>Процент отказов от первого Zoom: {sideFlow.refusals.rateFromFirstZoom}%</li>
          <li>Клиентов в подогреве: {sideFlow.warming.count}</li>
        </ul>
      </div>
    </div>
  )
}

/**
 * Пример интеграции с API
 */
export async function FullFunnelFromAPI({ employeeId }: { employeeId: number }) {
  // Получение данных из API
  const response = await fetch(`/api/analytics/funnel?employeeId=${employeeId}`)
  const data = await response.json()

  const totals: FunnelTotals = {
    zoomBooked: data.zoom_booked || 0,
    zoom1Held: data.zoom1_held || 0,
    zoom2Held: data.zoom2_held || 0,
    contractReview: data.contract_review || 0,
    push: data.push || 0,
    deals: data.deals || 0,
    sales: data.sales || 0,
    refusals: data.refusals || 0,
    warming: data.warming || 0,
  }

  const { funnel, sideFlow } = calculateFullFunnel(totals)

  return (
    <FullFunnelChart
      funnel={funnel}
      sideFlow={sideFlow}
    />
  )
}
