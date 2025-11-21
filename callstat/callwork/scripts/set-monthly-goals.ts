import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Setting monthly goals for users...')
  
  // Get all users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      monthlyGoal: true
    }
  })
  
  console.log(`Found ${users.length} users`)
  
  // Set goals for employees (1M rubles per month)
  for (const user of users) {
    if (user.role === 'EMPLOYEE') {
      await prisma.user.update({
        where: { id: user.id },
        data: { monthlyGoal: 1000000 }
      })
      console.log(`✅ Set monthlyGoal=1000000 for ${user.name} (${user.email})`)
    } else {
      console.log(`⏭️  Skipped ${user.name} (${user.email}) - role: ${user.role}`)
    }
  }
  
  console.log('\n✨ Done! Monthly goals set.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
