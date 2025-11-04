# Skills Quick Reference

> Шпаргалка по всем 14 skills для Status Stock 4.0

## 🚀 Быстрый старт

Просто скажи триггерную фразу → Claude автоматически выполнит skill

```
"quick start"       → Запустить всё (Backend + Bot + ngrok)
"health check"      → Проверить здоровье системы
"analyze logs"      → Найти ошибки в логах
"fix errors"        → Автоматически исправить проблемы
"run tests"         → Запустить все тесты
```

---

## 📋 Все Skills (14 штук)

### ⚡ Development & Startup

| Skill | Триггеры | Что делает |
|-------|----------|------------|
| **quick-start** | `"quick start"`, `"start project"` | Запускает Backend + Bot + ngrok, обновляет .env |
| **restart-all** | `"restart all"`, `"reboot"` | ./stop.sh → ./start.sh → новый ngrok |
| **health-check** | `"health check"`, `"status"` | Проверяет Backend, Bot, ngrok, PostgreSQL, логи |

### 🐛 Debug & Monitoring

| Skill | Триггеры | Что делает |
|-------|----------|------------|
| **analyze-logs** | `"analyze logs"`, `"what's wrong"` | Анализирует backend/bot/ngrok логи, Top 5 ошибок |
| **fix-errors** | `"fix errors"`, `"auto fix"` | Исправляет порты, БД, dependencies, ngrok |
| **check-ports** | `"check ports"`, `"port status"` | Проверяет 3000, 5173, 5432, 4040 |

### 🧪 Testing

| Skill | Триггеры | Что делает |
|-------|----------|------------|
| **run-tests** | `"run tests"`, `"test all"` | Backend + Bot тесты с coverage |
| **test-integration** | `"test bot"`, `"integration tests"` | Bot integration тесты, автостарт Backend |

### 🎨 Design & UI/UX

| Skill | Триггеры | Что делает |
|-------|----------|------------|
| **ui-check** | `"check ui"`, `"validate design"` | Glassmorphism, цвета, кнопки 44px, typography |
| **animation-check** | `"check animations"`, `"performance check"` | Framer Motion, GPU acceleration, anti-patterns |

### 🗄️ Database

| Skill | Триггеры | Что делает |
|-------|----------|------------|
| **db-migrate** | `"migrate db"`, `"run migrations"` | Backup → migrations → verify → rollback on error |
| **db-query** | `"query db"`, `"database stats"` | SQL queries, table schemas, export CSV/JSON |

### 🌐 ngrok (КРИТИЧНО!)

| Skill | Триггеры | Что делает |
|-------|----------|------------|
| **ngrok-management** | `"check ngrok"`, `"restart ngrok"` | Проверка/restart tunnel, обновляет .env, билдит webapp |

### 🚀 Deployment

| Skill | Триггеры | Что делает |
|-------|----------|------------|
| **production-deploy** | `"production check"`, `"deploy check"` | Tests, UI, animations, logs, build, secrets check |

---

## 🔄 Типичные сценарии

### Утренний старт
```
"quick start" → "health check"
```

### Что-то сломалось
```
"analyze logs" → "fix errors" → "restart all" → "health check"
```

### Перед коммитом
```
"run tests" → "check ui" → "check animations"
```

### После sleep/wake (ngrok expires!)
```
"check ngrok" → If expired: "restart ngrok"
```

### Перед deployment
```
"production check" → Fix failures → Deploy
```

---

## 💡 Pro Tips

**ВСЕГДА используй Skills вместо:**
- ❌ `cd backend && npm run dev` → ✅ `"quick start"`
- ❌ `tail -f backend/logs/error.log` → ✅ `"analyze logs"`
- ❌ `lsof -ti:3000` → ✅ `"check ports"`
- ❌ `npm test` → ✅ `"run tests"`
- ❌ `psql telegram_shop -c "..."` → ✅ `"query db"`

**ngrok критичен:**
- Проверяй после каждого wake from sleep
- Tunnel expires каждые 2 часа (free tier)
- Без ngrok Mini App не работает!

**Полная документация:**
- `.claude/skills/README.md` - детали каждого skill
- `CLAUDE.md` - основные правила работы
- `.claude/SKILLS_RESEARCH.md` - best practices

---

**Quick Ref v1.0** | **14 Skills** | **Updated: 2025-11-04**
