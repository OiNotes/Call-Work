import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireManager } from '@/lib/auth/get-session'
import { calculateConversions } from '@/lib/analytics/conversions'

export async function GET(request: Request) {
  try {
    const manager = await requireManager()
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : new Date(new Date().setMonth(new Date().getMonth() - 1))
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : new Date()
    
    // Получить всех работников менеджера
    const employees = await prisma.user.findMany({
      where: {
        managerId: manager.id,
        role: 'EMPLOYEE'
      },
      select: {
        id: true,
        name: true,
        email: true,
      }
    })
    
    // Для каждого работника посчитать статистику
    const employeesWithStats = await Promise.all(
      employees.map(async (employee) => {
        const reports = await prisma.report.aggregate({
          where: {
            userId: employee.id,
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: {
            zoomAppointments: true,
            pzmConducted: true,
            vzmConducted: true,
            successfulDeals: true,
            monthlySalesAmount: true,
          }
        })
        
        const stats = {
          zoomAppointments: reports._sum.zoomAppointments || 0,
          pzmConducted: reports._sum.pzmConducted || 0,
          vzmConducted: reports._sum.vzmConducted || 0,
          successfulDeals: reports._sum.successfulDeals || 0,
          monthlySalesAmount: Number(reports._sum.monthlySalesAmount || 0),
        }
        
        const conversions = calculateConversions(stats)
        
        return {
          ...employee,
          stats: {
            ...stats,
            ...conversions,
            hasRedZone: conversions.pzToVzmConversion < 60 || conversions.vzmToDealConversion < 70,
          }
        }
      })
    )
    
    return NextResponse.json({ employees: employeesWithStats })
  } catch (error) {
    console.error('GET /api/employees error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500 }
    )
  }
}
