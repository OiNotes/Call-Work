import { prisma } from '@/lib/prisma'
import { DealStatus, PaymentStatus } from '@prisma/client'
import { MOTIVATION_GRADE_PRESETS, MotivationGradeConfig } from '@/lib/config/motivationGrades'
import { calculateMotivation, MotivationCalculationResult } from '@/lib/motivation/motivationCalculator'

export interface MotivationPeriod {
  startDate: Date
  endDate: Date
}

export interface MotivationSummaryPayload {
  summary: MotivationCalculationResult
  grades: MotivationGradeConfig[]
}

async function loadGrades(): Promise<MotivationGradeConfig[]> {
  const grades = await prisma.motivationGrade.findMany({
    orderBy: { minTurnover: 'asc' },
  })

  if (!grades || grades.length === 0) {
    return MOTIVATION_GRADE_PRESETS
  }

  return grades.map((grade) => ({
    minTurnover: Number(grade.minTurnover),
    maxTurnover: grade.maxTurnover === null ? null : Number(grade.maxTurnover),
    commissionRate: Number(grade.commissionRate),
  }))
}

export async function getMotivationSummaryForManagers(
  managerIds: string[],
  period: MotivationPeriod
): Promise<MotivationSummaryPayload> {
  if (managerIds.length === 0) {
    return {
      grades: MOTIVATION_GRADE_PRESETS,
      summary: calculateMotivation({
        factTurnover: 0,
        hotTurnover: 0,
        grades: MOTIVATION_GRADE_PRESETS,
      }),
    }
  }

  const grades = await loadGrades()

  const [factAgg, hotAgg] = await Promise.all([
    prisma.deal.aggregate({
      where: {
        managerId: { in: managerIds },
        status: DealStatus.WON,
        paymentStatus: PaymentStatus.PAID,
        OR: [
          {
            paidAt: {
              gte: period.startDate,
              lte: period.endDate,
            },
          },
          {
            closedAt: {
              gte: period.startDate,
              lte: period.endDate,
            },
          },
        ],
      },
      _sum: { budget: true },
    }),
    prisma.deal.aggregate({
      where: {
        managerId: { in: managerIds },
        status: DealStatus.OPEN,
        isFocus: true,
      },
      _sum: { budget: true },
    }),
  ])

  const factTurnover = Number(factAgg._sum.budget || 0)
  const hotTurnover = Number(hotAgg._sum.budget || 0)

  return {
    grades,
    summary: calculateMotivation({
      factTurnover,
      hotTurnover,
      grades,
    }),
  }
}
