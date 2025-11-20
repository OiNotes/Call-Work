import TelegramBot from 'node-telegram-bot-api'
import { PrismaClient } from '@prisma/client'

const pendingRegistrations = new Map<number, string>()

export async function registerHandler(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  prisma: PrismaClient
) {
  const chatId = msg.chat.id
  const telegramId = msg.from!.id.toString()

  // Проверка уже привязанного аккаунта
  const existingUser = await prisma.user.findUnique({
    where: { telegramId },
  })

  if (existingUser) {
    await bot.sendMessage(
      chatId,
      '✅ Ваш аккаунт уже привязан!\n\nИспользуйте /report для отправки отчёта.'
    )
    return
  }

  // Запрос кода
  await bot.sendMessage(
    chatId,
    '🔑 Введите код привязки из вашего профиля на сайте:\n\n' +
    '(Код действителен 15 минут)'
  )

  pendingRegistrations.set(chatId, 'awaiting_code')
}

export async function handleRegisterCode(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  prisma: PrismaClient
): Promise<boolean> {
  const chatId = msg.chat.id
  const telegramId = msg.from!.id.toString()
  const code = msg.text?.trim()

  if (!code || !pendingRegistrations.has(chatId)) {
    return false
  }

  try {
    // Поиск пользователя по коду
    const user = await prisma.user.findFirst({
      where: {
        telegramCode: code,
        codeExpiresAt: {
          gte: new Date(),
        },
      },
    })

    if (!user) {
      await bot.sendMessage(
        chatId,
        '❌ *Код не найден или истёк*\n\n' +
        'Пожалуйста, сгенерируйте новый код в личном кабинете и отправьте его сюда.',
        { parse_mode: 'Markdown' }
      )
      return true
    }

    // Привязка Telegram
    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId,
        telegramCode: null,
        codeExpiresAt: null,
      },
    })

    pendingRegistrations.delete(chatId)

    await bot.sendMessage(
      chatId,
      `🎉 *Успешно!* Аккаунт *${user.name}* привязан.\n\n` +
      'Теперь вы можете сдавать отчёты через команду /report\n' +
      'Удачи в продажах! 🚀',
      { parse_mode: 'Markdown' }
    )
    return true
  } catch (error) {
    console.error('Registration error:', error)
    await bot.sendMessage(
      chatId,
      '❌ Произошла ошибка. Попробуйте позже.'
    )
    return true
  }
}
