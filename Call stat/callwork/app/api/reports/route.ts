import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { broadcastDeal } from '../sse/deals/route'
import { broadcastActivity } from '../sse/activities/route'

const createReportSchema = z.object({
  date: z.string().datetime(),
  zoomAppointments: z.number().int().min(0),
  pzmConducted: z.number().int().min(0),
  refusalsCount: z.number().int().min(0),
  refusalsReasons: z.string().optional(),
  refusalsByStage: z
    .object({
      zoomBooked: z.number().int().min(0).optional(),
      zoom1Held: z.number().int().min(0).optional(),
      zoom2Held: z.number().int().min(0).optional(),
      contractReview: z.number().int().min(0).optional(),
      push: z.number().int().min(0).optional(),
    })
    .optional(),
  warmingUpCount: z.number().int().min(0),
  vzmConducted: z.number().int().min(0),
  contractReviewCount: z.number().int().min(0),
  pushCount: z.number().int().min(0),
  successfulDeals: z.number().int().min(0),
  monthlySalesAmount: z.number().min(0),
  comment: z.string().optional(),
})

export async function GET(req: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userId = searchParams.get('userId')

    let targetUserId = user.id
    if (userId && user.role === 'MANAGER') {
      targetUserId = userId
    }

    const reports = await prisma.report.findMany({
      where: {
        userId: targetUserId,
        ...(startDate && endDate && {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      },
      orderBy: {
        date: 'desc',
      },
    })

    return NextResponse.json({ reports })
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    
    const data = createReportSchema.parse(body)

    const existingReport = await prisma.report.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: new Date(data.date),
        },
      },
    })

    if (existingReport) {
      return NextResponse.json(
        { error: 'Report for this date already exists' },
        { status: 400 }
      )
    }

    const report = await prisma.report.create({
      data: {
        userId: user.id,
        date: new Date(data.date),
        zoomAppointments: data.zoomAppointments,
        pzmConducted: data.pzmConducted,
        refusalsCount: data.refusalsCount,
        refusalsReasons: data.refusalsReasons,
        refusalsByStage: data.refusalsByStage || undefined,
        warmingUpCount: data.warmingUpCount,
        vzmConducted: data.vzmConducted,
        contractReviewCount: data.contractReviewCount,
        pushCount: data.pushCount,
        successfulDeals: data.successfulDeals,
        monthlySalesAmount: new Decimal(data.monthlySalesAmount),
        comment: data.comment,
      },
    })

    // Broadcast сделки в реальном времени если есть успешные сделки
    if (data.successfulDeals > 0) {
      broadcastDeal({
        employeeId: user.id,
        employeeName: user.name,
        amount: data.monthlySalesAmount,
        dealsCount: data.successfulDeals
      })
    }

    // Broadcast активности
    broadcastActivity({
      type: data.successfulDeals > 0 ? 'deal' : 'report',
      message: data.successfulDeals > 0
        ? `${user.name} закрыл ${data.successfulDeals} ${pluralizeDeal(data.successfulDeals)}`
        : `${user.name} отправил отчёт`,
      details: data.successfulDeals > 0
        ? `Сумма: ${formatMoney(data.monthlySalesAmount)}₽`
        : `Zoom: ${data.zoomAppointments}, ПЗМ: ${data.pzmConducted}`,
      userId: user.id,
      userName: user.name
    })

    return NextResponse.json({ report })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function pluralizeDeal(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'сделку'
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'сделки'
  return 'сделок'
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}
