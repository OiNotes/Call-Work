import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const _user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // day, week, month

    // Определить период
    const { startDate, endDate } = getPeriodDates(period)

    // Получить всех активных сотрудников
    const employees = await prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        isActive: true
      },
      include: {
        reports: {
          where: {
            date: { gte: startDate, lte: endDate }
          }
        }
      }
    })

    // Рассчитать статистику для лидерборда
    const leaderboard = employees.map(emp => {
      const stats = emp.reports.reduce((acc, r) => ({
        deals: acc.deals + r.successfulDeals,
        sales: acc.sales + Number(r.monthlySalesAmount),
        zoom: acc.zoom + r.zoomAppointments,
        pzm: acc.pzm + r.pzmConducted,
        vzm: acc.vzm + r.vzmConducted
      }), { deals: 0, sales: 0, zoom: 0, pzm: 0, vzm: 0 })

      // Средний чек
      const avgCheck = stats.deals > 0 ? Math.round(stats.sales / stats.deals) : 0

      // Прогресс к цели (если установлена)
      const goalProgress = emp.monthlyGoal
        ? Math.round((stats.sales / Number(emp.monthlyGoal)) * 100)
        : null

      // Финальная конверсия (ВЗМ → Сделка)
      const finalConversion = stats.vzm > 0
        ? Math.round((stats.deals / stats.vzm) * 100)
        : 0

      return {
        id: emp.id,
        name: emp.name,
        deals: stats.deals,
        sales: stats.sales,
        avgCheck,
        goalProgress,
        finalConversion,
        activities: {
          zoom: stats.zoom,
          pzm: stats.pzm,
          vzm: stats.vzm
        }
      }
    })

    // Сортировать по продажам
    leaderboard.sort((a, b) => b.sales - a.sales)

    // Добавить позиции и медали
    const leaderboardWithRanks = leaderboard.map((item, index) => {
      let medal: string | undefined
      if (index === 0) medal = 'gold'
      else if (index === 1) medal = 'silver'
      else if (index === 2) medal = 'bronze'

      return {
        ...item,
        rank: index + 1,
        medal
      }
    })

    return NextResponse.json({
      leaderboard: leaderboardWithRanks,
      period: { start: startDate, end: endDate, type: period },
      stats: {
        totalEmployees: employees.length,
        totalSales: leaderboard.reduce((sum, item) => sum + item.sales, 0),
        totalDeals: leaderboard.reduce((sum, item) => sum + item.deals, 0)
      }
    })

  } catch (error) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// Утилита для определения дат периода
function getPeriodDates(period: string) {
  const now = new Date()
  let startDate: Date
  const endDate: Date = new Date() // Сегодня

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'week':
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      startDate = new Date(now)
      startDate.setDate(now.getDate() + mondayOffset)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
  }

  return { startDate, endDate }
}
