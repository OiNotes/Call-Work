import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const manager = await prisma.user.upsert({
    where: { email: 'manager@callwork.com' },
    update: {},
    create: {
      email: 'manager@callwork.com',
      password: hashedPassword,
      name: 'Manager Demo',
      role: Role.MANAGER,
    },
  })

  const employee = await prisma.user.upsert({
    where: { email: 'employee@callwork.com' },
    update: {},
    create: {
      email: 'employee@callwork.com',
      password: hashedPassword,
      name: 'Employee Demo',
      role: Role.EMPLOYEE,
      managerId: manager.id,
    },
  })

  console.log({ manager, employee })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
