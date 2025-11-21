import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      monthlyGoal: true,
      _count: {
        select: {
          reports: true
        }
      }
    }
  })
  
  console.log('=== USERS ===')
  for (const user of users) {
    console.log(`${user.name} (${user.email})`)
    console.log(`  Role: ${user.role}`)
    console.log(`  Monthly Goal: ${user.monthlyGoal}`)
    console.log(`  Reports: ${user._count.reports}`)
    console.log('')
  }
  
  // Check reports count
  const reportsCount = await prisma.report.count({
    where: {
      date: {
        gte: new Date('2025-11-01'),
        lte: new Date('2025-11-21')
      }
    }
  })
  
  console.log(`\n=== REPORTS FOR NOVEMBER ===`)
  console.log(`Total reports: ${reportsCount}`)
  
  // Check sales by user
  const salesByUser = await prisma.report.groupBy({
    by: ['userId'],
    where: {
      date: {
        gte: new Date('2025-11-01'),
        lte: new Date('2025-11-21')
      }
    },
    _sum: {
      monthlySalesAmount: true,
      successfulDeals: true
    }
  })
  
  console.log('\n=== SALES BY USER ===')
  for (const sale of salesByUser) {
    const user = users.find(u => u.id === sale.userId)
    console.log(`${user?.name}: ${sale._sum.monthlySalesAmount} ₽, ${sale._sum.successfulDeals} deals`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
