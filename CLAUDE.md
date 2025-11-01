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

#### 🔧 Инструкции для субагентов по MCP File System

**При делегировании задачи субагенту через Task tool, ВСЕГДА добавляй:**

```javascript
Task({
  subagent_type: "...",
  prompt: `
    КРИТИЧНО: Используй MCP File System для всех файловых операций!
    НЕ используй Read(), Edit(), Grep(), Glob(), Bash() для работы с файлами.
    
    [твоя задача здесь...]
  `
})
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

### 3. Субагенты - проактивно использовать

**Когда использовать Task tool:**

| Субагент | Когда использовать |
|----------|-------------------|
| `telegram-bot-expert` | Работа с Telegraf.js: handlers, scenes, keyboards, sessions |
| `backend-architect` | API design, endpoint создание, идемпотентность, архитектура |
| `database-designer` | PostgreSQL: schema, миграции, индексы, SQL запросы |
| `frontend-developer` | React компоненты, TailwindCSS, Telegram Mini App UI/UX |
| `debug-master` | Debugging, ошибки, тесты, исправления багов |
| `crypto-integration-specialist` | Blockchain API, payment verification, wallet validation |
| `design-researcher` | UI/UX research, design trends, visual inspiration |

**Примеры делегирования:**

```javascript
// Разработка бота
Task({
  subagent_type: "telegram-bot-expert",
  description: "Add new button handler",
  prompt: "Add callback handler for 'delete_product' button in seller menu"
})

// Работа с БД
Task({
  subagent_type: "database-designer",
  description: "Create migration",
  prompt: "Add index on products.shop_id for faster lookups"
})

// Дебаг
Task({
  subagent_type: "debug-master",
  description: "Fix failing tests",
  prompt: "Fix 3 failing integration tests in bot/tests/integration/"
})
```

**Важно:** Субагенты тоже используют MCP File System.

### 4. Agent SKILLS - использовать проактивно

**SKILLS** - готовые сценарии для типовых задач. **Использовать вместо ручных команд!**

**Доступно 12 SKILLS в `.claude/skills/`:**

#### ⚡ Development (запуск/мониторинг)
- `quick-start` - моментальный запуск всех сервисов + проверки
- `health-check` - комплексная проверка Backend/Bot/WebApp/PostgreSQL
- `restart-all` - безопасный перезапуск всех сервисов

#### 🐛 Debug (поиск/исправление ошибок)
- `analyze-logs` - умный анализ error логов с категоризацией
- `fix-errors` - автофикс частых ошибок (порты, БД, зависимости)
- `check-ports` - управление портами 3000, 5173, 5432

#### 🧪 Testing (тестирование)
- `run-tests` - запуск всех тестов Backend + Bot с coverage
- `test-integration` - integration тесты бота

#### 🎨 Design (UI/UX качество)
- `ui-check` - валидация glassmorphism, цветов, spacing
- `animation-check` - проверка Framer Motion на performance

#### 🗄️ Database (работа с БД)
- `db-migrate` - безопасные миграции с автобэкапом
- `db-query` - быстрые SQL запросы + статистика

**Как использовать:**
```javascript
// ❌ НЕПРАВИЛЬНО - ручные команды
Bash("cd backend && npm start")
Bash("lsof -ti:3000")
Bash("tail -f backend/logs/error.log")

// ✅ ПРАВИЛЬНО - через SKILLS
Skill("quick-start")    // Запускает всё автоматически
Skill("health-check")   // Проверяет всё автоматически
Skill("analyze-logs")   // Анализирует логи автоматически
```

**Когда использовать SKILLS:**
- 🚀 **Перед началом работы:** `health-check` или `quick-start`
- 🐛 **При ошибках:** `analyze-logs` → `fix-errors`
- 🧪 **Перед коммитом:** `run-tests` → `ui-check` → `animation-check`
- 🗄️ **При работе с БД:** `db-migrate` или `db-query`
- 🔄 **После изменений:** `restart-all` → `health-check`

**Детали:** См. `.claude/skills/README.md` для полного описания каждого SKILL.

### 5. После запуска - проверка логов

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
- ❌ Если ошибки → остановить, исправить, перезапустить

---

## Safety Rules

- ❌ НЕ редактировать `.env` файлы
- ❌ НЕ ломать API контракты (backward compatible)
- ❌ НЕ создавать .md отчёты после задач
- ❌ НЕ использовать Bash для файловых операций
- ✅ Минимальные diffs (точные строки)
- ✅ MCP File System для всего
- ✅ Task tool для делегирования
- ✅ Проверка логов после запуска

---

## Полезные ссылки

- Детальная документация: `README.md` (корень проекта)
- Backend API: `backend/README.md`
- Bot guide: `bot/README.md`
- WebApp guide: `webapp/README.md`
- Database schema: `backend/database/schema.sql`
- **Agent SKILLS:** `.claude/skills/README.md` (12 готовых сценариев)
- Субагенты: `.claude/agents/*.md`
- Development cheatsheet: `DEV_CHEATSHEET.md`
