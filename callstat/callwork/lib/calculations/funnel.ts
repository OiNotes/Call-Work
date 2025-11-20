import {
  CONVERSION_BENCHMARKS,
  FUNNEL_STAGES,
  FunnelStageId,
} from '@/lib/config/conversionBenchmarks'

export interface RefusalBreakdown {
  stageId: FunnelStageId
  label: string
  count: number
  rate: number // % от входа на этап
}

export interface FunnelTotals {
  zoomBooked: number
  zoom1Held: number
  zoom2Held: number
  contractReview: number
  push: number
  deals: number
  sales?: number
  refusals?: number
  warming?: number
  refusalByStage?: Partial<Record<Exclude<FunnelStageId, 'deal'>, number>>
}

export interface FunnelStage {
  id: FunnelStageId
  stage: string
  value: number
  conversion: number
  benchmark: number
  isRedZone: boolean
}

export interface SideFlow {
  refusals: {
    total: number
    rateFromFirstZoom: number
    byStage: RefusalBreakdown[]
  }
  warming: {
    count: number
  }
}

export interface NorthStarKpi {
  value: number
  target: number
  delta: number
  isOnTrack: boolean
}

export interface FullFunnelResult {
  funnel: FunnelStage[]
  sideFlow: SideFlow
  northStarKpi: NorthStarKpi
}

const round2 = (num: number) => Math.round(num * 100) / 100
const safeRate = (value: number, base: number) => (base > 0 ? round2((value / base) * 100) : 0)

const metaById = new Map(FUNNEL_STAGES.map((stage) => [stage.id, stage]))

const getStageLabel = (id: FunnelStageId) => metaById.get(id)?.label ?? id

export function calculateFullFunnel(totals: FunnelTotals): FullFunnelResult {
  const values: Record<FunnelStageId, number> = {
    zoomBooked: totals.zoomBooked || 0,
    zoom1Held: totals.zoom1Held || 0,
    zoom2Held: totals.zoom2Held || 0,
    contractReview: totals.contractReview || 0,
    push: totals.push || 0,
    deal: totals.deals || 0,
  }

  const conversionPairs: Array<{
    id: FunnelStageId
    prevId: FunnelStageId
    benchmark: number
    label: string
  }> = [
    {
      id: 'zoom1Held',
      prevId: 'zoomBooked',
      benchmark: CONVERSION_BENCHMARKS.BOOKED_TO_ZOOM1,
      label: getStageLabel('zoom1Held'),
    },
    {
      id: 'zoom2Held',
      prevId: 'zoom1Held',
      benchmark: CONVERSION_BENCHMARKS.ZOOM1_TO_ZOOM2,
      label: getStageLabel('zoom2Held'),
    },
    {
      id: 'contractReview',
      prevId: 'zoom2Held',
      benchmark: CONVERSION_BENCHMARKS.ZOOM2_TO_CONTRACT,
      label: getStageLabel('contractReview'),
    },
    {
      id: 'push',
      prevId: 'contractReview',
      benchmark: CONVERSION_BENCHMARKS.CONTRACT_TO_PUSH,
      label: getStageLabel('push'),
    },
    {
      id: 'deal',
      prevId: 'push',
      benchmark: CONVERSION_BENCHMARKS.PUSH_TO_DEAL,
      label: getStageLabel('deal'),
    },
  ]

  const funnel: FunnelStage[] = [
    {
      id: 'zoomBooked',
      stage: getStageLabel('zoomBooked'),
      value: values.zoomBooked,
      conversion: 100,
      benchmark: 100,
      isRedZone: false,
    },
    ...conversionPairs.map(({ id, prevId, benchmark, label }) => {
      const conversion = safeRate(values[id], values[prevId])
      return {
        id,
        stage: label,
        value: values[id],
        conversion,
        benchmark,
        isRedZone: conversion < benchmark,
      }
    }),
  ]

  const northStarValue = safeRate(values.deal, values.zoom1Held)
  const northStarKpi: NorthStarKpi = {
    value: northStarValue,
    target: CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI,
    delta: round2(northStarValue - CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI),
    isOnTrack: northStarValue >= CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI,
  }

  // Отказы по этапам (fallback: считаем все после 1-го Zoom)
  const refusalStages = FUNNEL_STAGES.filter((stage) => stage.id !== 'deal').map((stage) => stage.id)
  const breakdown: RefusalBreakdown[] = refusalStages.map((stageId) => {
    const count =
      totals.refusalByStage?.[stageId as Exclude<FunnelStageId, 'deal'>] ??
      (stageId === 'zoom1Held' ? totals.refusals || 0 : 0)

    const baseCount =
      stageId === 'zoomBooked'
        ? values.zoomBooked
        : stageId === 'zoom1Held'
        ? values.zoom1Held
        : stageId === 'zoom2Held'
        ? values.zoom2Held
        : stageId === 'contractReview'
        ? values.contractReview
        : values.push

    return {
      stageId,
      label: getStageLabel(stageId),
      count,
      rate: safeRate(count, baseCount),
    }
  })

  const totalRefusals =
    breakdown.reduce((sum, item) => sum + item.count, 0) || totals.refusals || 0

  const sideFlow: SideFlow = {
    refusals: {
      total: totalRefusals,
      rateFromFirstZoom: safeRate(totalRefusals, Math.max(values.zoom1Held, values.zoomBooked)),
      byStage: breakdown,
    },
    warming: {
      count: totals.warming || 0,
    },
  }

  return { funnel, sideFlow, northStarKpi }
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ru-RU').format(num)
}

export function formatPercent(num: number): string {
  return `${round2(num).toFixed(2)}%`
}

export function getConversionColor(conversion: number, isRedZone: boolean): string {
  if (isRedZone) return '#EF4444'
  if (conversion >= 70) return '#10B981'
  return '#F59E0B'
}
