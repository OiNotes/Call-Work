---
description: Complete onboarding guide for new AI models to Status Stock project
model: claude-3-5-sonnet-20241022
allowed-tools: Read, Grep, Glob, Bash
disable-model-invocation: true
---

# 🚀 Welcome to Status Stock 4.0!

Добро пожаловать! Я проведу полный onboarding по проекту.

---

## 🎯 Project Overview

**Status Stock** - Telegram E-Commerce платформа для цифровых магазинов с криптовалютными платежами.

**Основная документация:**
- 📖 Общее описание: @README.md
- 🤖 Правила Claude Code: @CLAUDE.md
- ⚡ Development cheatsheet: @DEV_CHEATSHEET.md

---

## 🏗 Architecture (3 сервиса)

### 1. Backend - Express + PostgreSQL + WebSocket
- 📄 Документация: @backend/README.md
- 🗄️ Database schema: @backend/database/schema.sql
- 🚪 Entry point: @backend/src/index.js
- 🛣️ Routes: @backend/src/routes/
- 🎮 Controllers: @backend/src/controllers/
- ⚙️ Services: @backend/src/services/

**Технологии:**
- Express.js (REST API)
- PostgreSQL (без ORM, чистый SQL)
- JWT authentication
- WebSocket для real-time updates

---

### 2. Bot - Telegram Bot (Telegraf.js)
- 📄 Документация: @bot/README.md
- 🚪 Entry point: @bot/src/index.js
- 🎬 Scenes: @bot/src/scenes/
- 🎯 Handlers: @bot/src/handlers/
- ⌨️ Keyboards: @bot/src/keyboards/

**Технологии:**
- Telegraf.js framework
- Session-based state management
- Scene wizard для многошаговых диалогов
- Inline keyboards + reply keyboards

---

### 3. WebApp - React Telegram Mini App
- 📄 Документация: @webapp/README.md
- 🚪 Entry point: @webapp/src/App.jsx
- 🧩 Components: @webapp/src/components/
- 🎨 Pages: @webapp/src/pages/
- 📦 State: @webapp/src/store/ (Zustand in-memory)

**Технологии:**
- React 18 + Vite
- TailwindCSS (glassmorphism design)
- Framer Motion (animations)
- Telegram WebApp SDK
- Zustand (in-memory state, no persistence)

---

## 🤖 Available Subagents (7 специалистов)

Используй **Task tool** для делегирования задач:

| Субагент | Когда использовать |
|----------|-------------------|
| **telegram-bot-expert** | Работа с Telegraf.js: handlers, scenes, keyboards, sessions, webhooks |
| **backend-architect** | API design, Express endpoints, архитектура, идемпотентность |
| **database-designer** | PostgreSQL: schema, миграции, индексы, SQL запросы, constraints |
| **frontend-developer** | React компоненты, TailwindCSS, Telegram Mini App UI/UX, animations |
| **debug-master** | Debugging, поиск багов, исправление ошибок, тесты |
| **crypto-integration-specialist** | Blockchain APIs, payment verification, wallet validation |
| **design-researcher** | UI/UX research, design trends, glassmorphism, visual inspiration |

**Примеры делегирования:**

```javascript
// Работа с ботом
Task({
  subagent_type: "telegram-bot-expert",
  description: "Add button handler",
  prompt: "Add callback handler for 'delete_product' button"
})

// Работа с БД
Task({
  subagent_type: "database-designer",
  description: "Create migration",
  prompt: "Add index on products.shop_id for faster lookups"
})

// Debug
Task({
  subagent_type: "debug-master",
  description: "Fix failing tests",
  prompt: "Fix 3 failing integration tests in bot/tests/"
})
```

**Детали:** См. `.claude/agents/*.md` для полного описания каждого субагента.

---

## ⚡ Available SKILLS (12 готовых сценариев)

**Используй SKILLS вместо ручных команд!** Просто называй их в чате.

### 🚀 Development (запуск/мониторинг)
- **`quick-start`** - Моментальный запуск всех сервисов + проверки
- **`health-check`** - Комплексная проверка Backend/Bot/WebApp/PostgreSQL
- **`restart-all`** - Безопасный перезапуск всех сервисов

### 🐛 Debug (поиск/исправление ошибок)
- **`analyze-logs`** - Умный анализ error логов с категоризацией
- **`fix-errors`** - Автофикс частых ошибок (порты, БД, зависимости)
- **`check-ports`** - Управление портами 3000, 5173, 5432

### 🧪 Testing (тестирование)
- **`run-tests`** - Запуск всех тестов Backend + Bot с coverage
- **`test-integration`** - Integration тесты бота

### 🎨 Design (UI/UX качество)
- **`ui-check`** - Валидация glassmorphism, цветов, spacing
- **`animation-check`** - Проверка Framer Motion на performance

