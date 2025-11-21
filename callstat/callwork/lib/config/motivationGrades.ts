export interface MotivationGradeConfig {
  minTurnover: number
  maxTurnover?: number | null
  commissionRate: number // доля, например 0.05 = 5%
}

export const MOTIVATION_GRADE_PRESETS: MotivationGradeConfig[] = [
  { minTurnover: 0, maxTurnover: 600_000, commissionRate: 0 },
  { minTurnover: 600_000, maxTurnover: 1_000_000, commissionRate: 0.05 },
  { minTurnover: 1_000_000, maxTurnover: 2_000_000, commissionRate: 0.07 },
  { minTurnover: 2_000_000, maxTurnover: 3_500_000, commissionRate: 0.08 },
  { minTurnover: 3_500_000, maxTurnover: 4_000_000, commissionRate: 0.09 },
  { minTurnover: 4_000_000, maxTurnover: null, commissionRate: 0.1 },
]
