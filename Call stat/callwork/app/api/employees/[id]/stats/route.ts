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

    // Получить информацию о сотруднике для поиска коллег
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        role: true,
        managerId: true
      }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Получить всех активных сотрудников того же менеджера (коллеги)
    const teamMembers = await prisma.user.findMany({
      where: {
        managerId: employee.managerId,
        isActive: true,
        role: 'EMPLOYEE',
        NOT: { id: employeeId } // Исключить самого сотрудника
      },
      include: {
        reports: {
          where: {
            date: { gte: startDate, lte: endDate }
          }
        }
      }
    })

    // Агрегировать данные команды
    const teamTotals = teamMembers.reduce((acc, member) => {
      const memberTotal = member.reports.reduce((sum, r) => ({
        zoom: sum.zoom + r.zoomAppointments,
        pzm: sum.pzm + r.pzmConducted,
        vzm: sum.vzm + r.vzmConducted,
        deals: sum.deals + r.successfulDeals,
        sales: sum.sales + Number(r.monthlySalesAmount)
      }), { zoom: 0, pzm: 0, vzm: 0, deals: 0, sales: 0 })

      return {
        zoom: acc.zoom + memberTotal.zoom,
        pzm: acc.pzm + memberTotal.pzm,
        vzm: acc.vzm + memberTotal.vzm,
        deals: acc.deals + memberTotal.deals,
        sales: acc.sales + memberTotal.sales
      }
    }, { zoom: 0, pzm: 0, vzm: 0, deals: 0, sales: 0 })

    // Средние значения (делим на количество сотрудников)
    const teamCount = teamMembers.length
    const teamAverage = {
      zoomAppointments: teamCount > 0 ? Math.round(teamTotals.zoom / teamCount) : 0,
      pzmConducted: teamCount > 0 ? Math.round(teamTotals.pzm / teamCount) : 0,
      vzmConducted: teamCount > 0 ? Math.round(teamTotals.vzm / teamCount) : 0,
      successfulDeals: teamCount > 0 ? Math.round(teamTotals.deals / teamCount) : 0,
      monthlySalesAmount: teamCount > 0 ? Math.round(teamTotals.sales / teamCount) : 0,
    }

    // Конверсии команды
    const teamConversions = calculateConversions({
      zoomAppointments: teamTotals.zoom,
      pzmConducted: teamTotals.pzm,
      vzmConducted: teamTotals.vzm,
      successfulDeals: teamTotals.deals,
      monthlySalesAmount: teamTotals.sales
    })

    // Определение красных зон (где отклонение > 10%)
    const redZones = []

    if (conversions.pzmConversion < teamConversions.pzmConversion - 10) {
      redZones.push({
        metric: 'Конверсия ПЗМ',
        current: conversions.pzmConversion,
        teamAverage: teamConversions.pzmConversion,
        gap: teamConversions.pzmConversion - conversions.pzmConversion,
        recommendation: 'Проверьте качество подготовки к первичным встречам. Возможно, стоит улучшить скрипт приглашения.'
      })
    }

    if (conversions.pzToVzmConversion < teamConversions.pzToVzmConversion - 10) {
      redZones.push({
        metric: 'Конверсия ВЗМ',
        current: conversions.pzToVzmConversion,
        teamAverage: teamConversions.pzToVzmConversion,
        gap: teamConversions.pzToVzmConversion - conversions.pzToVzmConversion,
        recommendation: 'Улучшите проведение первичных встреч. Фокус на выявление потребностей и презентацию ценности.'
      })
    }

    if (conversions.vzmToDealConversion < teamConversions.vzmToDealConversion - 10) {
      redZones.push({
        metric: 'Конверсия в сделку',
        current: conversions.vzmToDealConversion,
        teamAverage: teamConversions.vzmToDealConversion,
        gap: teamConversions.vzmToDealConversion - conversions.vzmToDealConversion,
        recommendation: 'Работайте над закрытием сделок. Возможно, нужно улучшить работу с возражениями.'
      })
    }

    // Проверить количественные показатели
    if (teamCount > 0 && stats.successfulDeals < teamAverage.successfulDeals * 0.7) {
      redZones.push({
        metric: 'Количество сделок',
        current: stats.successfulDeals,
        teamAverage: teamAverage.successfulDeals,
        gap: teamAverage.successfulDeals - stats.successfulDeals,
        recommendation: 'Увеличьте активность. Больше встреч = больше сделок.'
      })
    }

    // Персональная воронка с сравнением
    const funnel = [
      {
        stage: 'Zoom записи',
        value: stats.zoomAppointments,
        teamAverage: teamAverage.zoomAppointments,
        isAboveAverage: stats.zoomAppointments >= teamAverage.zoomAppointments
      },
      {
        stage: 'ПЗМ проведено',
        value: stats.pzmConducted,
        conversion: conversions.pzmConversion,
        teamConversion: teamConversions.pzmConversion,
        isAboveAverage: conversions.pzmConversion >= teamConversions.pzmConversion
      },
      {
        stage: 'ВЗМ проведено',
        value: stats.vzmConducted,
        conversion: conversions.pzToVzmConversion,
        teamConversion: teamConversions.pzToVzmConversion,
        isAboveAverage: conversions.pzToVzmConversion >= teamConversions.pzToVzmConversion
      },
      {
        stage: 'Сделки',
        value: stats.successfulDeals,
        conversion: conversions.vzmToDealConversion,
        teamConversion: teamConversions.vzmToDealConversion,
        isAboveAverage: conversions.vzmToDealConversion >= teamConversions.vzmToDealConversion
      }
    ]

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role
      },
      stats: {
        ...stats,
        ...conversions,
        avgCheck: stats.successfulDeals > 0 ? Math.round(stats.monthlySalesAmount / stats.successfulDeals) : 0,
      },
      teamAverage: {
        ...teamAverage,
        ...teamConversions,
        avgCheck: teamAverage.successfulDeals > 0 ? Math.round(teamAverage.monthlySalesAmount / teamAverage.successfulDeals) : 0,
      },
      teamSize: teamCount,
      redZones,
      funnel,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    })
  } catch (error) {
    console.error('GET /api/employees/[id]/stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
