# CLAUDE.md

> Инструкции для Claude Code при работе с проектом

## Проект

**Status Stock** - Telegram E-Commerce платформа для цифровых магазинов с криптовалютными платежами.

**Структура:**

- `backend/` - Express API + PostgreSQL + WebSocket
- `bot/` - Telegram Bot (Telegraf.js)
- `webapp/` - React Mini App (TailwindCSS + Framer Motion)

**Технологии:**

- Backend: Express, PostgreSQL (без ORM), JWT, WebSocket
- Bot: Telegraf.js, session-based state
- Frontend: React 18, Vite, Zustand (in-memory only), Telegram WebApp SDK
- Payments: Blockchain APIs (Etherscan, BlockCypher, TronGrid)

---

## Правила работы Claude Code

### 1. Роль Оркестратора

**Claude Code работает как оркестратор** - делегирует задачи субагентам вместо самостоятельного выполнения.

**Рабочий процесс:**

1. **Plan Mode** - анализ через MCP File System → план → ExitPlanMode
2. **Approval** - ждать подтверждения плана от пользователя
3. **Delegate** - использовать Task tool для запуска субагентов
4. **Verify** - проверка логов сервисов + тесты
5. **Report** - краткий отчёт в чат (НЕ создавать .md файлы)

**КРИТИЧНО:** НЕ создавать отчёты-документы после каждой задачи. Только устное резюме в чат.

### 2. MCP File System обязателен

Использовать MCP FS для **всех** файловых операций:

```javascript
// ✅ ПРАВИЛЬНО
Read(file_path: "/path/to/file")
Grep(pattern: "search", path: "/path")
Glob(pattern: "**/*.js")
Edit(file_path, old_string, new_string)
Write(file_path, content)

// ❌ НЕПРАВИЛЬНО
Bash("cat /path/to/file")
Bash("grep 'search' /path")
Bash("find . -name '*.js'")
```

**Bash разрешён только для:**

- `npm run dev`, `npm test` - запуск проекта/тестов
- `psql -c "SELECT ..."` - read-only SQL запросы
- Проверка логов (`tail -f`, `docker-compose logs`)
- **Запуск скриптов:** `./start.sh`, `./stop.sh`

#### 🔧 Инструкции для субагентов по MCP File System

**При делегировании задачи субагенту через Task tool, ВСЕГДА добавляй:**

```javascript
Task({
  subagent_type: '...',
  prompt: `
    КРИТИЧНО: Используй MCP File System для всех файловых операций!
    НЕ используй Read(), Edit(), Grep(), Glob(), Bash() для работы с файлами.
    
    [твоя задача здесь...]
  `,
});
```

**Почему это важно:**

- `Read()`, `Edit()`, `Grep()`, `Glob()` - обычные tools (НЕ MCP!)
- Субагенты должны использовать `mcp__filesystem__*` инструменты
- Без явного запрета субагент может использовать не-MCP tools

**Субагент сам разберётся какие MCP инструменты использовать:**

- `mcp__filesystem__read_text_file` - чтение
- `mcp__filesystem__edit_file` - редактирование
- `mcp__filesystem__search_files` - поиск
- `mcp__filesystem__list_directory` - список файлов

**Не нужно указывать конкретные названия** - достаточно сказать "используй MCP File System" и запретить обычные tools.

---

## 3. Agent SKILLS - ПРИОРИТЕТ #1 для разработки

**SKILLS = готовые автоматизированные рабочие процессы.** Используй их ВМЕСТО ручных команд!

### 📍 Расположение и активация

**Где:** `.claude/skills/` (14 skills)  
**Как активировать:** Просто скажи триггерную фразу, Claude автоматически выполнит skill

**Документация:** `.claude/skills/README.md` - полное описание всех skills

### 🎯 Когда использовать Skills (ОБЯЗАТЕЛЬНО!)

