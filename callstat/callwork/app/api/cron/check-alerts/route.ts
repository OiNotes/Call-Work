import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { broadcastActivity } from '../../sse/activities/route'

export async function GET(request: NextRequest) {
  // Проверка авторизации (Vercel Cron Secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const alerts: any[] = []
    const today = new Date()

    // 1. Проверить сотрудников без отчётов (2+ дня)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(today.getDate() - 2)
    twoDaysAgo.setHours(0, 0, 0, 0)

    const usersWithoutReports = await prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        isActive: true
      },
      include: {
        reports: {
          where: {
            date: { gte: twoDaysAgo }
          }
        }
      }
    })

    for (const user of usersWithoutReports) {
      if (user.reports.length === 0) {
        // Проверить, не создавали ли уже такой алерт недавно (избежать дубликатов)
        const existingAlert = await prisma.alert.findFirst({
          where: {
            userId: user.id,
            type: 'NO_REPORTS',
            createdAt: { gte: twoDaysAgo }
          }
        })

        if (!existingAlert) {
          alerts.push({
            type: 'NO_REPORTS',
            severity: 'WARNING',
            title: 'Нет отчётов 2+ дня',
            description: `${user.name} не сдал отчёт за последние 2 дня`,
            userId: user.id
          })
        }
      }
    }

    // 2. Проверить сотрудников без сделок (5+ дней)
    const fiveDaysAgo = new Date(today)
    fiveDaysAgo.setDate(today.getDate() - 5)
    fiveDaysAgo.setHours(0, 0, 0, 0)

    const usersWithoutDeals = await prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        isActive: true
      },
      include: {
        reports: {
          where: {
            date: { gte: fiveDaysAgo }
          }
        }
      }
    })

    for (const user of usersWithoutDeals) {
      const hasDeals = user.reports.some(r => r.successfulDeals > 0)

      if (!hasDeals && user.reports.length > 0) {
        const existingAlert = await prisma.alert.findFirst({
          where: {
            userId: user.id,
            type: 'NO_DEALS',
            createdAt: { gte: fiveDaysAgo }
          }
        })

        if (!existingAlert) {
          alerts.push({
            type: 'NO_DEALS',
            severity: 'CRITICAL',
            title: 'Нет закрытых сделок 5+ дней',
            description: `${user.name} не закрыл ни одной сделки за последние 5 дней`,
            userId: user.id
          })
        }
      }
    }

    // 3. Проверить упавшую конверсию (текущая неделя vs прошлая)
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(today.getDate() - today.getDay() + 1) // Понедельник
    thisWeekStart.setHours(0, 0, 0, 0)

    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(thisWeekStart.getDate() - 7)
    const lastWeekEnd = new Date(thisWeekStart)
    lastWeekEnd.setMilliseconds(-1)

    const users = await prisma.user.findMany({
      where: {
        role: 'EMPLOYEE',
        isActive: true
      },
      include: {
        reports: {
          where: {
            OR: [
              { date: { gte: thisWeekStart } },
              { date: { gte: lastWeekStart, lte: lastWeekEnd } }
            ]
          }
        }
      }
    })

    for (const user of users) {
      const thisWeekReports = user.reports.filter(r => r.date >= thisWeekStart)
      const lastWeekReports = user.reports.filter(
        r => r.date >= lastWeekStart && r.date <= lastWeekEnd
      )

      if (thisWeekReports.length > 0 && lastWeekReports.length > 0) {
        const thisWeekDeals = thisWeekReports.reduce((sum, r) => sum + r.successfulDeals, 0)
        const thisWeekVzm = thisWeekReports.reduce((sum, r) => sum + r.vzmConducted, 0)
        const thisWeekConversion = thisWeekVzm > 0 ? (thisWeekDeals / thisWeekVzm) * 100 : 0

        const lastWeekDeals = lastWeekReports.reduce((sum, r) => sum + r.successfulDeals, 0)
        const lastWeekVzm = lastWeekReports.reduce((sum, r) => sum + r.vzmConducted, 0)
        const lastWeekConversion = lastWeekVzm > 0 ? (lastWeekDeals / lastWeekVzm) * 100 : 0

        // Если конверсия упала больше чем на 20%
        if (lastWeekConversion > 0 && thisWeekConversion < lastWeekConversion * 0.8) {
          const existingAlert = await prisma.alert.findFirst({
            where: {
              userId: user.id,
              type: 'LOW_CONVERSION',
              createdAt: { gte: thisWeekStart }
            }
          })

          if (!existingAlert) {
            alerts.push({
              type: 'LOW_CONVERSION',
              severity: 'WARNING',
              title: 'Упала конверсия',
              description: `Конверсия ${user.name} упала с ${lastWeekConversion.toFixed(1)}% до ${thisWeekConversion.toFixed(1)}%`,
              userId: user.id
            })
          }
        }
      }
    }

    // Сохранить новые алерты
    if (alerts.length > 0) {
      await prisma.alert.createMany({ data: alerts })

      // Broadcast критичных алертов в real-time
      for (const alert of alerts) {
        if (alert.severity === 'CRITICAL') {
          const user = await prisma.user.findUnique({
            where: { id: alert.userId },
            select: { name: true }
          })

          if (user) {
            broadcastActivity({
              type: 'alert',
              message: alert.title,
              details: alert.description,
              userId: alert.userId,
              userName: user.name
            })
          }
        }
      }
    }

    return NextResponse.json({
      created: alerts.length,
      alerts: alerts.map(a => ({ type: a.type, userId: a.userId }))
    })

  } catch (error) {
    console.error('Cron check-alerts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