### 🗄️ Database (работа с БД)
- **`db-migrate`** - Безопасные миграции с автобэкапом
- **`db-query`** - Быстрые SQL запросы + статистика

**Как использовать:**
```
❌ НЕПРАВИЛЬНО:
Bash("cd backend && npm start")
Bash("lsof -ti:3000")

✅ ПРАВИЛЬНО:
"quick start"        # Запускает всё
"health check"       # Проверяет всё
"analyze logs"       # Анализирует логи
```

**Детали:** См. `.claude/skills/README.md` для полного описания всех SKILLS.

---

## 📚 Key Rules из CLAUDE.md (КРИТИЧНО!)

### 1. Роль: Orchestrator (Оркестратор)
**НЕ делай сам → делегируй субагентам!**

**Правильный процесс:**
1. **Plan Mode** - анализ через MCP FS
2. **ExitPlanMode** - показать план
3. **Wait Approval** - дождаться подтверждения
4. **Delegate** - Task tool → субагенты
5. **Verify** - проверка логов + тесты
6. **Report** - устно в чат (НЕ .md файлы!)

### 2. MCP File System обязателен
**ВСЕГДА используй MCP FS для файловых операций:**

```javascript
✅ ПРАВИЛЬНО:
Read(file_path: "/path/to/file")
Grep(pattern: "search", path: "/path")
Glob(pattern: "**/*.js")
Edit(file_path, old_string, new_string)
Write(file_path, content)

❌ НЕПРАВИЛЬНО:
Bash("cat /path/to/file")
Bash("grep 'search' /path")
Bash("find . -name '*.js'")
```

**Bash разрешён ТОЛЬКО для:**
- `npm run dev`, `npm test`, `npm start`
- `psql -c "SELECT ..."` (read-only SQL)
- Проверка логов (`tail -f`, `docker logs`)

### 3. Используй SKILLS проактивно
**Вместо ручных команд → SKILLS!**

```
Перед работой → "health check" или "quick start"
При ошибках → "analyze logs" → "fix errors"
Перед коммитом → "run tests" → "ui check"
После изменений → "restart all" → "health check"
```

### 4. После запуска → проверяй логи
**ВСЕГДА после запуска сервиса:**
```bash
tail -f backend/logs/combined.log  # Backend
tail -f bot/logs/bot.log           # Bot
npm run dev                         # Смотреть вывод
```

**Критерии здоровья:**
- ✅ Нет `[error]` после старта
- ✅ "Server started" / "Bot started"
- ✅ "Database: Connected ✓"
- ❌ Если ошибки → остановить, исправить, перезапустить

### 5. Safety Rules (КРИТИЧНО!)
- ❌ НЕ редактировать `.env` файлы
- ❌ НЕ ломать API контракты (backward compatible)
- ❌ НЕ создавать .md отчёты после задач
- ❌ НЕ использовать Bash для файловых операций
- ✅ Минимальные diffs (точные строки)
- ✅ MCP File System для всего
- ✅ Task tool для делегирования
- ✅ Plan Mode перед большими задачами

---

## 📊 Current Project State

**Git branch:** !`git branch --show-current`

**Recent commits:**
!`git log --oneline -5`

**Modified files:**
!`git status --short`

**Running services:**
!`lsof -ti:3000,5173,5432 2>/dev/null | wc -l` active ports

---

## 🚀 Quick Start

**Запустить всё:**
```bash
npm start
```

**Или через SKILL:**
```
"quick start"
```

**Проверить здоровье:**
```
"health check"
```

---

## 📖 Полезные ссылки

### Документация проекта
- Main README: @README.md
- Backend: @backend/README.md
- Bot: @bot/README.md
- WebApp: @webapp/README.md

### Database
- Schema: @backend/database/schema.sql
- Migrations: @backend/database/migrations/

### Claude Code конфиг
- Правила: @CLAUDE.md
- Субагенты: `.claude/agents/*.md`
- SKILLS: `.claude/skills/*.md`
- Development guide: @DEV_CHEATSHEET.md

---

## ✅ Onboarding Complete!

**Теперь ты готов работать с Status Stock 4.0!**

**Помни:**
1. 🎯 **Роль:** Orchestrator (делегируй субагентам)
2. 📂 **Файлы:** MCP File System (Read/Grep/Glob/Edit/Write)
3. ⚡ **Типовые задачи:** SKILLS (quick-start, health-check, etc.)
4. 🤖 **Сложные задачи:** Субагенты (Task tool)
5. 🚫 **NO:** Bash для файлов, .md отчёты, редактирование .env
6. ✅ **YES:** Plan Mode, проверка логов, минимальные diffs

**Вопросы? Спрашивай!** 🚀