| Ситуация           | НЕ делай так ❌                   | Делай так ✅         |
| ------------------ | --------------------------------- | -------------------- |
| Запуск проекта     | `cd backend && npm run dev`       | `"quick start"`      |
| Проверка здоровья  | `curl localhost:3000/health`      | `"health check"`     |
| Анализ ошибок      | `tail -f backend/logs/error.log`  | `"analyze logs"`     |
| Исправление ошибок | Ручной дебаг                      | `"fix errors"`       |
| Перезапуск         | `pkill node && npm run dev`       | `"restart all"`      |
| Проверка портов    | `lsof -ti:3000`                   | `"check ports"`      |
| Запуск тестов      | `npm test`                        | `"run tests"`        |
| Проверка UI        | Ручной просмотр файлов            | `"check ui"`         |
| Миграции БД        | `npm run db:migrate`              | `"migrate db"`       |
| SQL запросы        | `psql telegram_shop -c "..."`     | `"query db"`         |
| Проверка ngrok     | `curl localhost:4040/api/tunnels` | `"check ngrok"`      |
| Pre-deployment     | Ручной чеклист                    | `"production check"` |

### 📚 Полный список Skills (14 штук)

#### ⚡ Development & Startup (3)

**quick-start** - Запуск всего stack  
Триггеры: `"quick start"`, `"start project"`, `"start everything"`  
Что делает:

- Останавливает существующие процессы
- Запускает ngrok tunnel
- Обновляет .env файлы с ngrok URL
- Билдит webapp
- Стартует Backend + Bot

**restart-all** - Перезапуск всех сервисов  
Триггеры: `"restart all"`, `"restart services"`, `"reboot"`  
Что делает:

- `./stop.sh` для остановки всего
- Проверка что порты освободились
- `./start.sh` для нового старта
- Новый ngrok tunnel

**health-check** - Проверка здоровья системы  
Триггеры: `"health check"`, `"status"`, `"are we healthy"`  
Что делает:

- Backend API health endpoint
- Bot process status
- **ngrok tunnel status** (критично!)
- PostgreSQL connection
- Recent error logs analysis

#### 🐛 Debug & Monitoring (3)

**analyze-logs** - Анализ error логов  
Триггеры: `"analyze logs"`, `"check errors"`, `"what's wrong"`  
Что делает:

- Backend: `backend/logs/error-YYYY-MM-DD.log`
- Bot: `bot/logs/error.log`
- ngrok: `logs/ngrok.log`
- Категоризация + Top 5 ошибок

**fix-errors** - Автоматическое исправление  
Триггеры: `"fix errors"`, `"auto fix"`, `"repair"`  
Исправляет:

- Port conflicts (EADDRINUSE)
- Database connection (ECONNREFUSED)
- Missing dependencies
- **ngrok tunnel expired**
- Import/Export errors

**check-ports** - Управление портами  
Триггеры: `"check ports"`, `"port status"`, `"what's using my ports"`  
Проверяет: 3000 (Backend), 5173 (WebApp), 5432 (PostgreSQL), 4040 (ngrok)

#### 🧪 Testing (2)

**run-tests** - Запуск всех тестов  
Триггеры: `"run tests"`, `"test all"`, `"check coverage"`  
Что делает:

- Backend: `npm run test:coverage`
- Bot: `npm run test:coverage`
- Coverage summary report

**test-integration** - Integration тесты бота  
Триггеры: `"test bot"`, `"integration tests"`, `"test telegram"`  
Что делает:

- Проверяет Backend running
- Автостарт Backend если нужно
- Full user flow testing

#### 🎨 Design & UI/UX (2)

**ui-check** - Валидация UI дизайна  
Триггеры: `"check ui"`, `"validate design"`, `"design review"`  
Проверяет:

- Glassmorphism (glass-card, glass-elevated)
- Colors (#FF6B00, #181818)
- Touch-friendly buttons (44px)
- Typography

**animation-check** - Проверка анимаций  
Триггеры: `"check animations"`, `"animation review"`, `"performance check"`  
Проверяет:

- Framer Motion usage
- Performance anti-patterns
- GPU-accelerated properties
- Spring animations

#### 🗄️ Database (2)

**db-migrate** - Безопасные миграции  
Триггеры: `"migrate db"`, `"run migrations"`, `"update database"`  
Что делает:

- Auto backup before migration
- Run migrations
- Verify schema
- Rollback on errors

**db-query** - SQL запросы  
Триггеры: `"query db"`, `"check users table"`, `"database stats"`  
Что делает:

- Common queries (users, shops, orders)
- Table schemas
- Export to CSV/JSON
- Database statistics

#### 🌐 ngrok Management (1) - КРИТИЧНО ДЛЯ ПРОЕКТА!

**ngrok-management** - Управление ngrok tunnel  
Триггеры: `"check ngrok"`, `"restart ngrok"`, `"ngrok status"`  
Что делает:

- Check ngrok status and URL
- Restart expired tunnels
- Update all .env files
- Rebuild webapp with new URL

**ВАЖНО:** Этот проект ТРЕБУЕТ ngrok для Telegram Mini App!

#### 🚀 Deployment (1)

**production-deploy** - Pre-deployment checklist  
Триггеры: `"production check"`, `"deploy check"`, `"ready for prod"`  
Проверяет:

- All tests pass
- UI/UX compliance
- Animation performance
- Error logs clean
- Build succeeds
- No hardcoded secrets

### 🔄 Типичные рабочие сценарии

**Утренний старт:**

```
1. "quick start"           # Запустить всё
2. "health check"          # Проверить что работает
```

**Когда что-то сломалось:**

```
1. "analyze logs"          # Найти ошибки
2. "fix errors"            # Автофикс
3. "restart all"           # Перезапустить
4. "health check"          # Проверить что починилось
```

**Перед коммитом:**

```
1. "run tests"             # Все тесты
2. "check ui"              # Дизайн
3. "check animations"      # Анимации
```

**После system sleep/wake:**

```
1. "check ngrok"           # ngrok tunnel expires!
2. If expired: "restart ngrok"
3. "health check"
```

**Перед deployment:**

```
1. "production check"      # Comprehensive checklist
2. Fix any ❌ failures
3. Deploy
```

### ⚠️ КРИТИЧНЫЕ правила для Skills

1. **ВСЕГДА используй Skills вместо ручных команд** - они протестированы и знают все edge cases
2. **ngrok критичен** - проверяй `"check ngrok"` после каждого wake from sleep
3. **Skills auto-activate** - просто скажи триггерную фразу, Claude сам найдёт нужный skill
4. **Полная документация** - `.claude/skills/README.md` содержит детали каждого skill

---

## 4. Субагенты - проактивно использовать

**Когда использовать Task tool:**

| Субагент                        | Когда использовать                                          |
| ------------------------------- | ----------------------------------------------------------- |
| `telegram-bot-expert`           | Работа с Telegraf.js: handlers, scenes, keyboards, sessions |
| `backend-architect`             | API design, endpoint создание, идемпотентность, архитектура |
| `database-designer`             | PostgreSQL: schema, миграции, индексы, SQL запросы          |
| `frontend-developer`            | React компоненты, TailwindCSS, Telegram Mini App UI/UX      |
| `debug-master`                  | Debugging, ошибки, тесты, исправления багов                 |
| `crypto-integration-specialist` | Blockchain API, payment verification, wallet validation     |
| `design-researcher`             | UI/UX research, design trends, visual inspiration           |
| `internel`                      | Web search, API docs, library comparison, error solutions   |

**Примеры делегирования:**

```javascript
// Разработка бота
Task({
  subagent_type: 'telegram-bot-expert',
  description: 'Add new button handler',
  prompt: "Add callback handler for 'delete_product' button in seller menu",
});

// Работа с БД
Task({
  subagent_type: 'database-designer',
  description: 'Create migration',
  prompt: 'Add index on products.shop_id for faster lookups',
});

// Дебаг
Task({
  subagent_type: 'debug-master',
  description: 'Fix failing tests',
  prompt: 'Fix 3 failing integration tests in bot/tests/integration/',
});

// Поиск информации в интернете
Task({
  subagent_type: 'internel',
  description: 'Find solution for error',
  prompt: "Find how to fix 'Telegram WebApp SDK initialization timeout' error",
});
```

**Важно:** Субагенты тоже используют MCP File System.

---

## 5. После запуска - проверка логов

**ВСЕГДА** после запуска любого сервиса проверять логи:

```bash
# Backend
tail -f backend/logs/combined.log

# Bot
tail -f bot/logs/bot.log

# Или через терминал
npm run dev  # Смотреть вывод
```

**Критерии здоровья:**

- ✅ Нет `[error]` после старта
- ✅ "Server started" / "Bot started"
- ✅ "Database: Connected ✓"
- ✅ "ngrok tunnel active" (если используется)
- ❌ Если ошибки → остановить, исправить, перезапустить

---

## Safety Rules

- ❌ НЕ редактировать `.env` файлы вручную (только через ./start.sh)
- ❌ НЕ ломать API контракты (backward compatible)
- ❌ НЕ создавать .md отчёты после задач
- ❌ НЕ использовать Bash для файловых операций (MCP FS!)
- ❌ НЕ игнорировать Skills - используй их активно!
- ✅ Минимальные diffs (точные строки)
- ✅ MCP File System для всего
- ✅ Task tool для делегирования
- ✅ **Skills для типовых задач**
- ✅ Проверка логов после запуска

---

## Полезные ссылки

- Детальная документация: `README.md` (корень проекта)
- Backend API: `backend/README.md`
- Bot guide: `bot/README.md`
- WebApp guide: `webapp/README.md`
- Database schema: `backend/database/schema.sql`
- **Agent SKILLS:** `.claude/skills/README.md` (14 skills с полным описанием)
- **Skills Research:** `.claude/SKILLS_RESEARCH.md` (best practices от community)
- Субагенты: `.claude/agents/*.md`
- Development cheatsheet: `DEV_CHEATSHEET.md`

---

## Критичные особенности проекта

### ngrok - обязателен!

Этот проект использует **Telegram Mini App**, который требует HTTPS. ngrok предоставляет:

- HTTPS tunnel к localhost:3000
- Public URL для Telegram
- WebApp serving

**Без ngrok:** Mini App button не работает!

**Skills для ngrok:**

- `"check ngrok"` - проверка статуса
- `"restart ngrok"` - перезапуск tunnel (каждые 2 часа на free tier)
- `"quick start"` - автоматически запускает ngrok

### Структура логов

**Backend:**

- `backend/logs/error-YYYY-MM-DD.log` - ошибки (daily rotation)
- `backend/logs/combined-YYYY-MM-DD.log` - все логи

**Bot:**

- `bot/logs/error.log` - ошибки (single file, может расти большим!)
- `bot/logs/combined.log` - все логи

**ngrok:**

- `logs/ngrok.log` - ngrok tunnel logs
- `logs/backend.log` - backend startup logs
- `logs/bot.log` - bot startup logs

### npm команды

**Backend:**

```bash
npm run dev              # nodemon (для разработки)
npm start                # production start
npm test                 # tests
npm run test:coverage    # tests + coverage
npm run lint:check       # ESLint check
```

**Bot:**

```bash
npm start                # production start
npm run dev              # nodemon
npm test                 # all tests
npm run test:coverage    # tests + coverage
npm run test:unit        # unit tests only
npm run test:integration # integration tests only
```

**WebApp:**

```bash
npm run dev              # Vite dev server
npm run build            # production build
```

**Root:**

```bash
npm run dev              # Backend + WebApp
npm run dev:all          # Backend + WebApp + Bot
npm run install:all      # Install deps for all
./start.sh               # Production start with ngrok
./stop.sh                # Stop all services
```

---

**Updated:** 2025-11-04  
**Version:** 3.0 (Added Skills documentation)  
**Skills Version:** 2.0 (14 skills, fully tested)
