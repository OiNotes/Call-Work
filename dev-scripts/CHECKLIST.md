# Ngrok Setup Checklist

Быстрый чеклист для запуска проекта с ngrok.

## ✅ Pre-Setup

- [ ] ngrok установлен: `ngrok --version`
- [ ] PostgreSQL работает: `pg_isready`
- [ ] Node.js 18+: `node --version`
- [ ] npm 9+: `npm --version`

## ✅ Установка

- [ ] Root зависимости: `npm install`
- [ ] Все модули: `npm run install:all`
- [ ] Скрипты исполняемые: `chmod +x dev-scripts/*.sh`

## ✅ Configuration

- [ ] `backend/.env` создан из `.env.development.example`
- [ ] `bot/.env` создан из `.env.development.example`
- [ ] `webapp/.env` создан из `.env.development.example`
- [ ] `BOT_TOKEN` установлен в `backend/.env` и `bot/.env`
- [ ] `JWT_SECRET` установлен в `backend/.env`
- [ ] `DATABASE_URL` правильный в `backend/.env`

## ✅ Database

- [ ] БД создана: `createdb telegram_shop` (или `npm run db:setup`)
- [ ] Миграции выполнены: `npm run db:migrate`
- [ ] Таблицы созданы: `psql -d telegram_shop -c "\dt"`

## ✅ Verification

- [ ] Проверка настройки: `bash dev-scripts/verify-setup.sh`
- [ ] Все чеки зелёные ✅

## ✅ First Run

- [ ] Запуск: `npm run dev:ngrok`
- [ ] Backend запустился (порт 3000)
- [ ] WebApp запустилась (порт 5173)
- [ ] Ngrok туннели созданы
- [ ] `.env` файлы обновлены с ngrok URLs
- [ ] Логи без ошибок: `tail -f logs/backend.log`

## ✅ BotFather Setup

- [ ] Получить WebApp URL: `npm run setup:botfather`
- [ ] Открыть @BotFather в Telegram
- [ ] `/mybots` → Выбрать бота
- [ ] Bot Settings → Menu Button
- [ ] Текст кнопки: `📱 Открыть Menu`
- [ ] WebApp URL вставлен

## ✅ Testing

- [ ] Открыть бота в Telegram
- [ ] Нажать кнопку меню (слева внизу)
- [ ] WebApp открывается
- [ ] API запросы работают (проверить ngrok UI: `http://localhost:4040`)

## ✅ Daily Workflow

Для ежедневной работы:

```bash
# Утро
npm run dev:ngrok

# Обновить BotFather Menu Button (URL меняется)
npm run setup:botfather

# Работать...

# Вечер
Ctrl+C
```

## Troubleshooting

Если что-то не работает, проверьте:

1. **Ngrok API доступен:**
   ```bash
   curl http://localhost:4040/api/tunnels
   ```

2. **PostgreSQL работает:**
   ```bash
   pg_isready
   brew services list | grep postgresql
   ```

3. **Порты свободны:**
   ```bash
   lsof -i :3000  # Backend
   lsof -i :5173  # WebApp
   ```

4. **Логи без ошибок:**
   ```bash
   tail -f logs/backend.log
   tail -f logs/webapp.log
   ```

5. **Ngrok Web UI:**
   ```bash
   open http://localhost:4040
   ```

## Полезные команды

```bash
# Статус туннелей
npm run ngrok:status

# Обновить .env файлы
npm run ngrok:update-env

# Инструкции BotFather
npm run setup:botfather

# Проверка настройки
bash dev-scripts/verify-setup.sh

# Чистка логов
rm -f logs/*.log

# Остановить все процессы ngrok
killall ngrok
```

## Files Created

Убедитесь что созданы все файлы:

```
✅ dev-scripts/update-env.js
✅ dev-scripts/ngrok-setup.sh
✅ dev-scripts/setup-botfather.sh
✅ dev-scripts/verify-setup.sh
✅ dev-scripts/README.md
✅ dev-scripts/FIRST_RUN.md
✅ dev-scripts/CHECKLIST.md (этот файл)
✅ backend/.env.development.example
✅ bot/.env.development.example
✅ webapp/.env.development.example
✅ logs/.gitkeep
✅ NGROK_SETUP.md
✅ README.md (обновлён с секцией ngrok)
✅ package.json (обновлён с новыми scripts)
```

## Documentation

- [NGROK_SETUP.md](../NGROK_SETUP.md) - Полная документация
- [FIRST_RUN.md](./FIRST_RUN.md) - Пошаговая инструкция первого запуска
- [README.md](./README.md) - Документация dev-scripts
- [README.md](../README.md) - Главная документация проекта

---

**Готово!** 🎉

Если все чеки отмечены, можно приступать к разработке.
