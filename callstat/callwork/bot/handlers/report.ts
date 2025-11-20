import TelegramBot from 'node-telegram-bot-api'
import { PrismaClient } from '@prisma/client'
import { ReportState } from '../types'
import { validateNumber, validateSalesAmount } from '../utils/validation'
import { formatReportPreview } from '../utils/formatting'

// Map для хранения состояния пользователей
const reportStates = new Map<number, ReportState>()

/**
 * Обработчик команды /report - начало сбора отчёта
 */
export async function reportHandler(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  prisma: PrismaClient
): Promise<void> {
  const chatId = msg.chat.id
  const telegramId = msg.from?.id.toString()

  if (!telegramId) {
    await bot.sendMessage(chatId, '❌ Ошибка: не удалось определить ваш Telegram ID')
    return
  }

  try {
    // Проверяем, что пользователь зарегистрирован
    const user = await prisma.user.findUnique({
      where: { telegramId }
    })

    if (!user) {
      await bot.sendMessage(
        chatId,
        '❌ Вы не зарегистрированы в системе.\n\n' +
        'Используйте команду /register для регистрации.'
      )
      return
    }

    // Инициализируем состояние сбора отчёта
    reportStates.set(chatId, {
      step: 'date',
      date: new Date(),
      data: {}
    })

    // Отправляем клавиатуру выбора даты
    await bot.sendMessage(
      chatId,
      '📊 *Создание отчёта*\n\n' +
      'Выберите дату отчёта:',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📅 Сегодня', callback_data: 'date_today' },
              { text: '📅 Вчера', callback_data: 'date_yesterday' }
            ],
            [
              { text: '📅 Позавчера', callback_data: 'date_daybeforeyesterday' }
            ]
          ]
        }
      }
    )
  } catch (error) {
    console.error('Error in reportHandler:', error)
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.')
  }
}

/**
 * Обработчик выбора даты (callback query)
 */
export async function handleDateCallback(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  prisma: PrismaClient
): Promise<void> {
  const chatId = query.message?.chat.id
  const messageId = query.message?.message_id

  if (!chatId || !messageId) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' })
    return
  }

  const state = reportStates.get(chatId)
  if (!state || state.step !== 'date') {
    await bot.answerCallbackQuery(query.id, { text: '❌ Сессия истекла' })
    return
  }

  try {
    // Вычисляем дату в зависимости от выбора
    const selectedDate = new Date()
    selectedDate.setHours(0, 0, 0, 0) // Обнуляем время

    if (query.data === 'date_yesterday') {
      selectedDate.setDate(selectedDate.getDate() - 1)
    } else if (query.data === 'date_daybeforeyesterday') {
      selectedDate.setDate(selectedDate.getDate() - 2)
    }

    // Обновляем состояние
    state.date = selectedDate
    state.step = 'zoomAppointments'

    // Получаем пользователя и предыдущий отчет для подсказок
    const telegramId = query.from.id.toString()
    const user = await prisma.user.findUnique({ where: { telegramId } })

    if (user) {
      const lastReport = await prisma.report.findFirst({
        where: {
          userId: user.id,
          date: { lt: selectedDate }
        },
        orderBy: { date: 'desc' }
      })

      if (lastReport) {
        state.lastReport = {
          zoomAppointments: lastReport.zoomAppointments,
          pzmConducted: lastReport.pzmConducted,
          refusalsCount: lastReport.refusalsCount,
          refusalsReasons: lastReport.refusalsReasons || undefined,
          warmingUpCount: lastReport.warmingUpCount,
          vzmConducted: lastReport.vzmConducted,
          contractReviewCount: lastReport.contractReviewCount,
          successfulDeals: lastReport.successfulDeals,
          monthlySalesAmount: lastReport.monthlySalesAmount.toNumber()
        }
      }
    }

    reportStates.set(chatId, state)

    // Отвечаем на callback query
    await bot.answerCallbackQuery(query.id, { text: '✅ Дата выбрана' })

    // Удаляем сообщение с клавиатурой
    await bot.deleteMessage(chatId, messageId)

    // Запрашиваем первое поле с подсказкой
    const suggestion = state.lastReport?.zoomAppointments !== undefined
      ? ` (Ранее: ${state.lastReport.zoomAppointments})`
      : ''

    await bot.sendMessage(
      chatId,
      `📋 *Отчёт за ${formatDateRu(selectedDate)}*\n\n` +
      `📞 Введите количество *назначенных ПЗМ*${suggestion}:`,
      { parse_mode: 'Markdown' }
    )
  } catch (error) {
    console.error('Error in handleDateCallback:', error)
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' })
  }
}

