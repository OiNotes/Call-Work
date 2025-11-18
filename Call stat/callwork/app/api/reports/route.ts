import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

const createReportSchema = z.object({
  date: z.string().datetime(),
  zoomAppointments: z.number().int().min(0),
  pzmConducted: z.number().int().min(0),
  refusalsCount: z.number().int().min(0),
  refusalsReasons: z.string().optional(),
  warmingUpCount: z.number().int().min(0),
  vzmConducted: z.number().int().min(0),
  contractReviewCount: z.number().int().min(0),
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
        warmingUpCount: data.warmingUpCount,
        vzmConducted: data.vzmConducted,
        contractReviewCount: data.contractReviewCount,
        successfulDeals: data.successfulDeals,
        monthlySalesAmount: new Decimal(data.monthlySalesAmount),
        comment: data.comment,
      },
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
