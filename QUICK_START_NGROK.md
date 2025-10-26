# Quick Start - Ngrok (60 секунд)

Запуск проекта с HTTPS туннелями одной командой.

## Предварительные требования

```bash
# 1. Установить ngrok (один раз)
brew install ngrok

# 2. Установить зависимости (один раз)
npm install
npm run install:all

# 3. Создать .env файлы (один раз)
cp backend/.env.development.example backend/.env
cp bot/.env.development.example bot/.env
cp webapp/.env.development.example webapp/.env

# 4. Отредактировать backend/.env и bot/.env
# Установить BOT_TOKEN и JWT_SECRET

# 5. Настроить БД (один раз)
npm run db:setup

# 6. Сделать скрипты исполняемыми (один раз)
chmod +x dev-scripts/*.sh
```

## Запуск

```bash
# Запустить весь stack с ngrok
npm run dev:ngrok

# Подождать 10 секунд...

# В новом терминале: получить WebApp URL
npm run setup:botfather

# Скопировать URL → BotFather → /mybots → Bot Settings → Menu Button
```

## Тестирование

1. Открыть бота в Telegram
2. Нажать кнопку меню (слева внизу)
3. WebApp должна открыться

## Остановка

```bash
Ctrl+C  # В терминале где запущен dev:ngrok
```

## Полезные ссылки

- **Полная документация:** [NGROK_SETUP.md](./NGROK_SETUP.md)
- **Первый запуск:** [dev-scripts/FIRST_RUN.md](./dev-scripts/FIRST_RUN.md)
- **Чеклист:** [dev-scripts/CHECKLIST.md](./dev-scripts/CHECKLIST.md)

## Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run dev:ngrok` | Запустить Backend + WebApp + ngrok |
| `npm run ngrok:update-env` | Обновить .env с ngrok URLs |
| `npm run ngrok:status` | Статус туннелей |
| `npm run setup:botfather` | Инструкции для BotFather |

## Troubleshooting

```bash
# Проверить настройку
bash dev-scripts/verify-setup.sh

# Проверить логи
tail -f logs/backend.log
tail -f logs/webapp.log

# Ngrok Web UI
open http://localhost:4040

# Перезапуск
killall ngrok
npm run dev:ngrok
```

---

Готово! 🚀
