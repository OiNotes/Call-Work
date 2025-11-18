import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
      },
      _avg: {
        monthlySalesAmount: true,
      },
      _count: true,
    })

    const pzmConversion = stats._sum.zoomAppointments 
      ? (stats._sum.pzmConducted! / stats._sum.zoomAppointments) * 100 
      : 0

    const vzmConversion = stats._sum.pzmConducted
      ? (stats._sum.vzmConducted! / stats._sum.pzmConducted) * 100
      : 0

    const dealConversion = stats._sum.vzmConducted
      ? (stats._sum.successfulDeals! / stats._sum.vzmConducted) * 100
      : 0

    return NextResponse.json({
      totals: stats._sum,
      averages: stats._avg,
      count: stats._count,
      conversions: {
        pzmConversion: parseFloat(pzmConversion.toFixed(2)),
        vzmConversion: parseFloat(vzmConversion.toFixed(2)),
        dealConversion: parseFloat(dealConversion.toFixed(2)),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
