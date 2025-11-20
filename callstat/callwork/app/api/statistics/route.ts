import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { calculateFullFunnel } from '@/lib/calculations/funnel'

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

    const whereClause: Prisma.ReportWhereInput = {
      userId: targetUserId,
      ...(startDate && endDate && {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    }

    const stats = await prisma.report.aggregate({
      where: whereClause,
      _sum: {
        zoomAppointments: true,
        pzmConducted: true,
        refusalsCount: true,
        warmingUpCount: true,
        vzmConducted: true,
        contractReviewCount: true,
        successfulDeals: true,
        monthlySalesAmount: true,
        pushCount: true,
      },
      _avg: {
        monthlySalesAmount: true,
      },
      _count: true,
    })

    const totals = {
      zoomBooked: stats._sum.zoomAppointments || 0,
      zoom1Held: stats._sum.pzmConducted || 0,
      zoom2Held: stats._sum.vzmConducted || 0,
      contractReview: stats._sum.contractReviewCount || 0,
      push: (stats._sum.pushCount as number | null) ?? stats._sum.contractReviewCount ?? 0,
      deals: stats._sum.successfulDeals || 0,
      sales: Number(stats._sum.monthlySalesAmount || 0),
      refusals: stats._sum.refusalsCount || 0,
      warming: stats._sum.warmingUpCount || 0,
    }

    const fullFunnel = calculateFullFunnel(totals)

    const conversions = fullFunnel.funnel
      .filter((stage) => stage.id !== 'zoomBooked')
      .reduce<Record<string, number>>((acc, stage) => {
        acc[stage.id] = stage.conversion
        return acc
      }, {})

    return NextResponse.json({
      totals: stats._sum,
      averages: stats._avg,
      count: stats._count,
      conversions,
      northStar: fullFunnel.northStarKpi,
      sideFlow: fullFunnel.sideFlow,
    })
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
