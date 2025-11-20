/**
 * 🌱 Скрипт генерации тестовых данных для дашборда сотрудников
 *
 * Создаёт:
 * - 5 новых сотрудников с разными профилями эффективности
 * - Обновляет существующего сотрудника (bobi)
 * - Генерирует реалистичные отчёты за 90 дней
 * - Валидирует математическую корректность
 *
 * Запуск: npx tsx scripts/seed-test-data.ts
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// Типы профилей эффективности
type PerformanceProfile = 'top' | 'average' | 'weak'

interface EmployeeProfile {
  name: string
  email: string
  profile: PerformanceProfile
}

// Профили сотрудников
const EMPLOYEES: EmployeeProfile[] = [
  { name: 'Иван Петров', email: 'ivan.petrov@callwork.com', profile: 'top' },
  { name: 'Анна Смирнова', email: 'anna.smirnova@callwork.com', profile: 'top' },
  { name: 'Дмитрий Козлов', email: 'dmitry.kozlov@callwork.com', profile: 'average' },
  { name: 'Мария Сидорова', email: 'maria.sidorova@callwork.com', profile: 'average' },
  { name: 'Алексей Новиков', email: 'alexey.novikov@callwork.com', profile: 'weak' },
]

// ID менеджера (уже существует в БД)
const MANAGER_ID = 'cmi4npm9t0000p7jmhhhb0bly'

/**
 * Генерирует случайное число в диапазоне
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Генерирует случайное число с вариацией
 */
function randomWithVariation(base: number, variation: number): number {
  const delta = base * variation
  return Math.round(base + (Math.random() * 2 - 1) * delta)
}

/**
 * Проверяет рабочий день (пн-пт)
 */
function isWorkday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5 // пн=1, пт=5
}

/**
 * Получает множитель для дня недели
 */
function getDayOfWeekMultiplier(date: Date): { scheduled: number; conversion: number } {
  const day = date.getDay()

  if (day === 1) {
    // Понедельник: больше планов, меньше конверсия
    return { scheduled: 1.2, conversion: 0.95 }
  } else if (day === 5) {
    // Пятница: усталость, ниже конверсия
    return { scheduled: 1.0, conversion: 0.85 }
  } else if (day === 3 || day === 4) {
    // Среда-четверг: пик эффективности
    return { scheduled: 1.0, conversion: 1.05 }
  }

  return { scheduled: 1.0, conversion: 1.0 }
}

/**
 * Получает множитель прогрессии (улучшение со временем)
 */
function getProgressionMultiplier(dayIndex: number, totalDays: number): number {
  // Первая треть: 0.9-0.95 (адаптация, было 0.8)
  // Вторая треть: 0.95-1.0 (рост)
  // Третья треть: 1.0-1.05 (пик, было 1.1)
  const progress = dayIndex / totalDays

  if (progress < 0.33) {
    return 0.9 + progress * 0.15 // 0.9 → 0.95
  } else if (progress < 0.67) {
    return 0.95 + (progress - 0.33) * 0.15 // 0.95 → 1.0
  } else {
    return 1.0 + (progress - 0.67) * 0.15 // 1.0 → 1.05
  }
}

/**
 * Генерирует метрики отчёта на основе профиля
 */
