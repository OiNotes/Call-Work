import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const manager = await prisma.user.findUnique({
    where: { email: 'manager@callwork.com' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      monthlyGoal: true,
      _count: {
        select: {
          employees: true
        }
      }
    }
  })

  if (!manager) {
    console.error('❌ Manager not found!')
    return
  }

  console.log('Manager details:')
  console.log('  Name:', manager.name)
  console.log('  Email:', manager.email)
  console.log('  Role:', manager.role)
  console.log('  Monthly Goal:', manager.monthlyGoal ? `${Number(manager.monthlyGoal).toLocaleString()} ₽` : 'NOT SET')
  console.log('  Employees count:', manager._count.employees)
  console.log('')

  // Check employees and their reports
  const employees = await prisma.user.findMany({
    where: {
      managerId: manager.id,
      role: 'EMPLOYEE'
    },
    select: {
      id: true,
      name: true,
      monthlyGoal: true,
      _count: {
        select: {
          reports: true
        }
      }
    }
  })

  console.log(`Found ${employees.length} employees:`)
  for (const emp of employees) {
    console.log(`  - ${emp.name}: goal=${Number(emp.monthlyGoal || 0).toLocaleString()}₽, reports=${emp._count.reports}`)
  }

  // Check November reports for team
  const novemberReports = await prisma.report.findMany({
    where: {
      userId: { in: employees.map(e => e.id) },
      date: {
        gte: new Date('2025-11-01'),
        lte: new Date('2025-11-30')
      }
    },
    select: {
      monthlySalesAmount: true
    }
  })

  const totalNovemberSales = novemberReports.reduce((sum, r) => sum + Number(r.monthlySalesAmount), 0)

  console.log('')
  console.log('November stats:')
  console.log('  Total team reports:', novemberReports.length)
  console.log('  Total team sales:', totalNovemberSales.toLocaleString(), '₽')
  console.log('  Manager goal:', manager.monthlyGoal ? Number(manager.monthlyGoal).toLocaleString() : 'NOT SET', '₽')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
