import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/get-session'
import { calculateConversions, getDateRange } from '@/lib/analytics/conversions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { id: employeeId } = await params
    
    // Проверка прав: менеджер может смотреть своих работников, работник только себя
    if (user.role === 'EMPLOYEE' && user.id !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    if (user.role === 'MANAGER') {
      const employee = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { managerId: true }
      })
      
      if (!employee || employee.managerId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    
    const { searchParams } = new URL(request.url)
    const range = (searchParams.get('range') as 'week' | 'month' | 'quarter' | 'year') || 'month'
    const { startDate, endDate } = getDateRange(range)
    
    // Статистика работника
    const reports = await prisma.report.aggregate({
      where: {
        userId: employeeId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
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
      _count: true
    })
    
    const stats = {
      zoomAppointments: reports._sum.zoomAppointments || 0,
      pzmConducted: reports._sum.pzmConducted || 0,
      vzmConducted: reports._sum.vzmConducted || 0,
      successfulDeals: reports._sum.successfulDeals || 0,
      monthlySalesAmount: Number(reports._sum.monthlySalesAmount || 0),
      refusalsCount: reports._sum.refusalsCount || 0,
      warmingUpCount: reports._sum.warmingUpCount || 0,
      contractReviewCount: reports._sum.contractReviewCount || 0,
    }
    
    const conversions = calculateConversions(stats)
    
    // Средние показатели по команде (для сравнения)
    const teamStats = await prisma.report.aggregate({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        zoomAppointments: true,
        pzmConducted: true,
        vzmConducted: true,
        successfulDeals: true,
      }
    })
    
    const teamConversions = calculateConversions({
      zoomAppointments: teamStats._sum.zoomAppointments || 0,
      pzmConducted: teamStats._sum.pzmConducted || 0,
      vzmConducted: teamStats._sum.vzmConducted || 0,
      successfulDeals: teamStats._sum.successfulDeals || 0,
      monthlySalesAmount: 0,
    })
    
    return NextResponse.json({
      stats: {
        ...stats,
        ...conversions,
        avgCheck: stats.successfulDeals > 0 ? Math.round(stats.monthlySalesAmount / stats.successfulDeals) : 0,
      },
      teamAverageConversions: teamConversions,
    })
  } catch (error) {
    console.error('GET /api/employees/[id]/stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
