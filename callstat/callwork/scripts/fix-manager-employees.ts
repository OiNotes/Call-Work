import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing manager-employee relationships...\n')

  // Find the manager
  const manager = await prisma.user.findUnique({
    where: { email: 'manager@callwork.com' }
  })

  if (!manager) {
    console.error('❌ Manager not found!')
    return
  }

  console.log(`✓ Found manager: ${manager.name} (ID: ${manager.id})\n`)

  // Find all employees without managerId
  const employees = await prisma.user.findMany({
    where: {
      role: 'EMPLOYEE',
      OR: [
        { managerId: null },
        { managerId: { not: manager.id } }
      ]
    }
  })

  console.log(`Found ${employees.length} employees to update:\n`)

  // Update each employee
  for (const employee of employees) {
    await prisma.user.update({
      where: { id: employee.id },
      data: { managerId: manager.id }
    })

    console.log(`  ✓ ${employee.name} (${employee.email}) → managerId set to ${manager.id}`)
  }

  // Verify
  const updatedCount = await prisma.user.count({
    where: {
      role: 'EMPLOYEE',
      managerId: manager.id
    }
  })

  console.log(`\n✨ Done! Manager now has ${updatedCount} employees\n`)

  // Show summary
  const teamReports = await prisma.report.count({
    where: {
      userId: {
        in: employees.map(e => e.id)
      },
      date: {
        gte: new Date('2025-11-01'),
        lte: new Date('2025-11-30')
      }
    }
  })

  console.log(`📊 Team stats for November:`)
  console.log(`   - Employees: ${updatedCount}`)
  console.log(`   - Total reports: ${teamReports}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
