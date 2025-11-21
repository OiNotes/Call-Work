import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalesForecastService } from '@/lib/services/SalesForecastService'

const service = new SalesForecastService()

export async function GET() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (session.user.role !== 'MANAGER' && session.user.role !== 'ADMIN') { // Assuming 'ADMIN' might act as manager
     return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const data = await service.getDepartmentForecast(session.user.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Department forecast error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
