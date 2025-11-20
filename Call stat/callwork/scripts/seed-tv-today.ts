/**
 * Seed TV Dashboard - Создание данных за СЕГОДНЯ
 *
 * Этот скрипт:
 * 1. Обновляет всех EMPLOYEE: isActive = true, monthlyGoal = 1,500,000₽
 * 2. Создает отчеты за СЕГОДНЯ для каждого активного сотрудника
 * 3. Генерирует реалистичные метрики для TV Dashboard
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NAMES = [
  'Иван Петров',
  'Анна Смирнова',
  'Дмитрий Козлов',
  'Мария Сидорова',
  'Алексей Новиков',
  'Елена Федорова'
]

async function main() {
  console.log('🚀 Запуск seed для TV Dashboard...\n')

  // 1. Найти или создать менеджера
  const manager = await prisma.user.upsert({
    where: { email: 'manager@callwork.com' },
    create: {
      email: 'manager@callwork.com',
      password: '$2b$10$YourHashedPasswordHere',
      name: 'Manager Demo',
      role: 'MANAGER',
      isActive: true
    },
    update: {
      isActive: true
    }
  })

  console.log('✅ Менеджер готов:', manager.name)

  // 2. Создать/обновить сотрудников
  const employees = []

  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i]
    const email = `employee${i + 1}@callwork.com`

    const employee = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        password: '$2b$10$YourHashedPasswordHere',
        name,
        role: 'EMPLOYEE',
        isActive: true,
        monthlyGoal: 1500000,
        managerId: manager.id
      },
      update: {
        isActive: true,
        monthlyGoal: 1500000,
        name // обновляем имя на русское
      }
    })

    employees.push(employee)
    console.log(`✅ Сотрудник ${i + 1}/6:`, employee.name)
  }

  console.log(`\n📊 Создано/обновлено ${employees.length} сотрудников\n`)

  // 3. Создать отчеты за СЕГОДНЯ
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  console.log('📅 Создаю отчеты за СЕГОДНЯ:', today.toLocaleDateString('ru-RU'))
  console.log('')

  for (const employee of employees) {
    // Генерируем реалистичные метрики
    const zoomAppointments = Math.floor(Math.random() * 5) + 8 // 8-12
    const pzmConducted = Math.floor(Math.random() * 4) + 6 // 6-9
    const vzmConducted = Math.floor(Math.random() * 4) + 4 // 4-7
    const successfulDeals = Math.floor(Math.random() * 3) + 2 // 2-4
    const monthlySalesAmount = Math.floor(Math.random() * 100000) + 200000 // 200k-300k

    // Новые поля воронки
    const refusalsCount = Math.floor(Math.random() * 3) + 1 // 1-3 отказа
    const warmingUpCount = Math.floor(Math.random() * 8) + 5 // 5-12 в подогреве
    const contractReviewCount = Math.floor(Math.random() * 3) + 1 // 1-3 разбора

    // Причины отказов (случайный выбор)
    const refusalReasons = ['нет денег', 'не интересно', 'думает', 'дорого', 'не сейчас']
    const selectedReasons = refusalReasons
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(refusalsCount, 2))
      .join(', ')

    await prisma.report.upsert({
      where: {
        userId_date: {
          userId: employee.id,
          date: today
        }
      },
      update: {
        zoomAppointments,
        pzmConducted,
        vzmConducted,
        successfulDeals,
        monthlySalesAmount,
        refusalsCount,
        refusalsReasons: selectedReasons,
        warmingUpCount,
        contractReviewCount,
        comment: 'Сгенерировано для TV Dashboard'
      },
      create: {
        userId: employee.id,
        date: today,
        zoomAppointments,
        pzmConducted,
        vzmConducted,
        successfulDeals,
        monthlySalesAmount,
        refusalsCount,
        refusalsReasons: selectedReasons,
        warmingUpCount,
        contractReviewCount,
        comment: 'Сгенерировано для TV Dashboard'
      }
    })

    const totalCalls = pzmConducted + vzmConducted
    const conversion = totalCalls > 0 ? ((successfulDeals / totalCalls) * 100).toFixed(1) : 0

    console.log(`  ${employee.name}:`)
    console.log(`    💰 Продажи: ${monthlySalesAmount.toLocaleString('ru-RU')}₽`)
    console.log(`    📞 Звонки: ${totalCalls} (ПЗМ: ${pzmConducted}, ВЗМ: ${vzmConducted})`)
    console.log(`    ✅ Сделки: ${successfulDeals}`)
    console.log(`    📊 Конверсия: ${conversion}%`)
    console.log('')
  }

  // 4. Показать итоговую статистику
  const allReports = await prisma.report.findMany({
    where: {
      date: today,
      userId: { in: employees.map(e => e.id) }
    }
  })

  const totalSales = allReports.reduce((sum, r) => sum + Number(r.monthlySalesAmount), 0)
  const totalDeals = allReports.reduce((sum, r) => sum + r.successfulDeals, 0)
  const totalCalls = allReports.reduce((sum, r) => sum + r.pzmConducted + r.vzmConducted, 0)
  const avgConversion = totalCalls > 0 ? ((totalDeals / totalCalls) * 100).toFixed(1) : 0

  const totalRefusals = allReports.reduce((sum, r) => sum + r.refusalsCount, 0)
  const totalWarmingUp = allReports.reduce((sum, r) => sum + r.warmingUpCount, 0)
  const totalContractReviews = allReports.reduce((sum, r) => sum + r.contractReviewCount, 0)

  console.log('═══════════════════════════════════════════════')
  console.log('📈 ИТОГОВАЯ СТАТИСТИКА ЗА СЕГОДНЯ:')
  console.log('═══════════════════════════════════════════════')
  console.log(`  💰 Общая выручка: ${totalSales.toLocaleString('ru-RU')}₽`)
  console.log(`  📞 Всего звонков: ${totalCalls}`)
  console.log(`  ✅ Всего сделок: ${totalDeals}`)
  console.log(`  📊 Средняя конверсия: ${avgConversion}%`)
  console.log(`  ❌ Всего отказов: ${totalRefusals}`)
  console.log(`  🔥 В подогреве: ${totalWarmingUp}`)
  console.log(`  📄 Разбор договора: ${totalContractReviews}`)
  console.log(`  🎯 Цель на месяц: 1,500,000₽`)
  console.log(`  📈 Прогресс: ${((totalSales / 1500000) * 100).toFixed(1)}%`)
  console.log('═══════════════════════════════════════════════')
  console.log('')
  console.log('✅ Seed завершен успешно!')
  console.log('🚀 Откройте http://localhost:3000/tv для проверки')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