function generateReportMetrics(
  profile: PerformanceProfile,
  date: Date,
  dayIndex: number,
  totalDays: number
) {
  const dayMultipliers = getDayOfWeekMultiplier(date)
  const progressionMultiplier = getProgressionMultiplier(dayIndex, totalDays)

  let baseScheduled: number
  let pzmConversionRate: number
  let pzToVzmRate: number
  let vzmToDealRate: number
  let avgCheck: number

  // Базовые параметры для каждого профиля
  switch (profile) {
    case 'top':
      baseScheduled = 10
      pzmConversionRate = 0.85 // 85%
      pzToVzmRate = 0.75 // 75%
      vzmToDealRate = 0.80 // 80%
      avgCheck = 55000
      break

    case 'average':
      baseScheduled = 10
      pzmConversionRate = 0.65 // 65%
      pzToVzmRate = 0.60 // 60%
      vzmToDealRate = 0.70 // 70%
      avgCheck = 50000
      break

    case 'weak':
      baseScheduled = 10
      pzmConversionRate = 0.55 // 55% - WARNING (было 48%)
      pzToVzmRate = 0.48 // 48% - CRITICAL (было 45%)
      vzmToDealRate = 0.62 // 62% - WARNING (было 58%)
      avgCheck = 45000
      break
  }

  // Применяем множители
  const pzmScheduled = Math.max(
    6,
    Math.round(baseScheduled * dayMultipliers.scheduled * randomWithVariation(1, 0.15))
  )

  const adjustedPzmRate = pzmConversionRate * dayMultipliers.conversion * progressionMultiplier
  const pzmConducted = Math.max(
    0,
    Math.min(
      pzmScheduled,
      Math.round(pzmScheduled * randomWithVariation(adjustedPzmRate, 0.1))
    )
  )

  const adjustedVzmRate = pzToVzmRate * dayMultipliers.conversion * progressionMultiplier
  const vzmConducted = pzmConducted > 0
    ? Math.max(
        0,
        Math.min(
          pzmConducted,
          Math.round(pzmConducted * randomWithVariation(adjustedVzmRate, 0.1))
        )
      )
    : 0

  const adjustedDealRate = vzmToDealRate * dayMultipliers.conversion * progressionMultiplier
  // Увеличиваем вариацию для dealsClosed до 0.25 и используем Math.floor для гарантии < vzmConducted
  const dealsClosed = vzmConducted > 0
    ? Math.max(
        0,
        Math.min(
          vzmConducted - randomInt(0, Math.max(1, Math.floor(vzmConducted * 0.1))), // -0-10% случайно
          Math.floor(vzmConducted * randomWithVariation(adjustedDealRate, 0.25))
        )
      )
    : 0

  const salesAmount = dealsClosed > 0
    ? dealsClosed * randomWithVariation(avgCheck, 0.1)
    : 0

  // Дополнительные метрики
  const rejections = randomInt(0, Math.max(0, pzmScheduled - pzmConducted))
  const warmUp = randomInt(1, 5)
  const contractReview = randomInt(0, Math.min(2, dealsClosed))

  const rejectionReasons = [
    'не по цене',
    'не актуально',
    'перезвонить позже',
    'нет времени',
    'думает',
    null,
  ]
  const rejectionReason = rejections > 0
    ? rejectionReasons[randomInt(0, rejectionReasons.length - 1)]
    : null

  return {
    zoomAppointments: pzmScheduled,
    pzmConducted,
    refusalsCount: rejections,
    refusalsReasons: rejectionReason,
    warmingUpCount: warmUp,
    vzmConducted,
    contractReviewCount: contractReview,
    successfulDeals: dealsClosed,
    monthlySalesAmount: Math.round(salesAmount * 100) / 100, // 2 знака после запятой
  }
}

/**
 * Генерирует даты за последние N дней (только рабочие)
 */
