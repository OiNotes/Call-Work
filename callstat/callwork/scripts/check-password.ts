import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'manager@callwork.com' },
    select: {
      id: true,
      email: true,
      name: true,
      password: true
    }
  })

  if (!user) {
    console.error('❌ User not found!')
    return
  }

  console.log(`User: ${user.name}`)
  console.log(`Email: ${user.email}`)
  console.log(`Password hash: ${user.password}\n`)

  // Test password
  const testPassword = 'password123'
  const isMatch = await bcrypt.compare(testPassword, user.password)

  console.log(`Testing password: "${testPassword}"`)
  console.log(`Match: ${isMatch ? '✓ YES' : '✗ NO'}`)

  if (!isMatch) {
    console.log('\n⚠️  Password mismatch! Resetting to "password123"...')
    const hashedPassword = await bcrypt.hash('password123', 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })
    console.log('✓ Password reset successfully!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
