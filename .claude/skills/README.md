# Agent SKILLS for Status Stock 4.0

**14 профессиональных SKILLS** для быстрой разработки, дебаггинга, тестирования, дизайна и deployment.

## ✅ ВСЕ SKILLS ОБНОВЛЕНЫ (November 4, 2025)

Все skills были **полностью переписаны** под реальную структуру проекта:

- ✅ Используют реальные пути (`/Users/sile/Documents/Status Stock 4.0`)
- ✅ Используют существующие скрипты (`./start.sh`, `./stop.sh`)
- ✅ Корректные пути к логам (`backend/logs/error-YYYY-MM-DD.log`, `bot/logs/error.log`)
- ✅ Правильные npm команды (`npm run test:coverage`)
- ✅ Поддержка ngrok (критично для проекта!)
- ✅ YAML frontmatter во всех skills

---

## 🚀 Быстрый старт

Просто скажи Claude фразу из "Usage" любого skill:

```
"quick start"           → Запустит всё (Backend + Bot + ngrok)
"health check"          → Проверит здоровье системы
"analyze logs"          → Найдет и покажет ошибки
"check ui"              → Валидирует дизайн
"run tests"             → Запустит все тесты
```

Claude автоматически выполнит все необходимые команды.

---

## 📁 Категории SKILLS (14 штук)

### ⚡ Development & Startup (3)

**1. quick-start** - Моментальный запуск всего stack

- ✅ Останавливает существующие процессы
- ✅ Запускает ngrok tunnel
- ✅ Обновляет .env файлы с ngrok URL
- ✅ Билдит webapp
- ✅ Стартует Backend + Bot
- Usage: `"quick start"` or `"start project"`

**2. restart-all** - Безопасный перезапуск

- ✅ Использует `./stop.sh`
- ✅ Проверяет что все процессы остановлены
- ✅ Использует `./start.sh` для нового старта
- ✅ Новый ngrok tunnel каждый раз
- Usage: `"restart all"` or `"restart services"`

**3. health-check** - Комплексная проверка здоровья

- ✅ Backend API health endpoint
- ✅ Bot process status
- ✅ **ngrok tunnel status** (критично!)
- ✅ PostgreSQL connection
- ✅ Recent error logs analysis
- Usage: `"health check"` or `"status"`

---

### 🐛 Debug & Monitoring (3)

**4. analyze-logs** - Умный анализ error логов

- ✅ Backend: `backend/logs/error-YYYY-MM-DD.log`
- ✅ Bot: `bot/logs/error.log`
- ✅ ngrok: `logs/ngrok.log`
- ✅ Категоризация ошибок
- ✅ Top 5 most frequent errors
- Usage: `"analyze logs"` or `"what's wrong"`

**5. fix-errors** - Автоматическое исправление ошибок

- ✅ Port conflicts (EADDRINUSE)
- ✅ Database connection (ECONNREFUSED)
- ✅ Missing dependencies
- ✅ **ngrok tunnel expired** (критично!)
- ✅ Import/Export errors
- Usage: `"fix errors"` or `"auto fix"`

**6. check-ports** - Управление портами

- ✅ 3000 (Backend)
- ✅ 5173 (WebApp dev)
- ✅ 5432 (PostgreSQL)
- ✅ **4040 (ngrok dashboard)**
- Usage: `"check ports"` or `"port status"`

---

### 🧪 Testing (2)

**7. run-tests** - Запуск всех тестов

- ✅ Backend tests + coverage (`npm run test:coverage`)
- ✅ Bot tests + coverage (`npm run test:coverage`)
- ✅ Coverage summary report
- Usage: `"run tests"` or `"test all"`

**8. test-integration** - Integration тесты бота

- ✅ Проверяет Backend running
- ✅ Автостарт Backend если нужно
- ✅ Full user flow testing
- ✅ Test cleanup
- Usage: `"test bot"` or `"integration tests"`

---

### 🎨 Design & UI/UX (2)

**9. ui-check** - Валидация UI дизайна