function generateWorkdays(days: number): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let currentDate = new Date(today)
  currentDate.setDate(currentDate.getDate() - days)

  while (currentDate <= today) {
    if (isWorkday(currentDate)) {
      dates.push(new Date(currentDate))
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return dates
}

/**
 * Основная функция генерации данных
 */
async function seed() {
  console.log('🌱 Начинаю генерацию тестовых данных...\n')

  try {
    // 1. Получаем менеджера
    const manager = await prisma.user.findUnique({
      where: { id: MANAGER_ID },
    })

    if (!manager) {
      throw new Error(`Менеджер с ID ${MANAGER_ID} не найден!`)
    }

    console.log(`✅ Менеджер найден: ${manager.name} (${manager.email})`)

    // 2. Обновляем существующего сотрудника "bobi"
    const existingEmployee = await prisma.user.findFirst({
      where: { email: 'testtest@test.com' },
    })

    if (existingEmployee) {
      await prisma.user.update({
        where: { id: existingEmployee.id },
        data: {
          name: 'Боб Иванов',
          managerId: MANAGER_ID,
        },
      })
      console.log(`✅ Обновлён сотрудник: Боб Иванов (testtest@test.com)`)
    }

    // 3. Создаём новых сотрудников
    console.log('\n📝 Создаю новых сотрудников...')

    const defaultPassword = await hash('password123', 12)
    const createdEmployees = []

    for (const employeeData of EMPLOYEES) {
      const employee = await prisma.user.create({
        data: {
          name: employeeData.name,
          email: employeeData.email,
          password: defaultPassword,
          role: 'EMPLOYEE',
          managerId: MANAGER_ID,
        },
      })

      createdEmployees.push({
        ...employee,
        profile: employeeData.profile,
      })

      console.log(`  ✓ ${employeeData.name} (${employeeData.profile})`)
    }

    // 4. Генерируем даты (последние 90 дней, только рабочие)
    const workdays = generateWorkdays(90)
    console.log(`\n📅 Сгенерировано рабочих дней: ${workdays.length}`)

    // 5. Генерируем отчёты для каждого сотрудника
    console.log('\n📊 Генерирую отчёты...')

    let totalReports = 0

    // Добавляем существующего сотрудника (если есть)
    const allEmployees = existingEmployee
      ? [...createdEmployees, { ...existingEmployee, name: 'Боб Иванов', profile: 'average' as PerformanceProfile }]
      : createdEmployees

    for (const employee of allEmployees) {
      console.log(`  Генерирую для: ${employee.name}...`)

      const reports = workdays.map((date, index) => {
        const metrics = generateReportMetrics(
          employee.profile,
          date,
          index,
          workdays.length
        )

        return {
          userId: employee.id,
          date,
          ...metrics,
        }
      })

      // Создаём отчёты пачками (по 50 за раз для производительности)
      const batchSize = 50
      for (let i = 0; i < reports.length; i += batchSize) {
        const batch = reports.slice(i, i + batchSize)
        await prisma.report.createMany({
          data: batch,
          skipDuplicates: true, // Пропускаем дубликаты (если уже есть)
        })
      }

      totalReports += reports.length
      console.log(`    ✓ Создано отчётов: ${reports.length}`)
    }

    // 6. Статистика
    console.log('\n' + '='.repeat(50))
    console.log('✅ ГЕНЕРАЦИЯ ЗАВЕРШЕНА!')
    console.log('='.repeat(50))
    console.log(`👥 Всего сотрудников: ${allEmployees.length}`)
    console.log(`📄 Всего отчётов: ${totalReports}`)
    console.log(`📅 Период: последние 90 дней (${workdays.length} рабочих дней)`)
    console.log('\n📊 Распределение по профилям:')

    const profileCounts = allEmployees.reduce((acc, emp) => {
      acc[emp.profile] = (acc[emp.profile] || 0) + 1
      return acc
    }, {} as Record<PerformanceProfile, number>)

    console.log(`  🌟 Топ-перформеры: ${profileCounts.top || 0}`)
    console.log(`  📈 Средние: ${profileCounts.average || 0}`)
    console.log(`  ⚠️  Слабые (с красными зонами): ${profileCounts.weak || 0}`)

    console.log('\n🔐 Данные для входа:')
    console.log('  Менеджер: manager@callwork.com / manager123')
    console.log('  Сотрудники: [email] / password123')

    console.log('\n🚀 Откройте http://localhost:3000 и войдите как менеджер!')

  } catch (error) {
    console.error('❌ Ошибка при генерации данных:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запуск
seed()
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error)
    process.exit(1)
  })
