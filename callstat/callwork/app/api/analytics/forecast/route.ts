import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateMonthlyForecast, generateForecastChartData } from '@/lib/calculations/forecast'

/**
 * GET /api/analytics/forecast
 * 
 * Query params:
 * - userId: string (опционально, для менеджеров - смотреть прогноз сотрудника)
 * - month: string (опционально, формат: YYYY-MM, по умолчанию текущий месяц)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Получить пользователя
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, monthlyGoal: true }
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')
    const monthParam = searchParams.get('month')

    // Определить пользователя для анализа
    let targetUserId = currentUser.id
    
    if (userIdParam) {
      // Менеджер может смотреть прогноз своих сотрудников
      if (currentUser.role === 'MANAGER') {
        targetUserId = userIdParam
      } else {
        return NextResponse.json(
          { error: 'Forbidden: only managers can view other users\' forecasts' },
          { status: 403 }
        )
      }
    }

    // Получить данные пользователя
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { 
        id: true, 
        name: true, 
        monthlyGoal: true,
        role: true 
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // Если нет цели - вернуть ошибку
    if (!targetUser.monthlyGoal) {
      return NextResponse.json({
        error: 'Monthly goal not set',
        message: 'Пользователь не имеет установленной месячной цели'
      }, { status: 400 })
    }

    // Определить период (текущий месяц или указанный)
    let startDate: Date
    let endDate: Date

    if (monthParam) {
      const [year, month] = monthParam.split('-').map(Number)
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0, 23, 59, 59)
    } else {
      const now = new Date()
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    }

    // Получить отчёты за период
    const reports = await prisma.report.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        date: true,
        monthlySalesAmount: true,
        successfulDeals: true
      },
      orderBy: { date: 'asc' }
    })

    // Рассчитать текущую сумму продаж
    const currentSales = reports.reduce(
      (sum, report) => sum + Number(report.monthlySalesAmount),
      0
    )

    // Рассчитать прогноз
    const monthlyGoal = Number(targetUser.monthlyGoal)
    const forecast = calculateMonthlyForecast(currentSales, monthlyGoal)

    // Подготовить данные по дням для графика
    const dailySales = reports.map(report => ({
      day: report.date.getDate(),
      sales: Number(report.monthlySalesAmount)
    }))

    const chartData = generateForecastChartData(currentSales, monthlyGoal, dailySales)

    return NextResponse.json({
      user: {
        id: targetUser.id,
        name: targetUser.name,
        role: targetUser.role
      },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        isCurrentMonth: !monthParam
      },
      forecast,
      chartData
    })

  } catch (error) {
    console.error('Forecast API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