/**
 * Обработчик ввода полей отчёта (text messages)
 */
export async function handleReportInput(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  _prisma: PrismaClient
): Promise<void> {
  const chatId = msg.chat.id
  const text = msg.text?.trim()

  if (!text) return

  const state = reportStates.get(chatId)
  if (!state || state.step === 'date') return

  try {
    switch (state.step) {
      case 'zoomAppointments': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число (например: 5):')
          return
        }
        state.data.zoomAppointments = value
        state.step = 'pzmConducted'

        const suggestion = state.lastReport?.pzmConducted !== undefined
          ? ` (Ранее: ${state.lastReport.pzmConducted})`
          : ''
        await bot.sendMessage(chatId, `📞 Сколько было *проведённых ПЗМ*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'pzmConducted': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.pzmConducted = value
        state.step = 'refusalsCount'

        const suggestion = state.lastReport?.refusalsCount !== undefined
          ? ` (Ранее: ${state.lastReport.refusalsCount})`
          : ''
        await bot.sendMessage(chatId, `🚫 Количество *отказов*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'refusalsCount': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.refusalsCount = value

        if (value > 0) {
          state.step = 'refusalsReasons'
          await bot.sendMessage(chatId, '❓ Укажите *причину отказов* (текстом):', { parse_mode: 'Markdown' })
        } else {
          state.step = 'warmingUpCount'

          const suggestion = state.lastReport?.warmingUpCount !== undefined
            ? ` (Ранее: ${state.lastReport.warmingUpCount})`
            : ''
          await bot.sendMessage(chatId, `🔥 Количество *прогревов*?${suggestion}`, { parse_mode: 'Markdown' })
        }
        break
      }

      case 'refusalsReasons': {
        state.data.refusalsReasons = text
        state.step = 'warmingUpCount'

        const suggestion = state.lastReport?.warmingUpCount !== undefined
          ? ` (Ранее: ${state.lastReport.warmingUpCount})`
          : ''
        await bot.sendMessage(chatId, `🔥 Количество *прогревов*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'warmingUpCount': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.warmingUpCount = value
        state.step = 'vzmConducted'

        const suggestion = state.lastReport?.vzmConducted !== undefined
          ? ` (Ранее: ${state.lastReport.vzmConducted})`
          : ''
        await bot.sendMessage(chatId, `📹 Сколько *проведённых ВЗМ*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'vzmConducted': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.vzmConducted = value
        state.step = 'contractReviewCount'

        const suggestion = state.lastReport?.contractReviewCount !== undefined
          ? ` (Ранее: ${state.lastReport.contractReviewCount})`
          : ''
        await bot.sendMessage(chatId, `📄 Договоров *на проверке*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'contractReviewCount': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.contractReviewCount = value
        state.step = 'successfulDeals'

        const suggestion = state.lastReport?.successfulDeals !== undefined
          ? ` (Ранее: ${state.lastReport.successfulDeals})`
          : ''
        await bot.sendMessage(chatId, `🤝 Количество *успешных сделок*?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'successfulDeals': {
        const value = validateNumber(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите число:')
          return
        }
        state.data.successfulDeals = value
        state.step = 'monthlySalesAmount'

        const suggestion = state.lastReport?.monthlySalesAmount !== undefined
          ? ` (Ранее: ${state.lastReport.monthlySalesAmount})`
          : ''
        await bot.sendMessage(chatId, `💰 Общая *сумма продаж* (в рублях)?${suggestion}`, { parse_mode: 'Markdown' })
        break
      }

      case 'monthlySalesAmount': {
        const value = validateSalesAmount(text)
        if (value === null) {
          await bot.sendMessage(chatId, '❌ Введите корректную сумму (например: 50000):')
          return
        }
        state.data.monthlySalesAmount = value
        state.step = 'confirm'

        // Показываем preview отчёта
        const preview = formatReportPreview(state.data, state.date)
        await bot.sendMessage(
          chatId,
          preview,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Отправить', callback_data: 'confirm_report' },
                  { text: '✏️ Исправить', callback_data: 'cancel_report' } // Пока просто отмена, но можно сделать редактирование
                ]
              ]
            }
          }
        )
        break
      }

      default:
        break
    }

    reportStates.set(chatId, state)
  } catch (error) {
    console.error('Error in handleReportInput:', error)
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.')
  }
}

