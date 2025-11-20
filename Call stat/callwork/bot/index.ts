import TelegramBot from 'node-telegram-bot-api'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

// Импортируем handlers
import { startHandler } from './handlers/start'
import { registerHandler, handleRegisterCode } from './handlers/register'
import { 
  reportHandler, 
  handleDateCallback, 
  handleReportInput, 
  handleReportConfirm 
} from './handlers/report'

// Загружаем переменные окружения
dotenv.config()

// Инициализируем Prisma Client
const prisma = new PrismaClient()

// Получаем токен бота из .env
const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле')
  process.exit(1)
}

// Создаём экземпляр бота с polling
const bot = new TelegramBot(token, { polling: true })

console.log('🤖 Callwork Bot запущен...')

// ============================================
// COMMAND HANDLERS
// ============================================

// Команда /start
bot.onText(/\/start/, (msg: TelegramBot.Message) => {
  startHandler(bot, msg)
})

// Команда /register
bot.onText(/\/register/, (msg: TelegramBot.Message) => {
  registerHandler(bot, msg, prisma)
})

// Команда /report
bot.onText(/\/report/, (msg: TelegramBot.Message) => {
  reportHandler(bot, msg, prisma)
})

// ============================================
// CALLBACK QUERY HANDLERS (inline keyboards)
// ============================================

bot.on('callback_query', (query: TelegramBot.CallbackQuery) => {
  const data = query.data

  if (!data) return

  // Обработка выбора даты для отчёта
  if (data.startsWith('date_')) {
    handleDateCallback(bot, query, prisma)
    return
  }

  // Обработка подтверждения/отмены отчёта
  if (data === 'confirm_report' || data === 'cancel_report') {
    handleReportConfirm(bot, query, prisma)
    return
  }

  // Неизвестный callback
  bot.answerCallbackQuery(query.id, { text: '❌ Неизвестная команда' })
})

// ============================================
// TEXT MESSAGE HANDLERS
// ============================================

bot.on('message', (msg: TelegramBot.Message) => {
  // Пропускаем команды (они обрабатываются через onText)
  if (msg.text?.startsWith('/')) return

  // Проверяем, ожидает ли бот ввод кода регистрации
  handleRegisterCode(bot, msg, prisma).then(isRegisterCode => {
    if (isRegisterCode) return
    // Проверяем, находится ли пользователь в процессе создания отчёта
    handleReportInput(bot, msg, prisma)
  })
})

// ============================================
// ERROR HANDLERS
// ============================================

// Обработка ошибок polling
bot.on('polling_error', (error: Error) => {
  console.error('❌ Polling error:', error)
})



// ============================================
// GRACEFUL SHUTDOWN
// ============================================

// Обработка завершения процесса
process.on('SIGINT', async () => {
  console.log('\n🛑 Остановка бота...')
  await prisma.$disconnect()
  await bot.stopPolling()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Остановка бота...')
  await prisma.$disconnect()
  await bot.stopPolling()
  process.exit(0)
})

// Обработка необработанных ошибок
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error)
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error)
  process.exit(1)
})

export default bot
