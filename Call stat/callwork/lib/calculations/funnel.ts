/**
 * Утилиты для расчёта воронки конверсии
 */

export interface FunnelTotals {
  zoom: number
  pzm: number
  vzm: number
  contract: number
  deals: number
  sales: number
  refusals: number
  warming: number
}

export interface FunnelStage {
  stage: string
  value: number
  conversion: number
  isRedZone: boolean
}

export interface SideFlow {
  refusals: {
    count: number
    rate: number // % от ПЗМ
  }
  warming: {
    count: number
  }
}

// Thresholds для красных зон
export const THRESHOLDS = {
  PZM_TO_PZM: 60,
  PZM_TO_VZM: 60,
  VZM_TO_CONTRACT: 60,
  CONTRACT_TO_DEAL: 70,
}

/**
 * Расчёт полной воронки с 5 этапами
 */
export function calculateFullFunnel(totals: FunnelTotals): {
  funnel: FunnelStage[]
  sideFlow: SideFlow
} {
  // Конверсии между этапами
  const convPzmToPzm = totals.zoom > 0 ? (totals.pzm / totals.zoom) * 100 : 0
  const convPzmToVzm = totals.pzm > 0 ? (totals.vzm / totals.pzm) * 100 : 0
  const convVzmToContract = totals.vzm > 0 ? (totals.contract / totals.vzm) * 100 : 0
  const convContractToDeal = totals.contract > 0 ? (totals.deals / totals.contract) * 100 : 0

  // Воронка из 5 этапов
  const funnel: FunnelStage[] = [
    {
      stage: 'Zoom Записи',
      value: totals.zoom,
      conversion: 100,
      isRedZone: false,
    },
    {
      stage: 'ПЗМ Проведено',
      value: totals.pzm,
      conversion: Math.round(convPzmToPzm * 100) / 100,
      isRedZone: convPzmToPzm < THRESHOLDS.PZM_TO_PZM,
    },
    {
      stage: 'ВЗМ Проведено',
      value: totals.vzm,
      conversion: Math.round(convPzmToVzm * 100) / 100,
      isRedZone: convPzmToVzm < THRESHOLDS.PZM_TO_VZM,
    },
    {
      stage: 'Разбор договора',
      value: totals.contract,
      conversion: Math.round(convVzmToContract * 100) / 100,
      isRedZone: convVzmToContract < THRESHOLDS.VZM_TO_CONTRACT,
    },
    {
      stage: 'Сделки',
      value: totals.deals,
      conversion: Math.round(convContractToDeal * 100) / 100,
      isRedZone: convContractToDeal < THRESHOLDS.CONTRACT_TO_DEAL,
    },
  ]

  // Боковая ветка (Отказы + Подогрев)
  const sideFlow: SideFlow = {
    refusals: {
      count: totals.refusals,
      rate: totals.pzm > 0 ? Math.round((totals.refusals / totals.pzm) * 100 * 100) / 100 : 0,
    },
    warming: {
      count: totals.warming,
    },
  }

  return { funnel, sideFlow }
}

/**
 * Форматирование числа с разделителями
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ru-RU').format(num)
}

/**
 * Форматирование процента
 */
export function formatPercent(num: number): string {
  return `${num.toFixed(1)}%`
}

/**
 * Определение цвета по конверсии
 */
export function getConversionColor(conversion: number, isRedZone: boolean): string {
  if (isRedZone) return '#EF4444' // red
  if (conversion >= 70) return '#10B981' // green
  return '#F59E0B' // yellow
}
