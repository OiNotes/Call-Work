import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get manager
  const manager = await prisma.user.findUnique({
    where: { email: 'manager@callwork.com' }
  })

  if (!manager) {
    console.error('❌ Manager not found!')
    return
  }

  // Get all employees and their goals
  const employees = await prisma.user.findMany({
    where: {
      managerId: manager.id,
      role: 'EMPLOYEE',
      monthlyGoal: { not: null }
    },
    select: {
      name: true,
      monthlyGoal: true
    }
  })

  const totalGoal = employees.reduce((sum, emp) => sum + Number(emp.monthlyGoal || 0), 0)

  console.log(`Manager: ${manager.name}`)
  console.log(`Team size: ${employees.length} employees`)
  console.log(`Total team goal: ${totalGoal.toLocaleString()} ₽\n`)

  // Set manager's goal = team total
  await prisma.user.update({
    where: { id: manager.id },
    data: { monthlyGoal: totalGoal }
  })

  console.log(`✓ Set manager monthlyGoal = ${totalGoal.toLocaleString()} ₽`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
