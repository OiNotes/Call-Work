import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export interface SessionUser {
  id: string
  role: Role | 'MANAGER' | 'EMPLOYEE'
}

export async function resolveAccessibleManagerIds(
  user: SessionUser,
  requestedId: string | null
): Promise<string[]> {
  if (user.role !== 'MANAGER') {
    return [user.id]
  }

  if (requestedId === 'all') {
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    return employees.map((e) => e.id)
  }

  if (requestedId) {
    return [requestedId]
  }

  const team = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { managerId: user.id },
        { id: user.id },
      ],
    },
    select: { id: true },
  })

  if (team.length === 0) {
    return [user.id]
  }

  return team.map((member) => member.id)
}
