import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MotivationCalculatorService } from '@/lib/services/MotivationCalculatorService'

const service = new MotivationCalculatorService()

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestedUserId = searchParams.get('userId')

  let targetUserId = session.user.id

  // Allow Managers/Admins to view other users' data
  if (requestedUserId && (session.user.role === 'MANAGER' || session.user.role === 'ADMIN')) {
    targetUserId = requestedUserId
  }

  try {
    const data = await service.calculateIncomeForecast(targetUserId)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Income forecast error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
