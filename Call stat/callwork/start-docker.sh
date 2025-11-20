#!/bin/bash

# Скрипт запуска Callwork с Docker PostgreSQL
# Использование: ./start-docker.sh

set -e

PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0/Call stat/callwork"
cd "$PROJECT_DIR"

echo "🐳 Запуск Callwork с Docker PostgreSQL..."
echo ""

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker не установлен!${NC}"
    echo "Установите Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker найден"

# Запуск Docker Compose
echo ""
echo "📦 Запуск PostgreSQL контейнера..."
docker-compose up -d

# Ждем готовности PostgreSQL
echo ""
echo "⏳ Ожидание готовности PostgreSQL..."
sleep 5

# Проверка health
for i in {1..30}; do
    if docker-compose ps | grep -q "healthy"; then
        echo -e "${GREEN}✓${NC} PostgreSQL готов!"
        break
    fi
    echo -n "."
    sleep 1
done

# Применение миграций Prisma
echo ""
echo "🗄️  Применение схемы БД..."
npx prisma generate
npx prisma db push --skip-generate

echo ""
echo -e "${GREEN}✅ Docker PostgreSQL запущен!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Информация"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 PostgreSQL:"
echo "   Host: localhost:5432"
echo "   Database: callwork"
echo "   User: callwork_user"
echo "   Password: callwork_password"
echo ""
echo "🔧 pgAdmin:"
echo "   URL: http://localhost:5050"
echo "   Email: admin@callwork.local"
echo "   Password: admin123"
echo ""
echo "Теперь запустите приложение:"
echo "  npm run dev          # Next.js"
echo "  npm run bot:dev      # Telegram Bot"
echo ""
echo "Остановка:"
echo "  docker-compose down"
echo ""
