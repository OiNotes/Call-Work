import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { AlertSeverity } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity') as AlertSeverity | null
    const isRead = searchParams.get('isRead')

    // Менеджеры видят все алерты, сотрудники только свои
    const where: any = user.role === 'MANAGER' ? {} : { userId: user.id }

    if (severity && ['INFO', 'WARNING', 'CRITICAL'].includes(severity)) {
      where.severity = severity
    }

    if (isRead !== null) {
      where.isRead = isRead === 'true'
    }

    const alerts = await prisma.alert.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Последние 50 алертов
    })

    // Подсчитать непрочитанные
    const unreadCount = await prisma.alert.count({
      where: {
        ...(user.role === 'MANAGER' ? {} : { userId: user.id }),
        isRead: false
      }
    })

    return NextResponse.json({ alerts, unreadCount })

  } catch (error) {
    console.error('Alerts GET error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(_request: NextRequest) {
  try {
    const user = await requireAuth()

    const result = await prisma.alert.updateMany({
      where: {
        ...(user.role === 'MANAGER' ? {} : { userId: user.id }),
        isRead: false
      },
      data: { isRead: true }
    })

    return NextResponse.json({ updated: result.count })

  } catch (error) {
    console.error('Mark all read error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
