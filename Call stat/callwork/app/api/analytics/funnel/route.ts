import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

interface FunnelStage {
  stage: string
  value: number
  conversion: number
  isRedZone: boolean
}

interface EmployeeConversion {
  id: string
  name: string
  conversions: {
    pzmToPzm: number
    pzmToVzm: number
    vzmToDeal: number
  }
  totals: {
    zoom: number
    pzm: number
    vzm: number
    deals: number
    sales: number
  }
  redZones: string[]
}

interface FunnelResponse {
  funnel: FunnelStage[]
  employeeConversions: EmployeeConversion[]
  period: {
    start: Date
    end: Date
  }
  totals: {
    zoom: number
    pzm: number
    vzm: number
    deals: number
    sales: number
  }
  topPerformers: EmployeeConversion[]
  bottomPerformers: EmployeeConversion[]
}

/**
 * GET /api/analytics/funnel
 * 
 * Рентген воронки продаж с расчётом конверсий и выявлением красных зон
 * 
 * Query параметры:
 * - startDate: начало периода (ISO string)
 * - endDate: конец периода (ISO string)
 * - userId: опциональный фильтр по сотруднику (доступен только менеджерам)
 * 
 * Красные зоны (thresholds):
 * - ПЗМ → ПЗМ: < 60%
 * - ПЗМ → ВЗМ: < 60%
 * - ВЗМ → Сделка: < 70%
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    
    // Парсинг параметров
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const userIdParam = searchParams.get('userId')
    
    // Установка дефолтных дат (текущий месяц)
    const now = new Date()
    const startDate = startDateParam 
      ? new Date(startDateParam) 
      : new Date(now.getFullYear(), now.getMonth(), 1)
    const endDate = endDateParam 
      ? new Date(endDateParam) 
      : new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // Проверка прав доступа для фильтрации по userId
    let targetUserId: string | undefined
    if (userIdParam) {
      if (user.role === 'MANAGER') {
        targetUserId = userIdParam
      } else if (userIdParam !== user.id) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot access other users data' },
          { status: 403 }
        )
      } else {
        targetUserId = user.id
      }
    }

    // 1. АГРЕГАЦИЯ ОБЩИХ ДАННЫХ ЗА ПЕРИОД
    const whereClause: Prisma.ReportWhereInput = {
      date: { gte: startDate, lte: endDate },
      ...(targetUserId && { userId: targetUserId }),
    }

    const aggregate = await prisma.report.aggregate({
      where: whereClause,
      _sum: {
        zoomAppointments: true,
        pzmConducted: true,
        vzmConducted: true,
        successfulDeals: true,
        monthlySalesAmount: true,
      },
    })

    // 2. РАСЧЁТ ВОРОНКИ И КОНВЕРСИЙ
    const totals = {
      zoom: aggregate._sum.zoomAppointments || 0,
      pzm: aggregate._sum.pzmConducted || 0,
      vzm: aggregate._sum.vzmConducted || 0,
      deals: aggregate._sum.successfulDeals || 0,
      sales: Number(aggregate._sum.monthlySalesAmount || 0),
    }

    // Конверсии между этапами
    const conversionPzmToPzm = totals.zoom > 0 
      ? (totals.pzm / totals.zoom) * 100 
      : 0
    const conversionPzmToVzm = totals.pzm > 0 
      ? (totals.vzm / totals.pzm) * 100 
      : 0
    const conversionVzmToDeal = totals.vzm > 0 
      ? (totals.deals / totals.vzm) * 100 
      : 0

    // Красные зоны (thresholds)
    const THRESHOLD_PZM_TO_PZM = 60
    const THRESHOLD_PZM_TO_VZM = 60
    const THRESHOLD_VZM_TO_DEAL = 70

    const funnel: FunnelStage[] = [
      {
        stage: 'ПЗМ Записи',
        value: totals.zoom,
        conversion: 100,
        isRedZone: false,
      },
      {
        stage: 'ПЗМ Проведено',
        value: totals.pzm,
        conversion: Math.round(conversionPzmToPzm * 100) / 100,
        isRedZone: conversionPzmToPzm < THRESHOLD_PZM_TO_PZM,
      },
      {
        stage: 'ВЗМ Проведено',
        value: totals.vzm,
        conversion: Math.round(conversionPzmToVzm * 100) / 100,
        isRedZone: conversionPzmToVzm < THRESHOLD_PZM_TO_VZM,
      },
      {
        stage: 'Сделки',
        value: totals.deals,
        conversion: Math.round(conversionVzmToDeal * 100) / 100,
        isRedZone: conversionVzmToDeal < THRESHOLD_VZM_TO_DEAL,
      },
    ]

    // 3. DRILL-DOWN ПО СОТРУДНИКАМ
    const employees = await prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        isActive: true,
        ...(targetUserId && { id: targetUserId }),
      },
      include: {
        reports: {
          where: { date: { gte: startDate, lte: endDate } },
        },
      },
    })

    const employeeConversions: EmployeeConversion[] = employees
      .map((emp) => {
        const empTotals = emp.reports.reduce(
          (acc, r) => ({
            zoom: acc.zoom + r.zoomAppointments,
            pzm: acc.pzm + r.pzmConducted,
            vzm: acc.vzm + r.vzmConducted,
            deals: acc.deals + r.successfulDeals,
            sales: acc.sales + Number(r.monthlySalesAmount),
          }),
          { zoom: 0, pzm: 0, vzm: 0, deals: 0, sales: 0 }
        )

        const empConvPzmToPzm = empTotals.zoom > 0 
          ? (empTotals.pzm / empTotals.zoom) * 100 
          : 0
        const empConvPzmToVzm = empTotals.pzm > 0 
          ? (empTotals.vzm / empTotals.pzm) * 100 
          : 0
        const empConvVzmToDeal = empTotals.vzm > 0 
          ? (empTotals.deals / empTotals.vzm) * 100 
          : 0

        // Определяем красные зоны для сотрудника
        const redZones: string[] = []
        if (empConvPzmToPzm < THRESHOLD_PZM_TO_PZM) redZones.push('ПЗМ→ПЗМ')
        if (empConvPzmToVzm < THRESHOLD_PZM_TO_VZM) redZones.push('ПЗМ→ВЗМ')
        if (empConvVzmToDeal < THRESHOLD_VZM_TO_DEAL) redZones.push('ВЗМ→Сделка')

        return {
          id: emp.id,
          name: emp.name,
          conversions: {
            pzmToPzm: Math.round(empConvPzmToPzm * 100) / 100,
            pzmToVzm: Math.round(empConvPzmToVzm * 100) / 100,
            vzmToDeal: Math.round(empConvVzmToDeal * 100) / 100,
          },
          totals: empTotals,
          redZones,
        }
      })
      .sort((a, b) => {
        // Сортировка по финальной конверсии (ВЗМ→Сделка)
        return b.conversions.vzmToDeal - a.conversions.vzmToDeal
      })

    // TOP-3 и BOTTOM-3 сотрудников
    const topPerformers = employeeConversions.slice(0, 3)
    const bottomPerformers = employeeConversions.slice(-3).reverse()

    const response: FunnelResponse = {
      funnel,
      employeeConversions,
      period: { start: startDate, end: endDate },
      totals,
      topPerformers,
      bottomPerformers,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Funnel API error:', error)
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
