import { prisma } from '@/lib/prisma'
import { calculateMonthlyForecast } from '@/lib/calculations/forecast'

export class MotivationCalculatorService {
  // Progressive scale (turnover -> percent)
  // This could be fetched from DB (MotivationGrade), but hardcoded for robustness per prompt requirements
  private readonly GRADES = [
    { min: 0, percent: 0.05 },       // 0 - ... : 5%
    { min: 500000, percent: 0.07 },  // 500k+   : 7%
    { min: 1000000, percent: 0.08 }, // 1m+     : 8%
    { min: 1500000, percent: 0.09 }, // 1.5m+   : 9%
    { min: 2000000, percent: 0.10 }, // 2m+     : 10%
  ]

  private getCommissionRate(turnover: number): number {
    let rate = 0.05
    for (const grade of this.GRADES) {
      if (turnover >= grade.min) {
        rate = grade.percent
      }
    }
    return rate
  }

  async calculateIncomeForecast(userId: string) {
    // 1. Get User & Goal
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { monthlyGoal: true, role: true }
    })

    if (!user) {
       // Return empty structure instead of crashing
       return {
         sales: { current: 0, projected: 0, optimistic: 0, goal: 0, focusDealsAmount: 0 },
         rates: { current: 0.05, projected: 0.05, optimistic: 0.05 },
         income: { current: 0, projected: 0, optimistic: 0, projectedGrowth: 0, potentialGrowth: 0 },
         grades: this.GRADES
       }
    }
    const monthlyGoal = Number(user.monthlyGoal || 0)

    // 2. Get Current Sales (Fact)
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const reports = await prisma.report.findMany({
      where: {
        userId: userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      select: { monthlySalesAmount: true }
    })

    const currentSales = reports.reduce((sum, r) => sum + Number(r.monthlySalesAmount), 0)

    // 3. Get Open Deals (Both Focus and Non-Focus)
    const openDeals = await prisma.deal.findMany({
      where: {
        managerId: userId,
        status: 'OPEN'
      },
      select: {
        id: true,
        title: true,
        budget: true,
        isFocus: true,
        createdAt: true
      },
      orderBy: { budget: 'desc' }
    })

    const potentialFocusAmount = openDeals
        .filter(d => d.isFocus)
        .reduce((sum, d) => sum + Number(d.budget), 0)

    // 4. Calculations
    
    // A. FACT
    const currentRate = this.getCommissionRate(currentSales)
    const currentCommission = currentSales * currentRate

    // B. FORECAST (Linear extrapolation)
    const forecastMetrics = calculateMonthlyForecast(currentSales, monthlyGoal)
    const projectedSales = forecastMetrics.projected
    const projectedRate = this.getCommissionRate(projectedSales)
    const projectedCommission = projectedSales * projectedRate

    // C. POTENTIAL (Forecast + Focus Deals)
    // Assumption: Focus deals are closed ON TOP of the linear forecast? 
    // Or are they part of the "remaining" goal?
    // Usually, "Focus" means "I will close these specific deals".
    // Let's add them to the projected total to show "Optimistic" scenario.
    const optimisticSales = projectedSales + potentialFocusAmount
    const optimisticRate = this.getCommissionRate(optimisticSales)
    const optimisticCommission = optimisticSales * optimisticRate

    return {
      sales: {
        current: currentSales,
        projected: projectedSales,
        optimistic: optimisticSales,
        goal: monthlyGoal,
        focusDealsAmount: potentialFocusAmount
      },
      rates: {
        current: currentRate,
        projected: projectedRate,
        optimistic: optimisticRate
      },
      income: {
        current: currentCommission,
        projected: projectedCommission,
        optimistic: optimisticCommission,
        projectedGrowth: projectedCommission - currentCommission,
        potentialGrowth: optimisticCommission - projectedCommission
      },
      grades: this.GRADES,
      deals: openDeals // Return the list for the UI
    }
  }
}
