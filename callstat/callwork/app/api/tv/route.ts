import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, subDays } from 'date-fns'

// Helper to calculate trends
function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

// Get TV dashboard data
async function getTVData() {
  const today = startOfDay(new Date())
  const yesterday = subDays(today, 1)

  // Get all employees
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', isActive: true },
    select: {
      id: true,
      name: true,
      monthlyGoal: true,
    },
  })

  // Get today's reports
  const todayReports = await prisma.report.findMany({
    where: {
      date: { gte: today },
      userId: { in: employees.map(e => e.id) },
    },
    include: { user: true },
  })

  // Get yesterday's reports for trends
  const yesterdayReports = await prisma.report.findMany({
    where: {
      date: { gte: yesterday, lt: today },
      userId: { in: employees.map(e => e.id) },
    },
  })

  // Calculate KPIs
  const todaySales = todayReports.reduce((sum, r) => sum + Number(r.monthlySalesAmount), 0)
  const todayDeals = todayReports.reduce((sum, r) => sum + r.successfulDeals, 0)
  const todayCalls = todayReports.reduce((sum, r) => sum + r.pzmConducted + r.vzmConducted, 0)
  const todayAppointments = todayReports.reduce((sum, r) => sum + r.zoomAppointments, 0)

  const yesterdaySales = yesterdayReports.reduce((sum, r) => sum + Number(r.monthlySalesAmount), 0)
  const yesterdayDeals = yesterdayReports.reduce((sum, r) => sum + r.successfulDeals, 0)
  const yesterdayCalls = yesterdayReports.reduce((sum, r) => sum + r.pzmConducted + r.vzmConducted, 0)
  const yesterdayAppointments = yesterdayReports.reduce((sum, r) => sum + r.zoomAppointments, 0)

  // Calculate conversion rate and average deal size
  const conversionRate = todayCalls > 0 ? Math.round((todayDeals / todayCalls) * 100 * 10) / 10 : 0
  const yesterdayConversionRate = yesterdayCalls > 0 ? Math.round((yesterdayDeals / yesterdayCalls) * 100 * 10) / 10 : 0

  const averageDealSize = todayDeals > 0 ? Math.round(todaySales / todayDeals) : 0
  const yesterdayAverageDealSize = yesterdayDeals > 0 ? Math.round(yesterdaySales / yesterdayDeals) : 0

  // Build leaderboard
  const leaderboard = employees
    .map((emp) => {
      const empReports = todayReports.filter(r => r.userId === emp.id)
      const sales = empReports.reduce((sum, r) => sum + Number(r.monthlySalesAmount), 0)
      const deals = empReports.reduce((sum, r) => sum + r.successfulDeals, 0)
      const goal = Number(emp.monthlyGoal) || 100000
      const progress = Math.round((sales / goal) * 100)

      return {
        id: emp.id,
        rank: 0, // Will be set after sorting
        name: emp.name,
        sales,
        deals,
        goal,
        progress,
      }
    })
    .sort((a, b) => b.sales - a.sales)
    .map((item, index) => ({ ...item, rank: index + 1 }))
    .slice(0, 10) // Top 10

  // Build activity feed
  const recentReports = await prisma.report.findMany({
    where: { date: { gte: today } },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const feed = recentReports
    .filter(r => r.successfulDeals > 0 || Number(r.monthlySalesAmount) > 0)
    .map(r => {
      const deals = r.successfulDeals
      const amount = Number(r.monthlySalesAmount)

      if (amount > 500000) {
        return {
          id: r.id,
          user: r.user.name,
          type: 'MILESTONE' as const,
          amount,
          deals,
          message: `${r.user.name} достиг ${Math.round(amount / 1000)}K₽ продаж!`,
          time: formatTime(r.createdAt),
        }
      } else if (deals > 0) {
        return {
          id: r.id,
          user: r.user.name,
          type: 'SALE' as const,
          amount,
          deals,
          message: `${r.user.name} закрыл ${deals} ${pluralize(deals)} на ${formatMoney(amount)}`,
          time: formatTime(r.createdAt),
        }
      }

      return {
        id: r.id,
        user: r.user.name,
        type: 'DEAL' as const,
        deals,
        message: `${r.user.name} совершил ${deals} ${pluralize(deals)}`,
        time: formatTime(r.createdAt),
      }
    })
    .slice(0, 10)

  return {
    kpi: {
      sales: todaySales,
      deals: todayDeals,
      calls: todayCalls,
      appointments: todayAppointments,
      conversionRate,
      averageDealSize,
      trends: {
        sales: calculateTrend(todaySales, yesterdaySales),
        deals: calculateTrend(todayDeals, yesterdayDeals),
        calls: calculateTrend(todayCalls, yesterdayCalls),
        appointments: calculateTrend(todayAppointments, yesterdayAppointments),
        conversionRate: calculateTrend(conversionRate, yesterdayConversionRate),
        averageDealSize: calculateTrend(averageDealSize, yesterdayAverageDealSize),
      },
    },
    leaderboard,
    feed,
  }
}

// Format helpers
function formatTime(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000) // seconds

  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatMoney(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M₽`
  if (value >= 1000) return `${Math.round(value / 1000)}K₽`
  return `${Math.round(value)}₽`
}

function pluralize(count: number): string {
  if (count === 1) return 'сделку'
  if (count >= 2 && count <= 4) return 'сделки'
  return 'сделок'
}

// SSE streaming endpoint
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data
      try {
        const data = await getTVData()
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      } catch (error) {
        console.error('Failed to get TV data:', error)
      }

      // Broadcast updates every 10 seconds
      const updateInterval = setInterval(async () => {
        try {
          const data = await getTVData()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch (error) {
          console.error('Failed to broadcast update:', error)
        }
      }, 10000)

      // Heartbeat every 30 seconds
      const heartbeatInterval = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, 30000)

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(updateInterval)
        clearInterval(heartbeatInterval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
