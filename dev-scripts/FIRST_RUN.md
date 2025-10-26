# First Run Guide - Ngrok Setup

Пошаговая инструкция для первого запуска проекта с ngrok.

## Шаг 1: Установка зависимостей (5 минут)

### 1.1 Установить ngrok

```bash
# macOS
brew install ngrok

# Verify
ngrok --version
```

### 1.2 Установить PostgreSQL (если не установлен)

```bash
# macOS
brew install postgresql@15

# Start
brew services start postgresql@15

# Verify
pg_isready
```

### 1.3 Установить Node.js зависимости

```bash
# Root (node-fetch для update-env.js)
npm install

# Все модули проекта
npm run install:all
```

## Шаг 2: Настройка .env файлов (2 минуты)

### 2.1 Создать .env из примеров

```bash
# Backend
cp backend/.env.development.example backend/.env

# Bot
cp bot/.env.development.example bot/.env

# WebApp
cp webapp/.env.development.example webapp/.env
```

### 2.2 Отредактировать backend/.env

Откройте `backend/.env` и установите:

```bash
# ОБЯЗАТЕЛЬНО изменить:
BOT_TOKEN=YOUR_REAL_BOT_TOKEN_FROM_BOTFATHER
JWT_SECRET=your-secure-random-string-at-least-32-chars

# Если нужно, изменить DATABASE_URL:
DATABASE_URL=postgresql://admin:password@localhost:5432/telegram_shop

# Остальное оставить как есть
# FRONTEND_URL и BACKEND_URL будут обновлены автоматически
```

### 2.3 Отредактировать bot/.env

Откройте `bot/.env` и установите:

```bash
# Тот же токен что в backend/.env
BOT_TOKEN=YOUR_REAL_BOT_TOKEN_FROM_BOTFATHER

# Остальное будет обновлено автоматически
```

### 2.4 WebApp не требует изменений

`webapp/.env` будет обновлён автоматически ngrok скриптом.

## Шаг 3: Настройка базы данных (1 минута)

```bash
# Создать БД и выполнить миграции
npm run db:setup

# Если БД уже существует, только миграции:
npm run db:migrate
```

## Шаг 4: Сделать скрипты исполняемыми (30 секунд)

```bash
chmod +x dev-scripts/*.sh
```

## Шаг 5: Проверка настройки (30 секунд)

```bash
bash dev-scripts/verify-setup.sh
```

Вывод должен показать:
- ✅ ngrok installed
- ✅ PostgreSQL running
- ✅ node-fetch installed
- ✅ All .env files exist
- ✅ All scripts executable

## Шаг 6: Первый запуск (30 секунд)

```bash
npm run dev:ngrok
```

**Что произойдёт:**
1. Проверка зависимостей
2. Запуск Backend (port 3000)
3. Запуск WebApp (port 5173)
4. Создание 2 ngrok туннелей
5. Автоматическое обновление .env файлов
6. Вывод статуса

**Вывод будет таким:**
```
🚀 Starting Status Stock 4.0 with ngrok...

✅ PostgreSQL is running

📦 Starting backend (port 3000)...
🎨 Starting webapp (port 5173)...
🌐 Starting ngrok tunnel for backend...
🌐 Starting ngrok tunnel for webapp...
📝 Updating .env files with ngrok URLs...

🔍 Fetching ngrok tunnels...

📡 Ngrok Tunnels Found:
   Backend:  https://abc123.ngrok-free.app
   WebApp:   https://xyz789.ngrok-free.app

✅ Updated .env
✅ Updated .env
✅ Updated .env

✅ All .env files updated!

📋 Next steps:
   1. Restart backend & bot to pick up new URLs
   2. Update BotFather Menu Button:
      /setmenubutton → https://xyz789.ngrok-free.app
   3. Test: Open bot in Telegram and click Menu button

✅ All services started!

📊 Process IDs:
   Backend:       12345
   WebApp:        12346
   Ngrok Backend: 12347
   Ngrok WebApp:  12348

📋 Logs:
   Backend: tail -f logs/backend.log
   WebApp:  tail -f logs/webapp.log
   Ngrok:   http://localhost:4040 (web interface)

Press Ctrl+C to stop all services
```

## Шаг 7: Настройка BotFather (1 минута)

### 7.1 Получить WebApp URL

```bash
# В новом терминале (не закрывая dev:ngrok)
npm run setup:botfather
```

Скопируйте WebApp URL из вывода.

### 7.2 Настроить Menu Button

1. Откройте Telegram
2. Найдите @BotFather
3. Отправьте: `/mybots`
4. Выберите вашего бота
5. Нажмите: **Bot Settings** → **Menu Button**
6. Отправьте текст кнопки: `📱 Открыть Menu`
7. Отправьте WebApp URL (из шага 7.1)

## Шаг 8: Тестирование (1 минута)

1. Откройте вашего бота в Telegram
2. Нажмите на кнопку меню (слева внизу от поля ввода)
3. Должна открыться WebApp

**Если не работает:**
- Проверьте логи: `tail -f logs/backend.log`
- Откройте ngrok UI: `http://localhost:4040`
- Проверьте что URL правильный: `npm run setup:botfather`

## Шаг 9: Остановка (5 секунд)

В терминале где запущен `npm run dev:ngrok`:

```bash
Ctrl+C
```

Все процессы остановятся автоматически.

## Troubleshooting

### "ngrok is not installed"
```bash
brew install ngrok
ngrok --version
```

### "PostgreSQL is not running"
```bash
brew services start postgresql@15
pg_isready
```

### "Failed to fetch ngrok tunnels"
```bash
# Проверить ngrok API
curl http://localhost:4040/api/tunnels

# Если не работает, перезапустить
killall ngrok
npm run dev:ngrok
```

### Backend не запускается
```bash
# Проверить логи
tail -f logs/backend.log

# Проверить что PostgreSQL работает
pg_isready

# Проверить что БД существует
psql -l | grep telegram_shop
```

### WebApp не открывается
1. Проверить URL в BotFather
2. Проверить логи: `tail -f logs/webapp.log`
3. Открыть ngrok UI: `http://localhost:4040`
4. Проверить что VITE_API_URL правильный в `webapp/.env`

## Полезные команды

```bash
# Проверка статуса
npm run ngrok:status

# Просмотр логов
tail -f logs/backend.log
tail -f logs/webapp.log

# Ngrok Web UI
open http://localhost:4040

# Проверка БД
psql -d telegram_shop -c "\dt"

# Перезапуск с чистыми логами
rm -f logs/*.log
npm run dev:ngrok
```

## Next Steps

После успешного первого запуска:

1. Ознакомьтесь с полной документацией: [NGROK_SETUP.md](./NGROK_SETUP.md)
2. Изучите dev-scripts: [dev-scripts/README.md](./README.md)
3. Настройте Telegram Bot: [bot/README.md](../bot/README.md)
4. Изучите Backend API: [backend/README.md](../backend/README.md)
5. Настройте WebApp: [webapp/README.md](../webapp/README.md)

## Ежедневный workflow

```bash
# Утро
npm run dev:ngrok

# Обновить BotFather (URL меняется каждый день)
npm run setup:botfather
# → Скопировать URL → BotFather

# Работать...

# Вечер
Ctrl+C
```

Готово! 🎉