/**
 * Обработчик подтверждения отчёта (callback query)
 */
export async function handleReportConfirm(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery,
  prisma: PrismaClient
): Promise<void> {
  const chatId = query.message?.chat.id
  const messageId = query.message?.message_id
  const telegramId = query.from.id.toString()

  if (!chatId || !messageId) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' })
    return
  }

  const state = reportStates.get(chatId)
  if (!state || state.step !== 'confirm') {
    await bot.answerCallbackQuery(query.id, { text: '❌ Сессия истекла' })
    return
  }

  try {
    if (query.data === 'cancel_report') {
      reportStates.delete(chatId)
      await bot.answerCallbackQuery(query.id, { text: '❌ Отменено' })
      await bot.deleteMessage(chatId, messageId)
      await bot.sendMessage(chatId, '❌ Отчёт отменён. Используйте /report чтобы начать заново.')
      return
    }

    if (query.data === 'confirm_report') {
      const user = await prisma.user.findUnique({
        where: { telegramId }
      })

      if (!user) {
        await bot.answerCallbackQuery(query.id, { text: '❌ Пользователь не найден' })
        reportStates.delete(chatId)
        return
      }

      // Сохраняем отчёт в БД
      await prisma.report.upsert({
        where: {
          userId_date: {
            userId: user.id,
            date: state.date
          }
        },
        update: {
          zoomAppointments: state.data.zoomAppointments!,
          pzmConducted: state.data.pzmConducted!,
          refusalsCount: state.data.refusalsCount!,
          refusalsReasons: state.data.refusalsReasons || null,
          warmingUpCount: state.data.warmingUpCount!,
          vzmConducted: state.data.vzmConducted!,
          contractReviewCount: state.data.contractReviewCount!,
          successfulDeals: state.data.successfulDeals!,
          monthlySalesAmount: state.data.monthlySalesAmount!
        },
        create: {
          userId: user.id,
          date: state.date,
          zoomAppointments: state.data.zoomAppointments!,
          pzmConducted: state.data.pzmConducted!,
          refusalsCount: state.data.refusalsCount!,
          refusalsReasons: state.data.refusalsReasons || null,
          warmingUpCount: state.data.warmingUpCount!,
          vzmConducted: state.data.vzmConducted!,
          contractReviewCount: state.data.contractReviewCount!,
          successfulDeals: state.data.successfulDeals!,
          monthlySalesAmount: state.data.monthlySalesAmount!
        }
      })

      reportStates.delete(chatId)

      await bot.answerCallbackQuery(query.id, { text: '✅ Сохранено!' })
      await bot.deleteMessage(chatId, messageId)
      await bot.sendMessage(
        chatId,
        '🚀 *Отчёт принят!*\n\n' +
        'Данные обновлены в системе. Отличная работа!',
        { parse_mode: 'Markdown' }
      )
    }
  } catch (error) {
    console.error('Error in handleReportConfirm:', error)
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка сохранения' })
    await bot.sendMessage(chatId, '❌ Не удалось сохранить отчёт. Попробуйте позже.')
  }
}

/**
 * Вспомогательная функция для форматирования даты на русском
 */
function formatDateRu(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}
