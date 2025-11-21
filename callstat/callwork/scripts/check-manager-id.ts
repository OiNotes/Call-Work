import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get manager
  const manager = await prisma.user.findUnique({
    where: { email: 'manager@callwork.com' },
    select: { id: true, name: true }
  })

  if (!manager) {
    console.error('❌ Manager not found!')
    return
  }

  console.log(`Manager: ${manager.name}`)
  console.log(`Manager ID: ${manager.id}\n`)

  // Get all employees with their managerId
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: {
      id: true,
      name: true,
      managerId: true
    }
  })

  console.log('Employees and their managerIds:\n')
  for (const emp of employees) {
    const isCorrect = emp.managerId === manager.id
    const symbol = isCorrect ? '✓' : '✗'
    console.log(`${symbol} ${emp.name}`)
    console.log(`    managerId: ${emp.managerId || 'NULL'}`)
    console.log(`    expected:  ${manager.id}`)
    console.log(`    match: ${isCorrect ? 'YES' : 'NO'}`)
    console.log('')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
