import { calculateMotivation, resolveCommissionRate } from '@/lib/motivation/motivationCalculator'
import { MOTIVATION_GRADE_PRESETS } from '@/lib/config/motivationGrades'

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

// Commission resolution across ranges
{
  const rate = resolveCommissionRate(750_000, MOTIVATION_GRADE_PRESETS)
  assertClose(rate, 0.05, 0.0001, 'rate for 750k must be 5%')

  const rateTop = resolveCommissionRate(4_500_000, MOTIVATION_GRADE_PRESETS)
  assertClose(rateTop, 0.1, 0.0001, 'rate for top bracket must be 10%')
}

// Core calculator math
{
  const result = calculateMotivation({
    factTurnover: 700_000,
    hotTurnover: 600_000,
    grades: MOTIVATION_GRADE_PRESETS,
  })

  assertEqual(result.forecastTurnover, 300_000, 'forecast turnover (50% of hot)')
  assertEqual(result.totalPotentialTurnover, 1_000_000, 'total potential turnover')
  assertClose(result.factRate, 0.05, 0.0001, 'fact rate')
  assertClose(result.forecastRate, 0.07, 0.0001, 'forecast rate (1M tier)')
  assertClose(result.salaryFact, 35_000, 0.01, 'fact salary')
  assertClose(result.salaryForecast, 70_000, 0.01, 'forecast salary')
  assertClose(result.potentialGain, 35_000, 0.01, 'potential gain difference')
}

// Safe defaults on empty data
{
  const result = calculateMotivation({
    factTurnover: 0,
    hotTurnover: 0,
    grades: [],
  })

  assertEqual(result.totalPotentialTurnover, 0, 'zero potential when no turnover')
  assertEqual(result.salaryForecast, 0, 'zero salary forecast')
}

console.log('motivation calculator tests passed')
