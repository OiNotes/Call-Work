import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const body = await request.json()
    const { isFocus } = body
    const { id } = await params

    // 1. Check permissions
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { manager: true }
    })

    if (!deal) {
      return new NextResponse('Deal not found', { status: 404 })
    }

    // Allow if: 
    // - User is the deal owner
    // - User is a MANAGER (managers can edit anyone's deals usually, or check hierarchy)
    // - User is ADMIN
    const isOwner = deal.managerId === session.user.id
    const isManager = session.user.role === 'MANAGER'
    const isAdmin = session.user.role === 'ADMIN'

    if (!isOwner && !isManager && !isAdmin) {
        return new NextResponse('Forbidden', { status: 403 })
    }

    // 2. Update
    const updatedDeal = await prisma.deal.update({
      where: { id },
      data: { isFocus: Boolean(isFocus) }
    })

    return NextResponse.json(updatedDeal)
  } catch (error) {
    console.error('Error updating deal focus:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}