import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import { resolveAccessibleManagerIds } from '@/lib/motivation/scope'
import { DealStatus, Prisma } from '@prisma/client'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)

    const managerId = searchParams.get('managerId')
    const status = searchParams.get('status')
    const focusOnly = searchParams.get('focusOnly') === 'true'
    const limitParam = parseInt(searchParams.get('limit') || '25', 10)
    const limit = Number.isNaN(limitParam) ? 25 : limitParam

    const managerIds = await resolveAccessibleManagerIds(user, managerId)

    const where: Prisma.DealWhereInput = {
      managerId: { in: managerIds },
      ...(focusOnly ? { isFocus: true } : {}),
    }

    if (status && Object.values(DealStatus).includes(status as DealStatus)) {
      where.status = status as DealStatus
    }

    const deals = await prisma.deal.findMany({
      where,
      orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    })

    return NextResponse.json({ deals })
  } catch (error) {
    console.error('GET /api/deals error', error)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
