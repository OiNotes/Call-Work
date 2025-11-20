#!/bin/bash

# Скрипт для локального запуска Callwork
# Автор: Claude Code
# Дата: 2025-11-18

set -e

PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0/Call stat/callwork"
cd "$PROJECT_DIR"

echo "🚀 Запуск Callwork локально..."
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка .env файла
if [ ! -f .env ]; then
    echo -e "${RED}❌ Файл .env не найден!${NC}"
    echo ""
    echo "Создайте файл .env со следующими переменными:"
    echo ""
    echo "DATABASE_URL=\"postgresql://user:password@localhost:5432/callwork\""
    echo "NEXTAUTH_SECRET=\"$(openssl rand -base64 32)\""
    echo "NEXTAUTH_URL=\"http://localhost:3000\""
    echo "TELEGRAM_BOT_TOKEN=\"your-bot-token-here\""
    echo ""
    exit 1
fi

echo -e "${GREEN}✓${NC} .env файл найден"

# Проверка DATABASE_URL
if ! grep -q "DATABASE_URL" .env; then
    echo -e "${RED}❌ DATABASE_URL не найден в .env${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} DATABASE_URL настроен"

# Проверка NEXTAUTH_SECRET
if ! grep -q "NEXTAUTH_SECRET" .env; then
    echo -e "${YELLOW}⚠${NC} NEXTAUTH_SECRET не найден, генерирую..."
    SECRET=$(openssl rand -base64 32)
    echo "NEXTAUTH_SECRET=\"$SECRET\"" >> .env
    echo -e "${GREEN}✓${NC} NEXTAUTH_SECRET добавлен в .env"
fi

# Проверка NEXTAUTH_URL
if ! grep -q "NEXTAUTH_URL" .env; then
    echo "NEXTAUTH_URL=\"http://localhost:3000\"" >> .env
    echo -e "${GREEN}✓${NC} NEXTAUTH_URL добавлен в .env"
fi

echo ""
echo "📦 Проверка зависимостей..."
if [ ! -d "node_modules" ]; then
    echo "Установка зависимостей..."
    npm install
else
    echo -e "${GREEN}✓${NC} Зависимости установлены"
fi

echo ""
echo "🗄️  Проверка базы данных..."
echo "Применение миграций Prisma..."
npx prisma generate
npx prisma db push --skip-generate

echo ""
echo -e "${GREEN}✅ Подготовка завершена!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Запуск сервисов..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Next.js: http://localhost:3000"
echo "🤖 Telegram Bot: running..."
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запуск в фоновых процессах
trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Запуск Next.js
echo -e "${YELLOW}[Next.js]${NC} Запуск веб-приложения..."
npm run dev > /tmp/callwork-nextjs.log 2>&1 &
NEXTJS_PID=$!

# Ждем запуска Next.js
sleep 5

# Проверка Telegram bot token
if grep -q "TELEGRAM_BOT_TOKEN=\"your-bot-token-here\"" .env || ! grep -q "TELEGRAM_BOT_TOKEN" .env; then
    echo -e "${YELLOW}⚠${NC} TELEGRAM_BOT_TOKEN не настроен - бот не запущен"
    echo ""
    echo "Чтобы запустить бота:"
    echo "1. Создайте бота через @BotFather в Telegram"
    echo "2. Добавьте токен в .env: TELEGRAM_BOT_TOKEN=\"your-token\""
    echo "3. Запустите: npm run bot:dev"
else
    # Запуск Telegram bot
    echo -e "${YELLOW}[Bot]${NC} Запуск Telegram бота..."
    npm run bot:dev > /tmp/callwork-bot.log 2>&1 &
    BOT_PID=$!
fi

echo ""
echo -e "${GREEN}✅ Сервисы запущены!${NC}"
echo ""
echo "📊 Логи:"
echo "  Next.js: tail -f /tmp/callwork-nextjs.log"
echo "  Bot: tail -f /tmp/callwork-bot.log"
echo ""

# Ждем завершения
wait
