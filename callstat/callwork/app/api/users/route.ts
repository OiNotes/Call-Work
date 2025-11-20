import { NextResponse } from 'next/server'
import { requireManager } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const manager = await requireManager()

    const users = await prisma.user.findMany({
      where: {
        managerId: manager.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telegramId: true,
        createdAt: true,
        _count: {
          select: { reports: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
}
