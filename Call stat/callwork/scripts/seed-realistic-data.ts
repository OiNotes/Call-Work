/**
 * 🌱 Seed-скрипт для генерации РЕАЛИСТИЧНЫХ данных
 *
 * Воронка из 6 этапов:
 * 1. Записан на Zoom (zoomBooked)
 * 2. 1-й Zoom (zoom1Held)
 * 3. 2-й Zoom (zoom2Held)
 * 4. Разбор договора (contractReview)
 * 5. Дожим (push)
 * 6. Оплата (deal)
 *
 * Запуск: npx tsx scripts/seed-realistic-data.ts
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// Профили менеджеров с разной эффективностью
const MANAGERS = [
  // 🌟 ТОП-МЕНЕДЖЕРЫ (North Star > 6%)
  {
    name: 'Анас Камалов',
    email: 'anas@callwork.com',
    profile: {
      bookedToZoom1: 0.75,    // 75% явка на 1-й Zoom
      zoom1ToZoom2: 0.65,     // 65% доходят до 2-го
      zoom2ToContract: 0.55,  // 55% до договора
      contractToPush: 0.75,   // 75% дожим
      pushToDeal: 0.80,       // 80% закрытие
      avgCheck: 58000,
      dailyBooked: 12,        // записей в день
    }
  },
  {
    name: 'Леонид Смирнов',
    email: 'leonid@callwork.com',
    profile: {
      bookedToZoom1: 0.72,
      zoom1ToZoom2: 0.62,
      zoom2ToContract: 0.58,
      contractToPush: 0.70,
      pushToDeal: 0.78,
      avgCheck: 55000,
      dailyBooked: 11,
    }
  },

  // 📊 СРЕДНИЕ МЕНЕДЖЕРЫ (North Star ~3-5%)
  {
    name: 'Марат Иванов',
    email: 'marat@callwork.com',
    profile: {
      bookedToZoom1: 0.65,    // Явка чуть ниже
      zoom1ToZoom2: 0.52,     // Проблема: мало переходят на 2-й Zoom
      zoom2ToContract: 0.50,
      contractToPush: 0.65,
      pushToDeal: 0.72,
      avgCheck: 52000,
      dailyBooked: 10,
    }
  },
  {
    name: 'Ольга Петрова',
    email: 'olga@callwork.com',
    profile: {
      bookedToZoom1: 0.68,
      zoom1ToZoom2: 0.55,
      zoom2ToContract: 0.48,  // Проблема: теряет после 2-го Zoom
      contractToPush: 0.68,
      pushToDeal: 0.75,
      avgCheck: 51000,
      dailyBooked: 10,
    }
  },

  // ⚠️ ПРОБЛЕМНЫЕ МЕНЕДЖЕРЫ (North Star < 3%, красные зоны)
  {
    name: 'Дмитрий Козлов',
    email: 'dmitry@callwork.com',
    profile: {
      bookedToZoom1: 0.55,    // 🔴 Низкая явка
      zoom1ToZoom2: 0.48,     // 🔴 Проблема квалификации
      zoom2ToContract: 0.42,
      contractToPush: 0.58,   // 🔴 Слабый дожим
      pushToDeal: 0.65,
      avgCheck: 48000,
      dailyBooked: 9,
    }
  },
  {
    name: 'Алина Волкова',
    email: 'alina@callwork.com',
    profile: {
      bookedToZoom1: 0.62,
      zoom1ToZoom2: 0.45,     // 🔴 Критическая проблема
      zoom2ToContract: 0.40,  // 🔴 Теряет клиентов
      contractToPush: 0.60,
      pushToDeal: 0.68,
      avgCheck: 49000,
      dailyBooked: 9,
    }
  },

  // 🎯 ЗВЕЗДА (для демонстрации идеала)
  {
    name: 'Максим Звезда',
    email: 'maxim@callwork.com',
    profile: {
      bookedToZoom1: 0.80,    // Отличная явка
      zoom1ToZoom2: 0.70,     // Супер квалификация
      zoom2ToContract: 0.62,
      contractToPush: 0.78,
      pushToDeal: 0.85,       // Мастер закрытия
      avgCheck: 62000,
      dailyBooked: 13,
    }
  },
]

/**
 * Генерирует отчёт на один день для менеджера
 */
function generateDayReport(profile: typeof MANAGERS[0]['profile'], date: Date) {
  // Вариация ±15% от базовых значений
  const variance = () => 0.85 + Math.random() * 0.3

  // Этап 1: Записи на Zoom
  const zoomBooked = Math.round(profile.dailyBooked * variance())

  // Этап 2: 1-й Zoom проведён
  const zoom1Held = Math.round(zoomBooked * profile.bookedToZoom1 * variance())

  // Этап 3: 2-й Zoom проведён
  const zoom2Held = Math.round(zoom1Held * profile.zoom1ToZoom2 * variance())

  // Этап 4: Разбор договора
  const contractReview = Math.round(zoom2Held * profile.zoom2ToContract * variance())

  // Этап 5: Дожим
  const pushCount = Math.round(contractReview * profile.contractToPush * variance())

  // Этап 6: Оплата (сделка)
  const successfulDeals = Math.round(pushCount * profile.pushToDeal * variance())

  // Сумма продаж
  const salesAmount = successfulDeals * (profile.avgCheck * variance())

  // ОТКАЗЫ ПО ЭТАПАМ (распределяем потери)
  const refusalAfterBooked = Math.max(0, zoomBooked - zoom1Held - Math.floor(Math.random() * 2))
  const refusalAfterZoom1 = Math.max(0, zoom1Held - zoom2Held - Math.floor(Math.random() * 2))
  const refusalAfterZoom2 = Math.max(0, zoom2Held - contractReview - Math.floor(Math.random() * 2))
  const refusalAfterContract = Math.max(0, contractReview - pushCount - Math.floor(Math.random() * 1))
  const refusalAfterPush = Math.max(0, pushCount - successfulDeals)

  const refusalsByStage = {
    zoomBooked: refusalAfterBooked,
    zoom1Held: refusalAfterZoom1,
    zoom2Held: refusalAfterZoom2,
    contractReview: refusalAfterContract,
    push: refusalAfterPush,
  }

  const totalRefusals = Object.values(refusalsByStage).reduce((sum, val) => sum + val, 0)

  // Подогрев (случайное количество)
  const warmingUp = Math.floor(Math.random() * 5) + 1

  return {
    date,
    zoomAppointments: zoomBooked,
    pzmConducted: zoom1Held,        // Мапим на старое поле
    vzmConducted: zoom2Held,        // Мапим на старое поле
    contractReviewCount: contractReview,
    pushCount,                      // Новое поле
    successfulDeals,
    monthlySalesAmount: Math.round(salesAmount),
    refusalsCount: totalRefusals,
    refusalsByStage: refusalsByStage as any,
    warmingUpCount: warmingUp,
    refusalsReasons: totalRefusals > 0 ? 'не по цене, думает' : null,
  }
}

