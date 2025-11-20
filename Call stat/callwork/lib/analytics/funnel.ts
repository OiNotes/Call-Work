import { Report } from '@prisma/client'
import { CONVERSION_BENCHMARKS, FUNNEL_STAGES } from '@/lib/config/conversionBenchmarks'

export interface FunnelStage {
  id: string
  label: string
  value: number
  prevValue?: number
  conversion: number
  benchmark: number
  isRedZone: boolean
  dropOff?: number
}

export interface ManagerStats {
  id: string
  name: string
  zoomBooked: number
  zoom1Held: number
  zoom2Held: number
  contractReview: number
  pushCount: number
  successfulDeals: number
  salesAmount: number
  refusals?: number
  warming?: number

  // Conversions
  bookedToZoom1: number // Запись → 1-й Zoom
  zoom1ToZoom2: number // 1-й → 2-й Zoom
  zoom2ToContract: number // 2-й Zoom → Разбор
  contractToPush: number // Разбор → Дожим
  pushToDeal: number // Дожим → Оплата

  // Global Conversion
  northStar: number // 1-й Zoom → Оплата (главный KPI)
  totalConversion: number // Запись → Оплата

  // Plan/Activity
  planSales: number
  planDeals: number
  activityScore: number
  trend: 'up' | 'down' | 'flat'
}

export const BENCHMARKS = {
  bookedToZoom1: CONVERSION_BENCHMARKS.BOOKED_TO_ZOOM1,
  zoom1ToZoom2: CONVERSION_BENCHMARKS.ZOOM1_TO_ZOOM2,
  zoom2ToContract: CONVERSION_BENCHMARKS.ZOOM2_TO_CONTRACT,
  contractToPush: CONVERSION_BENCHMARKS.CONTRACT_TO_PUSH,
  pushToDeal: CONVERSION_BENCHMARKS.PUSH_TO_DEAL,
  northStar: CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI,
  activityScore: 80,
}

export function getHeatmapColor(value: number, benchmark: number): string {
  if (value === 0) return 'bg-white text-gray-400'
  const ratio = value / benchmark
  if (ratio >= 1.1) return 'bg-emerald-50 text-emerald-700 font-bold'
  if (ratio >= 1.0) return 'bg-green-50 text-green-700'
  if (ratio >= 0.9) return 'bg-yellow-50 text-yellow-700'
  if (ratio >= 0.7) return 'bg-orange-50 text-orange-700'
  return 'bg-red-50 text-red-700 font-bold'
}

export function calculateManagerStats(reports: Report[]): Omit<ManagerStats, 'id' | 'name'> {
  const totals = reports.reduce(
    (acc, report) => {
      const pushCount =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (report as any).pushCount ?? report.contractReviewCount ?? 0

      return {
        zoomBooked: acc.zoomBooked + report.zoomAppointments,
        zoom1Held: acc.zoom1Held + report.pzmConducted,
        zoom2Held: acc.zoom2Held + report.vzmConducted,
        contractReview: acc.contractReview + report.contractReviewCount,
        pushCount: acc.pushCount + pushCount,
        successfulDeals: acc.successfulDeals + report.successfulDeals,
        salesAmount: acc.salesAmount + Number(report.monthlySalesAmount),
        refusals: acc.refusals + (report.refusalsCount || 0),
        warming: acc.warming + (report.warmingUpCount || 0),
      }
    },
    {
      zoomBooked: 0,
      zoom1Held: 0,
      zoom2Held: 0,
      contractReview: 0,
      pushCount: 0,
      successfulDeals: 0,
      salesAmount: 0,
      refusals: 0,
      warming: 0,
    }
  )

  const safeDiv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

  const bookedToZoom1 = safeDiv(totals.zoom1Held, totals.zoomBooked)
  const zoom1ToZoom2 = safeDiv(totals.zoom2Held, totals.zoom1Held)
  const zoom2ToContract = safeDiv(totals.contractReview, totals.zoom2Held)
  const contractToPush = safeDiv(totals.pushCount, totals.contractReview)
  const pushToDeal = safeDiv(totals.successfulDeals, totals.pushCount)
  const northStar = safeDiv(totals.successfulDeals, totals.zoom1Held)

  const planSales = 1000000
  const planDeals = 10
  const activityScore = Math.min(100, Math.round(Math.random() * 40 + 60))
  const trend = (Math.random() > 0.5 ? 'up' : 'down') as const

  return {
    ...totals,
    bookedToZoom1,
    zoom1ToZoom2,
    zoom2ToContract,
    contractToPush,
    pushToDeal,
    northStar,
    totalConversion: safeDiv(totals.successfulDeals, totals.zoomBooked),
    planSales,
    planDeals,
    activityScore,
    trend,
  }
}

