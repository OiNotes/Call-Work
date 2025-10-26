# Ngrok Development Setup

Автоматическая настройка HTTPS туннелей для разработки Telegram Mini App.

## Быстрый старт (3 минуты)

### 1. Установить ngrok

```bash
# macOS
brew install ngrok

# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok

# Windows
choco install ngrok
```

### 2. Установить зависимости

```bash
# Root зависимости (node-fetch для update-env.js)
npm install

# Все модули проекта
npm run install:all
```

### 3. Создать .env файлы

```bash
# Создать из примеров
cp backend/.env.development.example backend/.env
cp bot/.env.development.example bot/.env
cp webapp/.env.development.example webapp/.env

# Отредактировать важные переменные:
# - BOT_TOKEN (в backend/.env и bot/.env)
# - DATABASE_URL (в backend/.env)
# - JWT_SECRET (в backend/.env)
```

### 4. Запустить с ngrok

```bash
# Одна команда запускает всё
npm run dev:ngrok
```

### 5. Настроить BotFather

```bash
# Получить инструкции и WebApp URL
npm run setup:botfather

# Скопировать URL и настроить в BotFather:
# /mybots → Your Bot → Bot Settings → Menu Button
# Отправить WebApp URL
```

## Что происходит внутри `npm run dev:ngrok`

```
1. ✅ Проверка зависимостей (ngrok, PostgreSQL)
2. 📦 Запуск Backend (port 3000)
3. 🎨 Запуск WebApp (port 5173)
4. 🌐 Создание ngrok туннеля для Backend
5. 🌐 Создание ngrok туннеля для WebApp
6. 📝 Автоматическое обновление .env файлов
7. 📊 Вывод Process IDs и логов
8. ⏸️  Ожидание Ctrl+C для остановки
9. 🛑 Автоматическая остановка всех процессов
```

## Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run dev:ngrok` | Запустить весь stack с ngrok |
| `npm run ngrok:update-env` | Обновить .env файлы с текущими ngrok URLs |
| `npm run ngrok:status` | Показать статус ngrok туннелей (требует `jq`) |
| `npm run setup:botfather` | Инструкции для настройки BotFather |

## Логи

Все логи сохраняются в директории `logs/`:

```bash
# Backend
tail -f logs/backend.log

# WebApp
tail -f logs/webapp.log

# Ngrok Backend
tail -f logs/ngrok-backend.log

# Ngrok WebApp
tail -f logs/ngrok-webapp.log

# Ngrok Web UI (лучший вариант)
open http://localhost:4040
```

## Environment Variables (автоматически обновляются)

### backend/.env
```bash
FRONTEND_URL=https://xyz.ngrok-free.app
BACKEND_URL=https://abc.ngrok-free.app
```

### bot/.env
```bash
WEBAPP_URL=https://xyz.ngrok-free.app
BACKEND_URL=https://abc.ngrok-free.app
```

### webapp/.env
```bash
VITE_API_URL=https://abc.ngrok-free.app/api
```

## Workflow для ежедневной разработки

```bash
# Утро
npm run dev:ngrok

# Подождать 10 секунд пока всё запустится

# Обновить BotFather Menu Button (URL меняется каждый день)
npm run setup:botfather
# → Скопировать URL
# → BotFather: /mybots → Bot Settings → Menu Button
# → Отправить URL

# Работать...
# - Логи: http://localhost:4040
# - Backend: https://abc.ngrok-free.app
# - WebApp: https://xyz.ngrok-free.app
# - Bot: открыть в Telegram

# Вечер
Ctrl+C  # Останавливает всё автоматически
```

## Troubleshooting

### "ngrok is not installed"

```bash
# Установить ngrok
brew install ngrok  # macOS

# Проверить установку
ngrok --version
```

### "PostgreSQL is not running"

```bash
# Запустить PostgreSQL
brew services start postgresql@15  # macOS
sudo systemctl start postgresql    # Linux

# Проверить
pg_isready
```

### "Failed to fetch ngrok tunnels"

```bash
# Проверить что ngrok API работает
curl http://localhost:4040/api/tunnels

# Если не работает, перезапустить
killall ngrok
npm run dev:ngrok
```

