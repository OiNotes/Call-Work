import { PrismaClient, Role, DealStatus, PaymentStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { MOTIVATION_GRADE_PRESETS } from '../lib/config/motivationGrades'

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

  await prisma.motivationGrade.deleteMany()
  await prisma.motivationGrade.createMany({
    data: MOTIVATION_GRADE_PRESETS.map((grade) => ({
      minTurnover: grade.minTurnover.toString(),
      maxTurnover: grade.maxTurnover === null || grade.maxTurnover === undefined
        ? null
        : grade.maxTurnover.toString(),
      commissionRate: grade.commissionRate.toString(),
    })),
  })

  const now = new Date()
  await prisma.deal.deleteMany({
    where: {
      managerId: { in: [manager.id, employee.id] },
    },
  })
  await prisma.deal.createMany({
    data: [
      {
        title: 'Demo SaaS лицензия',
        budget: '300000',
        status: DealStatus.WON,
        paymentStatus: PaymentStatus.PAID,
        isFocus: false,
        managerId: employee.id,
        closedAt: now,
        paidAt: now,
      },
      {
        title: 'Корпоративный пакет',
        budget: '150000',
        status: DealStatus.WON,
        paymentStatus: PaymentStatus.PAID,
        isFocus: false,
        managerId: employee.id,
        closedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5),
        paidAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5),
      },
      {
        title: 'Upsell enterprise',
        budget: '500000',
        status: DealStatus.OPEN,
        paymentStatus: PaymentStatus.UNPAID,
        isFocus: true,
        managerId: employee.id,
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2),
      },
    ],
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