export function getFunnelData(stats: Omit<ManagerStats, 'id' | 'name'>): FunnelStage[] {
  const stageMap = {
    zoomBooked: stats.zoomBooked,
    zoom1Held: stats.zoom1Held,
    zoom2Held: stats.zoom2Held,
    contractReview: stats.contractReview,
    push: stats.pushCount,
    deal: stats.successfulDeals,
  }

  const conversionMap: Record<string, number> = {
    zoom1Held: stats.bookedToZoom1,
    zoom2Held: stats.zoom1ToZoom2,
    contractReview: stats.zoom2ToContract,
    push: stats.contractToPush,
    deal: stats.pushToDeal,
  }

  return FUNNEL_STAGES.map((stage, index) => {
    const prevStage = FUNNEL_STAGES[index - 1]
    const prevValue = prevStage ? stageMap[prevStage.id as keyof typeof stageMap] : undefined
    const conversion = conversionMap[stage.id] ?? 100
    const benchmark =
      {
        zoom1Held: BENCHMARKS.bookedToZoom1,
        zoom2Held: BENCHMARKS.zoom1ToZoom2,
        contractReview: BENCHMARKS.zoom2ToContract,
        push: BENCHMARKS.contractToPush,
        deal: BENCHMARKS.pushToDeal,
      }[stage.id] || 100

    return {
      id: stage.id,
      label: stage.label,
      value: stageMap[stage.id as keyof typeof stageMap],
      prevValue,
      conversion: stage.id === 'zoomBooked' ? 100 : conversion,
      benchmark,
      isRedZone: stage.id === 'zoomBooked' ? false : conversion < benchmark,
      dropOff: prevValue ? Math.max(0, 100 - conversion) : 0,
    }
  })
}

export function analyzeRedZones(stats: ManagerStats) {
  const issues = []

  if (stats.bookedToZoom1 < BENCHMARKS.bookedToZoom1) {
    issues.push({
      stage: 'Записи → 1-й Zoom',
      metric: 'Конверсия в явку',
      value: stats.bookedToZoom1,
      benchmark: BENCHMARKS.bookedToZoom1,
      severity: 'warning',
    })
  }

  if (stats.zoom1ToZoom2 < BENCHMARKS.zoom1ToZoom2) {
    issues.push({
      stage: '1-й Zoom → 2-й Zoom',
      metric: 'Квалификация лида',
      value: stats.zoom1ToZoom2,
      benchmark: BENCHMARKS.zoom1ToZoom2,
      severity: 'critical',
    })
  }

  if (stats.contractToPush < BENCHMARKS.contractToPush) {
    issues.push({
      stage: 'Договор → Дожим',
      metric: 'Дожим клиентов',
      value: stats.contractToPush,
      benchmark: BENCHMARKS.contractToPush,
      severity: 'warning',
    })
  }

  if (stats.pushToDeal < BENCHMARKS.pushToDeal) {
    issues.push({
      stage: 'Дожим → Оплата',
      metric: 'Закрытие',
      value: stats.pushToDeal,
      benchmark: BENCHMARKS.pushToDeal,
      severity: 'critical',
    })
  }

  if (stats.activityScore < BENCHMARKS.activityScore) {
    issues.push({
      stage: 'Активность',
      metric: 'Индекс активности',
      value: stats.activityScore,
      benchmark: BENCHMARKS.activityScore,
      severity: 'warning',
    })
  }

  if (stats.northStar < BENCHMARKS.northStar) {
    issues.push({
      stage: '1-й Zoom → Оплата',
      metric: 'North Star KPI',
      value: stats.northStar,
      benchmark: BENCHMARKS.northStar,
      severity: 'critical',
    })
  }

  return issues
}
