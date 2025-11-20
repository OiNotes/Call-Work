# Development Scripts

Автоматизация для ngrok development setup в проекте Status Stock 4.0.

## Быстрый старт

```bash
# 1. Установить ngrok (если не установлен)
brew install ngrok  # macOS
# или скачать с https://ngrok.com/download

# 2. Установить зависимости
npm install

# 3. Создать .env файлы из примеров
cp backend/.env.development.example backend/.env
cp bot/.env.development.example bot/.env
cp webapp/.env.development.example webapp/.env

# 4. Запустить всё с ngrok
npm run dev:ngrok
```

## Доступные команды

### `npm run dev:ngrok`

Запускает полный development stack с ngrok туннелями:

- Backend (port 3000) + ngrok HTTPS tunnel
- WebApp (port 5173) + ngrok HTTPS tunnel
- Автоматически обновляет .env файлы с ngrok URLs

**Что происходит:**

1. Проверяет наличие PostgreSQL и ngrok
2. Запускает backend и webapp
3. Создаёт 2 ngrok туннеля (для backend и webapp)
4. Обновляет все .env файлы с актуальными URLs
5. Показывает Process IDs и пути к логам

**Остановка:**

- Нажмите `Ctrl+C` → автоматически остановит все процессы

### `npm run ngrok:update-env`

Обновляет .env файлы с текущими ngrok URLs (если туннели уже запущены).

**Использование:**

```bash
# Если у вас уже запущены ngrok туннели вручную:
ngrok http 3000  # в одном терминале
ngrok http 5173  # в другом терминале

# Обновить .env файлы:
npm run ngrok:update-env
```

### `npm run ngrok:status`

Показывает статус текущих ngrok туннелей в JSON формате.

**Требования:** `jq` CLI tool

```bash
brew install jq  # macOS
```

**Пример вывода:**

```json
{
  "name": "http://localhost:3000",
  "public_url": "https://abc123.ngrok-free.app",
  "config": {
    "addr": "http://localhost:3000",
    "inspect": true
  }
}
```

### `npm run setup:botfather`

Показывает инструкции для настройки Menu Button в BotFather.

**Использование:**

```bash
npm run setup:botfather
```

Вывод покажет:

- Пошаговые инструкции для BotFather
- Актуальный WebApp URL из `webapp/.env`
- Как протестировать Menu Button

## Структура файлов

```
dev-scripts/
├── update-env.js           # Node.js скрипт для обновления .env
├── ngrok-setup.sh          # Bash скрипт для запуска всего стека
├── setup-botfather.sh      # Helper для BotFather настройки
└── README.md              # Этот файл
```

## Как это работает

### 1. ngrok-setup.sh

```bash
#!/bin/bash
# 1. Проверяет зависимости (ngrok, PostgreSQL)
# 2. Запускает backend и webapp в background
# 3. Создаёт 2 ngrok туннеля
# 4. Вызывает update-env.js для обновления .env
# 5. Показывает статус и ждёт Ctrl+C
# 6. При остановке убивает все процессы
```

### 2. update-env.js

```javascript
// 1. Делает GET http://localhost:4040/api/tunnels (ngrok API)
// 2. Находит туннели для портов 3000 и 5173
// 3. Обновляет:
//    - backend/.env: FRONTEND_URL, BACKEND_URL
//    - bot/.env: WEBAPP_URL, BACKEND_URL
//    - webapp/.env: VITE_API_URL
// 4. Показывает Next Steps для BotFather
```

## Логи

Все логи сохраняются в директории `logs/`:

```bash
# Backend логи
tail -f logs/backend.log

# WebApp логи
tail -f logs/webapp.log

# Ngrok backend логи
tail -f logs/ngrok-backend.log

# Ngrok webapp логи
tail -f logs/ngrok-webapp.log
```

**Ngrok Web Interface:**

- URL: http://localhost:4040
- Показывает все HTTP/HTTPS запросы в реальном времени
- Полезно для debugging webhook'ов

## Troubleshooting

### Ошибка: "ngrok is not installed"

```bash
# macOS
brew install ngrok

# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok
```

### Ошибка: "PostgreSQL is not running"

```bash
# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql

# Docker
docker-compose up -d postgres
```

### Ошибка: "Failed to fetch ngrok tunnels"

Убедитесь что ngrok туннели запущены:

```bash
# Проверить ngrok API
curl http://localhost:4040/api/tunnels

# Если не работает, перезапустите ngrok
killall ngrok
npm run dev:ngrok
```

### Ошибка: "Not all tunnels found"

Нужно 2 ngrok туннеля (для портов 3000 и 5173).

**Решение 1:** Используйте `npm run dev:ngrok` (автоматически)

**Решение 2:** Запустите вручную в 2 терминалах:

```bash
# Terminal 1
ngrok http 3000

# Terminal 2
ngrok http 5173

# Terminal 3
npm run ngrok:update-env
```

### Bot Menu Button не работает

1. Проверьте что WebApp URL правильный:

```bash
npm run setup:botfather
```

2. Обновите Menu Button в BotFather:

```
/mybots → Ваш бот → Bot Settings → Menu Button
```

3. Отправьте WebApp URL (из вывода `setup:botfather`)

4. Протестируйте:

- Откройте бота в Telegram
- Нажмите на кнопку меню (слева внизу)
- WebApp должна открыться

## Environment Variables

### Backend (.env)

```bash
FRONTEND_URL=https://xyz.ngrok-free.app    # WebApp URL
BACKEND_URL=https://abc.ngrok-free.app     # Backend URL
```

### Bot (.env)

```bash
WEBAPP_URL=https://xyz.ngrok-free.app      # WebApp URL для Menu Button
BACKEND_URL=https://abc.ngrok-free.app     # Backend API URL
```

### WebApp (.env)

```bash
VITE_API_URL=https://abc.ngrok-free.app/api  # Backend API endpoint
```

## Workflow

### Ежедневная разработка

```bash
# Утро:
npm run dev:ngrok

# Обновить BotFather Menu Button (URL меняется каждый раз):
npm run setup:botfather
# Скопировать URL → BotFather

# Работать...

# Вечер:
Ctrl+C  # Останавливает всё
```

### Если ngrok URL не изменился

Если вы используете платный ngrok план с постоянными доменами:

```bash
# Просто обновить .env один раз
npm run ngrok:update-env

# Потом можно использовать обычный dev режим
npm run dev
```

## Полезные ссылки

- [ngrok Documentation](https://ngrok.com/docs)
- [ngrok Dashboard](https://dashboard.ngrok.com)
- [Telegram Bot API - Web Apps](https://core.telegram.org/bots/webapps)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)
