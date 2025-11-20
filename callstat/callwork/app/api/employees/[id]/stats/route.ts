import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/get-session'
import { calculateManagerStats } from '@/lib/analytics/funnel'
import { calculateFullFunnel } from '@/lib/calculations/funnel'
import { CONVERSION_BENCHMARKS } from '@/lib/config/conversionBenchmarks'
import { getDateRange } from '@/lib/analytics/conversions'

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

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, role: true, managerId: true },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const employeeReports = await prisma.report.findMany({
      where: {
        userId: employeeId,
        date: { gte: startDate, lte: endDate },
      },
    })

    const employeeStats = calculateManagerStats(employeeReports)

    const teamMembers = await prisma.user.findMany({
      where: {
        managerId: employee.managerId,
        isActive: true,
        role: 'EMPLOYEE',
        NOT: { id: employeeId },
      },
      include: {
        reports: {
          where: { date: { gte: startDate, lte: endDate } },
        },
      },
    })

    const teamReports = teamMembers.flatMap((member) => member.reports)
    const teamTotals = calculateManagerStats(teamReports)
    const teamCount = teamMembers.length || 1

    const teamAverageCounts = {
      zoomBooked: Math.round(teamTotals.zoomBooked / teamCount),
      zoom1Held: Math.round(teamTotals.zoom1Held / teamCount),
      zoom2Held: Math.round(teamTotals.zoom2Held / teamCount),
      contractReview: Math.round(teamTotals.contractReview / teamCount),
      pushCount: Math.round(teamTotals.pushCount / teamCount),
      successfulDeals: Math.round(teamTotals.successfulDeals / teamCount),
      salesAmount: Math.round(teamTotals.salesAmount / teamCount),
    }

    const redZones = []

    if (employeeStats.bookedToZoom1 < CONVERSION_BENCHMARKS.BOOKED_TO_ZOOM1) {
      redZones.push({
        metric: 'Запись → 1-й Zoom',
        current: employeeStats.bookedToZoom1,
        teamAverage: teamTotals.bookedToZoom1,
        gap: teamTotals.bookedToZoom1 - employeeStats.bookedToZoom1,
        recommendation: 'Проверьте подтверждение записей и напоминания перед Зумом.',
      })
    }

    if (employeeStats.zoom1ToZoom2 < CONVERSION_BENCHMARKS.ZOOM1_TO_ZOOM2) {
      redZones.push({
        metric: '1-й → 2-й Zoom',
        current: employeeStats.zoom1ToZoom2,
        teamAverage: teamTotals.zoom1ToZoom2,
        gap: teamTotals.zoom1ToZoom2 - employeeStats.zoom1ToZoom2,
        recommendation: 'Сфокусируйтесь на выявлении потребностей и назначении следующего шага.',
      })
    }

    if (employeeStats.pushToDeal < CONVERSION_BENCHMARKS.PUSH_TO_DEAL) {
      redZones.push({
        metric: 'Дожим → Оплата',
        current: employeeStats.pushToDeal,
        teamAverage: teamTotals.pushToDeal,
        gap: teamTotals.pushToDeal - employeeStats.pushToDeal,
        recommendation: 'Пересмотрите работу с возражениями и дедлайнами оплаты.',
      })
    }

    if (employeeStats.northStar < CONVERSION_BENCHMARKS.ZOOM1_TO_DEAL_KPI) {
      redZones.push({
        metric: 'Главный KPI',
        current: employeeStats.northStar,
        teamAverage: teamTotals.northStar,
        gap: teamTotals.northStar - employeeStats.northStar,
        recommendation: 'Увеличьте долю оплат от первых Zoom, слушайте проблемные записи.',
      })
    }

    const employeeFunnel = calculateFullFunnel({
      zoomBooked: employeeStats.zoomBooked,
      zoom1Held: employeeStats.zoom1Held,
      zoom2Held: employeeStats.zoom2Held,
      contractReview: employeeStats.contractReview,
      push: employeeStats.pushCount,
      deals: employeeStats.successfulDeals,
      sales: employeeStats.salesAmount,
      refusals: employeeStats.refusals,
      warming: employeeStats.warming,
    })

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
      },
      stats: {
        ...employeeStats,
        avgCheck:
          employeeStats.successfulDeals > 0
            ? Math.round(employeeStats.salesAmount / employeeStats.successfulDeals)
            : 0,
      },
      teamAverage: {
        ...teamAverageCounts,
        bookedToZoom1: teamTotals.bookedToZoom1,
        zoom1ToZoom2: teamTotals.zoom1ToZoom2,
        zoom2ToContract: teamTotals.zoom2ToContract,
        contractToPush: teamTotals.contractToPush,
        pushToDeal: teamTotals.pushToDeal,
        northStar: teamTotals.northStar,
        avgCheck:
          teamAverageCounts.successfulDeals > 0
            ? Math.round(teamAverageCounts.salesAmount / teamAverageCounts.successfulDeals)
            : 0,
      },
      teamSize: teamMembers.length,
      redZones,
      funnel: employeeFunnel.funnel,
      sideFlow: employeeFunnel.sideFlow,
      northStarKpi: employeeFunnel.northStarKpi,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    })
  } catch (error) {
    console.error('GET /api/employees/[id]/stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