/**
 * Генерирует рабочие дни текущего месяца
 */
function getWorkdaysOfCurrentMonth(): Date[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const workdays: Date[] = []

  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    // Пн-Пт (1-5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workdays.push(new Date(d))
    }
  }

  return workdays
}

/**
 * Очищает старые данные
 */
async function cleanOldData() {
  console.log('🗑️  Очистка старых данных...')

  // Удаляем отчёты
  await prisma.report.deleteMany({})

  // Удаляем сотрудников (кроме менеджера)
  await prisma.user.deleteMany({
    where: { role: 'EMPLOYEE' }
  })

  console.log('✅ Старые данные удалены')
}

/**
 * Создаёт менеджера (если нет)
 */
async function ensureManager() {
  const existingManager = await prisma.user.findFirst({
    where: { email: 'manager@callwork.com' }
  })

  if (existingManager) {
    console.log(`✅ Менеджер уже существует: ${existingManager.name}`)
    return existingManager
  }

  const password = await hash('manager123', 12)
  const manager = await prisma.user.create({
    data: {
      name: 'Руководитель',
      email: 'manager@callwork.com',
      password,
      role: 'MANAGER',
    }
  })

  console.log(`✅ Создан менеджер: ${manager.name}`)
  return manager
}

/**
 * Главная функция
 */
async function main() {
  console.log('\n🚀 ГЕНЕРАЦИЯ РЕАЛИСТИЧНЫХ ДАННЫХ\n')
  console.log('=' .repeat(50))

  try {
    // 1. Очистка
    await cleanOldData()

    // 2. Менеджер
    const manager = await ensureManager()

    // 3. Рабочие дни
    const workdays = getWorkdaysOfCurrentMonth()
    console.log(`\n📅 Рабочих дней в текущем месяце: ${workdays.length}`)

    // 4. Создаём менеджеров и их отчёты
    console.log('\n👥 Создание менеджеров и отчётов:\n')

    const password = await hash('password123', 12)
    let totalReports = 0

    for (const managerData of MANAGERS) {
      // Создаём сотрудника
      const employee = await prisma.user.create({
        data: {
          name: managerData.name,
          email: managerData.email,
          password,
          role: 'EMPLOYEE',
          managerId: manager.id,
        }
      })

      console.log(`  📝 ${managerData.name}`)

      // Генерируем отчёты за все рабочие дни
      const reports = workdays.map(date => ({
        userId: employee.id,
        ...generateDayReport(managerData.profile, date)
      }))

      // Сохраняем пачкой
      await prisma.report.createMany({
        data: reports,
        skipDuplicates: true,
      })

      totalReports += reports.length

      // Считаем North Star для вывода
      const totalZoom1 = reports.reduce((sum, r) => sum + r.pzmConducted, 0)
      const totalDeals = reports.reduce((sum, r) => sum + r.successfulDeals, 0)
      const northStar = totalZoom1 > 0 ? ((totalDeals / totalZoom1) * 100).toFixed(1) : '0'

      console.log(`     North Star KPI: ${northStar}%`)
    }

    // 5. Итоги
    console.log('\n' + '='.repeat(50))
    console.log('✅ ГЕНЕРАЦИЯ ЗАВЕРШЕНА!')
    console.log('='.repeat(50))
    console.log(`👥 Менеджеров создано: ${MANAGERS.length}`)
    console.log(`📄 Отчётов создано: ${totalReports}`)
    console.log(`📅 Период: ${workdays[0].toLocaleDateString('ru-RU')} - ${workdays[workdays.length - 1].toLocaleDateString('ru-RU')}`)

    console.log('\n🎯 Профили менеджеров:')
    console.log('  🌟 ТОП (>6% North Star): Анас, Леонид, Максим')
    console.log('  📊 СРЕДНИЕ (3-5%): Марат, Ольга')
    console.log('  ⚠️  ПРОБЛЕМНЫЕ (<3%): Дмитрий, Алина')

    console.log('\n🔐 Данные для входа:')
    console.log('  👔 Менеджер: manager@callwork.com / manager123')
    console.log('  👤 Сотрудники: [email из списка] / password123')

    console.log('\n🚀 Откройте http://localhost:3000 для проверки!')
    console.log('   → Главный дашборд: /dashboard')
    console.log('   → Детальная воронка: /dashboard/analytics/funnel')

  } catch (error) {
    console.error('\n❌ ОШИБКА:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запуск
main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
