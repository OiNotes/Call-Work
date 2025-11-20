// Minimal smoke tests for funnel calculations and KPI
import { calculateFullFunnel } from '@/lib/calculations/funnel'
import { CONVERSION_BENCHMARKS } from '@/lib/config/benchmarks'

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`)
  }
}

function assertClose(actual: number, expected: number, delta = 0.001, message?: string) {
  if (Math.abs(actual - expected) > delta) {
    throw new Error(`${message || 'values differ'}: expected ${expected}, got ${actual}`)
  }
}

// Step-to-step conversion and KPI
{
  const { funnel, northStarKpi } = calculateFullFunnel({
    zoomBooked: 10,
    zoom1Held: 8,
    zoom2Held: 4,
    contractReview: 3,
    push: 2,
    deals: 1,
  })

  // Запись → 1-й Zoom
  assertClose(funnel.find((s) => s.id === 'zoom1Held')?.conversion || 0, 80, 0.01, 'zoom1 conv')
  // 1-й → 2-й Zoom
  assertClose(funnel.find((s) => s.id === 'zoom2Held')?.conversion || 0, 50, 0.01, 'zoom2 conv')
  // 2-й → Договор
  assertClose(funnel.find((s) => s.id === 'contractReview')?.conversion || 0, 75, 0.01, 'contract conv')
  // Договор → Дожим
  assertClose(funnel.find((s) => s.id === 'push')?.conversion || 0, 66.67, 0.1, 'push conv')
  // Дожим → Оплата
  assertClose(funnel.find((s) => s.id === 'deal')?.conversion || 0, 50, 0.01, 'deal conv')

  // North Star KPI: оплаты / 1-й Zoom
  assertClose(northStarKpi.value, 12.5, 0.01, 'north star value')
  assertEqual(northStarKpi.target, CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI, 'north star target')
}

// Refusals aggregation by stage
{
  const { sideFlow } = calculateFullFunnel({
    zoomBooked: 20,
    zoom1Held: 10,
    zoom2Held: 5,
    contractReview: 3,
    push: 2,
    deals: 1,
    refusalByStage: { zoom1Held: 2, zoom2Held: 1, contractReview: 1, push: 0 },
  })

  assertEqual(sideFlow.refusals.total, 4, 'total refusals')
  const zoom1Refusal = sideFlow.refusals.byStage.find((s) => s.stageId === 'zoom1Held')
  assertClose(zoom1Refusal?.rate || 0, 20, 0.01, 'zoom1 refusal rate')
}

console.log('analytics tests passed')
