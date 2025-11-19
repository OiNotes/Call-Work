import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    // Получить последние отчёты
    const recentReports = await prisma.report.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    })

    // Преобразовать в активности
    const activities = recentReports.map(report => {
      const hasDeals = report.successfulDeals > 0
      
      return {
        id: report.id,
        type: hasDeals ? 'deal' : 'report',
        message: hasDeals
          ? `${report.user.name} закрыл ${report.successfulDeals} ${pluralize(report.successfulDeals, 'сделку', 'сделки', 'сделок')}`
          : `${report.user.name} отправил отчёт`,
        details: hasDeals
          ? `Сумма: ${formatMoney(Number(report.monthlySalesAmount))}`
          : `Zoom: ${report.zoomAppointments}, ПЗМ: ${report.pzmConducted}`,
        timestamp: report.createdAt,
        userId: report.user.id,
        userName: report.user.name
      }
    })

    return NextResponse.json({ activities })

  } catch (error) {
    console.error('Activities API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function pluralize(count: number, one: string, few: string, many: string) {
  if (count % 10 === 1 && count % 100 !== 11) return one
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return few
  return many
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(value)
}
