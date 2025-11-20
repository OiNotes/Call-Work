import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/get-session'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { id: employeeId } = await params
    
    // Проверка прав
    if (user.role === 'EMPLOYEE' && user.id !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    if (user.role === 'MANAGER') {
      const employee = await prisma.user.findUnique({
        where: { id: employeeId },
        select: { managerId: true }
      })
      
      if (!employee || employee.managerId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const reports = await prisma.report.findMany({
      where: {
        userId: employeeId
      },
      orderBy: {
        date: 'desc'
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        userId: true,
        date: true,
        zoomAppointments: true,
        pzmConducted: true,
        vzmConducted: true,
        contractReviewCount: true,
        pushCount: true,
        successfulDeals: true,
        monthlySalesAmount: true,
        refusalsCount: true,
        refusalsByStage: true,
        warmingUpCount: true,
        comment: true,
      }
    }).then(reports =>
      reports.map(r => ({
        ...r,
        monthlySalesAmount: Number(r.monthlySalesAmount), // Конвертируем Decimal в number
        date: r.date.toISOString() // Конвертируем Date в ISO string
      }))
    )

    const total = await prisma.report.count({
      where: {
        userId: employeeId
      }
    })

    return NextResponse.json({
      reports,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('GET /api/employees/[id]/reports error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