### "Not all tunnels found"

Нужно 2 ngrok туннеля (ports 3000 и 5173).

**Решение:** `npm run dev:ngrok` создаёт оба автоматически.

Если запускали вручную:
```bash
# Terminal 1
ngrok http 3000

# Terminal 2
ngrok http 5173

# Terminal 3
npm run ngrok:update-env
```

### Bot Menu Button не работает

1. Проверить WebApp URL:
```bash
npm run setup:botfather
```

2. Обновить в BotFather:
```
/mybots → Your Bot → Bot Settings → Menu Button
```

3. Протестировать:
- Открыть бота в Telegram
- Нажать кнопку меню (слева внизу)

### Ngrok показывает "Visit Site" экран

Это нормально для бесплатного плана ngrok. Пользователи увидят предупреждение перед открытием WebApp.

**Решение для продакшена:**
1. Купить ngrok Pro ($8/month) - без предупреждений
2. Или использовать собственный домен с SSL сертификатом

## Альтернатива: Постоянные ngrok домены

Если у вас платный ngrok план с постоянными доменами:

```bash
# В ngrok.yml
tunnels:
  backend:
    proto: http
    addr: 3000
    domain: your-backend.ngrok.app
  webapp:
    proto: http
    addr: 5173
    domain: your-webapp.ngrok.app

# Запустить
ngrok start backend webapp

# Обновить .env один раз
npm run ngrok:update-env

# Потом можно использовать обычный dev режим
npm run dev
```

## Безопасность

### Не коммитить ngrok URLs в git

`.env` файлы уже в `.gitignore`, но будьте внимательны:
- ❌ НЕ коммитить `.env` с реальными URLs
- ✅ Использовать `.env.example` для документации

### Ротация URLs

Бесплатный ngrok генерирует новые URLs при каждом запуске:
- ✅ Хорошо для разработки (безопасность)
- ❌ Нужно обновлять BotFather каждый день

### Rate Limiting

Бесплатный ngrok имеет лимиты:
- 40 connections/minute
- HTTP request inspection (limited)

Для продакшена используйте платный план или собственный домен.

## Полезные ссылки

- [ngrok Documentation](https://ngrok.com/docs)
- [ngrok Dashboard](https://dashboard.ngrok.com)
- [ngrok Pricing](https://ngrok.com/pricing)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)

## Структура файлов

```
Status Stock 4.0/
├── dev-scripts/
│   ├── update-env.js           # Обновление .env с ngrok URLs
│   ├── ngrok-setup.sh          # Запуск всего стека
│   ├── setup-botfather.sh      # BotFather helper
│   └── README.md              # Детальная документация
├── logs/
│   ├── .gitkeep               # Keep directory
│   ├── backend.log            # Backend логи
│   ├── webapp.log             # WebApp логи
│   ├── ngrok-backend.log      # Ngrok backend логи
│   └── ngrok-webapp.log       # Ngrok webapp логи
├── backend/.env.development.example
├── bot/.env.development.example
├── webapp/.env.development.example
└── NGROK_SETUP.md             # Этот файл
```

## FAQ

**Q: Нужно ли устанавливать ngrok глобально?**
A: Да, `brew install ngrok` устанавливает глобально.

**Q: Можно ли использовать другие туннели (localtunnel, serveo)?**
A: Да, но нужно изменить `dev-scripts/ngrok-setup.sh` и `update-env.js`.

**Q: Ngrok URLs меняются при каждом запуске?**
A: Да, для бесплатного плана. Платный план даёт постоянные домены.

**Q: Как запустить только backend или только webapp?**
A: Используйте стандартные команды:
```bash
npm run dev:backend  # Только backend
npm run dev:webapp   # Только webapp
npm run dev          # Backend + WebApp (без ngrok)
```

**Q: Можно ли использовать ngrok для бота?**
A: Бот работает в polling режиме (не нужен HTTPS). Для webhook режима нужен отдельный ngrok туннель.

**Q: Сколько стоит ngrok Pro?**
A: $8/месяц - постоянные домены, без предупреждений, больше connections.
