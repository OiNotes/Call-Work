import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding forecast data...')

  // Get all employees with monthlyGoal
  const employees = await prisma.user.findMany({
    where: {
      role: 'EMPLOYEE',
      monthlyGoal: { not: null }
    }
  })

  console.log(`Found ${employees.length} employees with monthly goals`)

  // Current date and month boundaries
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentDay = now.getDate()

  console.log(`Generating data from ${startOfMonth.toISOString()} to ${now.toISOString()}`)
  console.log(`Days passed: ${currentDay}`)

  // Delete existing reports for current month to avoid duplicates
  await prisma.report.deleteMany({
    where: {
      date: {
        gte: startOfMonth,
        lte: now
      }
    }
  })
  console.log('✓ Cleared existing reports for current month')

  // Generate reports for each employee
  for (const employee of employees) {
    const monthlyGoal = Number(employee.monthlyGoal)
    const dailyTarget = monthlyGoal / 30 // примерная дневная цель

    console.log(`\nGenerating data for ${employee.name}:`)
    console.log(`  Monthly goal: ${monthlyGoal.toLocaleString()} ₽`)
    console.log(`  Daily target: ${dailyTarget.toLocaleString()} ₽`)

    // Создаём отчёты за каждый день месяца до сегодня
    for (let day = 1; day <= currentDay; day++) {
      const reportDate = new Date(now.getFullYear(), now.getMonth(), day)

      // Симуляция разной эффективности:
      // - 70% дней - хорошие продажи (90-110% от цели)
      // - 20% дней - средние (50-80%)
      // - 10% дней - плохие (0-30%)
      const rand = Math.random()
      let performance: number

      if (rand < 0.7) {
        // Хорошие дни (90-110% от дневной цели)
        performance = 0.9 + Math.random() * 0.2
      } else if (rand < 0.9) {
        // Средние дни (50-80%)
        performance = 0.5 + Math.random() * 0.3
      } else {
        // Плохие дни (0-30%)
        performance = Math.random() * 0.3
      }

      const dailySales = Math.round(dailyTarget * performance)
      const deals = dailySales > 0 ? Math.floor(dailySales / 100000) + Math.floor(Math.random() * 2) : 0

      // Генерируем данные по воронке
      const zoomBooked = Math.floor(Math.random() * 8) + 5
      const zoom1Held = Math.floor(zoomBooked * (0.7 + Math.random() * 0.2))
      const zoom2Held = Math.floor(zoom1Held * (0.6 + Math.random() * 0.2))
      const contractReview = Math.floor(zoom2Held * (0.7 + Math.random() * 0.2))
      const pushCount = Math.floor(contractReview * (0.8 + Math.random() * 0.2))

      await prisma.report.create({
        data: {
          userId: employee.id,
          date: reportDate,
          zoomAppointments: zoomBooked,
          pzmConducted: zoom1Held,
          vzmConducted: zoom2Held,
          contractReviewCount: contractReview,
          pushCount: pushCount,
          successfulDeals: deals,
          monthlySalesAmount: dailySales,
          refusalsCount: Math.floor(Math.random() * 3),
          warmingUpCount: Math.floor(Math.random() * 2),
          comment: performance > 0.9 ? 'Отличный день!' : performance < 0.3 ? 'Сложный день' : null
        }
      })
    }

    // Подсчитаем итого за месяц
    const totalSales = await prisma.report.aggregate({
      where: {
        userId: employee.id,
        date: {
          gte: startOfMonth,
          lte: now
        }
      },
      _sum: {
        monthlySalesAmount: true,
        successfulDeals: true
      }
    })

    const total = Number(totalSales._sum.monthlySalesAmount || 0)
    const completion = ((total / monthlyGoal) * 100).toFixed(1)

    console.log(`  ✓ Created ${currentDay} reports`)
    console.log(`  Total sales: ${total.toLocaleString()} ₽ (${completion}% of goal)`)
    console.log(`  Total deals: ${totalSales._sum.successfulDeals || 0}`)
  }

  console.log('\n✨ Forecast data seeding completed!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