- ✅ Glassmorphism effects (glass-card, glass-elevated)
- ✅ Color palette (#FF6B00 orange, #181818 dark)
- ✅ Touch-friendly buttons (min 44px)
- ✅ Typography consistency
- Usage: `"check ui"` or `"validate design"`

**10. animation-check** - Проверка анимаций

- ✅ Framer Motion usage
- ✅ Performance anti-patterns detection
- ✅ GPU-accelerated properties check
- ✅ Spring animations
- Usage: `"check animations"` or `"animation review"`

---

### 🗄️ Database (2)

**11. db-migrate** - Безопасные миграции

- ✅ Auto backup before migration
- ✅ Run migrations (`npm run db:migrate`)
- ✅ Verify schema
- ✅ Rollback on errors
- Usage: `"migrate db"` or `"run migrations"`

**12. db-query** - Быстрые SQL запросы

- ✅ Common queries (users, shops, orders)
- ✅ Table schemas
- ✅ Export to CSV/JSON
- ✅ Database statistics
- Usage: `"query db"` or `"check users table"`

---

### 🌐 ngrok Management (1) - НОВЫЙ!

**13. ngrok-management** - Управление ngrok tunnel

- ✅ Check ngrok status and URL
- ✅ Restart expired tunnels
- ✅ Update all .env files
- ✅ Rebuild webapp with new URL
- ✅ Verify tunnel working
- Usage: `"check ngrok"` or `"restart ngrok"`

**КРИТИЧНО:** Этот проект **ТРЕБУЕТ ngrok** для Telegram Mini App. Without it, Mini App button won't work!

---

### 🚀 Deployment (1) - НОВЫЙ!

**14. production-deploy** - Pre-deployment checklist

- ✅ Run all tests
- ✅ Check UI/UX compliance
- ✅ Validate animations
- ✅ Analyze error logs
- ✅ Verify build succeeds
- ✅ Security check (hardcoded secrets)
- ✅ Generate deployment report
- Usage: `"production check"` or `"deploy check"`

---

## 🎯 Типичные рабочие сценарии

### Утренний старт:

```
1. "quick start"           # Запустить всё
2. "health check"          # Проверить что работает
```

### Когда что-то сломалось:

```
1. "analyze logs"          # Найти ошибки
2. "fix errors"            # Автофикс
3. "restart all"           # Перезапустить
4. "health check"          # Проверить что починилось
```

### Перед коммитом:

```
1. "run tests"             # Все тесты
2. "check ui"              # Дизайн
3. "check animations"      # Анимации
4. git add . && git commit
```

### Перед deployment:

```
1. "production check"      # Comprehensive checklist
2. Fix any ❌ failures
3. Deploy to production
```

### После system sleep/wake:

```
1. "check ngrok"           # ngrok tunnel expires!
2. If expired: "restart ngrok"
3. "health check"          # Verify all OK
```

---

## 💡 Pro Tips

### Комбинирование SKILLS:

**Morning workflow:**

```
"quick start" → "health check" → "analyze logs"
```

**Before commit:**

```
"run tests" → "check ui" → "check animations"
```

**Emergency fix:**

```
"analyze logs" → "fix errors" → "health check"
```

**Weekly check:**

```
"health check" → "analyze logs" → "production check"
```

### Когда использовать какой skill:

| Ситуация             | Skill                       |
| -------------------- | --------------------------- |
| Первый запуск дня    | quick-start                 |
| После git pull       | restart-all                 |
| Что-то сломалось     | analyze-logs → fix-errors   |
| Mini App не работает | check-ngrok → restart-ngrok |
| Перед коммитом       | run-tests → ui-check        |
| Перед deploy         | production-deploy           |
| Система зависла      | restart-all                 |

---

## 📊 Статистика

**Всего:** 14 SKILLS  
**Категорий:** 7 (Development, Debug, Testing, Design, Database, ngrok, Deployment)

**Охват:**

- ⚡ Development: 100%
- 🐛 Debugging: 100%
- 🧪 Testing: Backend + Bot
- 🎨 Design: UI + Animations
- 🗄️ Database: Migrations + Queries
- 🌐 ngrok: Tunnel management
- 🚀 Deployment: Pre-flight checklist

---

## 🔧 Кастомизация

Вы можете редактировать любой skill файл для:

- Изменения путей (если проект переместился)
- Добавления новых команд
- Настройки thresholds
- Добавления своих проверок

**Формат skill файла:**

````markdown
---
name: skill-name
description: What it does + when to use
---

# Skill Title

## What this skill does:

[List of what it does]

## Usage:

Say: **"trigger phrase"**

## Commands:

```bash
# Actual bash commands
```
````

[Rest of documentation]

```

---

## 🚧 Roadmap (Следующие недели)

### Priority 1 (На этой неделе):
- [ ] `crypto-wallet-validator` - Валидация BTC/ETH/TRON addresses
- [ ] `telegram-bot-automation` - Автоматизация bot handlers/scenes
- [ ] `payment-processor` - End-to-end payment flow testing

### Priority 2 (На следующей неделе):
- [ ] `webhook-delivery-testing` - Webhook idempotency checks
- [ ] `monitoring-alerting` - Real-time error monitoring
- [ ] `backup-recovery-automation` - Automated daily backups

### Future:
- [ ] Hooks integration (auto-lint, auto-format)
- [ ] Skill chaining (auto-compose complex workflows)
- [ ] E-Commerce Operations Agent (master skill)

---

## 📖 Дополнительные ресурсы

- **Исследование best practices:** `.claude/SKILLS_RESEARCH.md` (13,000+ words)
- **Официальная документация:** [docs.claude.com/claude-code/skills](https://docs.claude.com/en/docs/claude-code/skills)
- **Project structure:** `README.md` (корень проекта)
- **Database schema:** `backend/database/schema.sql`
- **Development cheatsheet:** `DEV_CHEATSHEET.md`

---

## ✨ Что изменилось в November 4, 2025

### Полная переработка всех skills:

**Было (до исправления):**
- ❌ Неправильные пути (использовали `$PROJECT_DIR` без значения)
- ❌ Не использовали существующие скрипты (`start.sh`, `stop.sh`)
- ❌ Игнорировали ngrok (критично для проекта!)
- ❌ Неправильные npm команды
- ❌ Нет YAML frontmatter

**Стало (после исправления):**
- ✅ Реальные абсолютные пути
- ✅ Используют профессиональные скрипты
- ✅ ngrok management встроен во все dev skills
- ✅ Правильные npm команды из package.json
- ✅ YAML frontmatter везде
- ✅ 2 новых skills (ngrok-management, production-deploy)

**Результат:** Все skills **реально работают** на твоём проекте!

---

**Created:** 2025-10-31
**Updated:** 2025-11-04
**Version:** 2.0 (Complete Rewrite)
**Project:** Status Stock 4.0 - Telegram E-Commerce Platform
```
