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
    zoom: 150,        // Zoom записи
    pzm: 90,          // ПЗМ проведено (60% от zoom)
    vzm: 54,          // ВЗМ проведено (60% от pzm)
    contract: 40,     // Разбор договора (74% от vzm)
    deals: 30,        // Сделки (75% от contract)
    sales: 28,        // Продажи
    refusals: 15,     // Отказы от ПЗМ
    warming: 25,      // В подогреве
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
          <li>Общая конверсия Zoom → Сделки: {((totals.deals / totals.zoom) * 100).toFixed(1)}%</li>
          <li>Процент отказов от ПЗМ: {sideFlow.refusals.rate}%</li>
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
    zoom: data.zoom_total || 0,
    pzm: data.pzm_total || 0,
    vzm: data.vzm_total || 0,
    contract: data.contract_total || 0,
    deals: data.deals_total || 0,
    sales: data.sales_total || 0,
    refusals: data.refusals_total || 0,
    warming: data.warming_total || 0,
  }

  const { funnel, sideFlow } = calculateFullFunnel(totals)

  return (
    <FullFunnelChart
      funnel={funnel}
      sideFlow={sideFlow}
    />
  )
}
