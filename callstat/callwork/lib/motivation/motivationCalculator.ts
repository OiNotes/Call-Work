import { MOTIVATION_GRADE_PRESETS, MotivationGradeConfig } from '@/lib/config/motivationGrades'

export interface MotivationCalculationInput {
  factTurnover: number
  hotTurnover: number
  grades?: MotivationGradeConfig[]
  forecastWeight?: number
}

export interface MotivationCalculationResult {
  factTurnover: number
  hotTurnover: number
  forecastTurnover: number
  totalPotentialTurnover: number
  factRate: number
  forecastRate: number
  salaryFact: number
  salaryForecast: number
  potentialGain: number
}

const DEFAULT_FORECAST_WEIGHT = 0.5

export function resolveCommissionRate(
  turnover: number,
  grades?: MotivationGradeConfig[]
): number {
  const source = grades && grades.length > 0 ? grades : MOTIVATION_GRADE_PRESETS
  const sorted = [...source].sort((a, b) => a.minTurnover - b.minTurnover)

  for (const grade of sorted) {
    const max = grade.maxTurnover ?? Number.POSITIVE_INFINITY
    if (turnover >= grade.minTurnover && turnover < max) {
      return grade.commissionRate
    }
  }

  return sorted.length > 0 ? sorted[sorted.length - 1].commissionRate : 0
}

export function calculateMotivation(
  input: MotivationCalculationInput
): MotivationCalculationResult {
  const { factTurnover, hotTurnover, grades, forecastWeight = DEFAULT_FORECAST_WEIGHT } = input

  const safeFact = Number.isFinite(factTurnover) ? factTurnover : 0
  const safeHot = Number.isFinite(hotTurnover) ? hotTurnover : 0

  const forecastTurnover = safeHot * forecastWeight
  const totalPotentialTurnover = safeFact + forecastTurnover

  const factRate = resolveCommissionRate(safeFact, grades)
  const forecastRate = resolveCommissionRate(totalPotentialTurnover, grades)

  const salaryFact = safeFact * factRate
  const salaryForecast = totalPotentialTurnover * forecastRate
  const potentialGain = salaryForecast - salaryFact

  return {
    factTurnover: safeFact,
    hotTurnover: safeHot,
    forecastTurnover,
    totalPotentialTurnover,
    factRate,
    forecastRate,
    salaryFact,
    salaryForecast,
    potentialGain,
  }
}
