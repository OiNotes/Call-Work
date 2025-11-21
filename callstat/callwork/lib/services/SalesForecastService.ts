import { prisma } from '@/lib/prisma'
import { calculateMonthlyForecast, generateForecastChartData } from '@/lib/calculations/forecast'
import { GoalService } from '@/lib/services/GoalService'

export class SalesForecastService {
  /**
   * Get forecast for the entire department (manager + subordinates)
   */
  async getDepartmentForecast(managerId: string) {
    // 1. Get all users in the department (manager + reports)
    const team = await prisma.user.findMany({
      where: {
        OR: [
          { id: managerId },
          { managerId: managerId }
        ],
        isActive: true
      },
      select: {
        id: true,
        name: true,
        monthlyGoal: true
      }
    })

    const teamIds = team.map(u => u.id)

    // 2. Get sales data for the current month for all team members
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const reports = await prisma.report.findMany({
      where: {
        userId: { in: teamIds },
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      select: {
        date: true,
        monthlySalesAmount: true,
        userId: true
      }
    })

    // 3. Aggregate data
    let currentTotalSales = 0
    const dailySalesMap = new Map<number, number>()

    // Get team goal through unified service
    const totalGoal = await GoalService.getTeamGoal(managerId)

    // Sum sales and group by day
    reports.forEach(report => {
      const amount = Number(report.monthlySalesAmount)
      currentTotalSales += amount
      
      const day = report.date.getDate()
      const currentDaySum = dailySalesMap.get(day) || 0
      dailySalesMap.set(day, currentDaySum + amount)
    })

    // Prepare daily sales array for chart
    const dailySales = Array.from(dailySalesMap.entries()).map(([day, sales]) => ({
      day,
      sales
    })).sort((a, b) => a.day - b.day)

    // 4. Calculate Forecast Metrics
    const forecastMetrics = calculateMonthlyForecast(currentTotalSales, totalGoal)
    
    // 5. Generate Chart Data
    const chartData = generateForecastChartData(currentTotalSales, totalGoal, dailySales)

    return {
      metrics: forecastMetrics,
      chartData,
      teamSize: team.length
    }
  }
}
