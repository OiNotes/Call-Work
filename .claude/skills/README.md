# Agent SKILLS for Status Stock 4.0

**12 полезных SKILLS** для быстрой разработки, дебаггинга, тестирования и дизайна.

## Как использовать SKILLS

Просто скажите Claude фразу из раздела "Usage" любого SKILL:

```
"quick start"           → Запустит все сервисы
"health check"          → Проверит здоровье системы
"analyze logs"          → Найдет и покажет ошибки
"check ui"              → Валидирует дизайн
"run tests"             → Запустит все тесты
```

Claude автоматически выполнит все необходимые команды.

---

## 📁 Категории SKILLS

### ⚡ Development (3)

**1. quick-start.md** - Моментальный запуск всех сервисов
- Проверяет зависимости
- Запускает PostgreSQL
- Создает БД если нужно
- Стартует Backend + Bot + WebApp

**2. health-check.md** - Комплексная проверка здоровья
- Backend API health
- WebApp server status
- Bot process status
- PostgreSQL connection
- Recent error logs

**3. restart-all.md** - Безопасный перезапуск
- Graceful shutdown всех сервисов
- Очистка портов
- Перезапуск с мониторингом

---

### 🐛 Debug (3)

**4. analyze-logs.md** - Умный анализ error логов
- Backend error logs
- Bot error logs
- Категоризация ошибок
- Top 5 most frequent errors

**5. fix-errors.md** - Автоматическое исправление ошибок
- Port conflicts (EADDRINUSE)
- Database connection (ECONNREFUSED)
- Missing dependencies
- Schema out of sync
- Import/Export errors

**6. check-ports.md** - Управление портами
- Проверка портов 3000, 5173, 5432
- Показывает процессы на портах
- Освобождает занятые порты

---

### 🧪 Testing (2)

**7. run-tests.md** - Запуск всех тестов
- Backend tests + coverage
- Bot tests + coverage
- Coverage summary report

**8. test-integration.md** - Integration тесты бота
- Full user flow testing
- Auto backend startup
- Test cleanup

---

### 🎨 Design (2)

**9. ui-check.md** - Валидация UI дизайна
- Glassmorphism effects
- Color palette (#FF6B00, #181818)
- Touch-friendly buttons (44px)
- Typography consistency

**10. animation-check.md** - Проверка анимаций
- Framer Motion usage
- Performance anti-patterns
- Spring animations
- GPU-accelerated transforms

---

### 🗄️ Database (2)

**11. db-migrate.md** - Безопасные миграции
- Auto backup before migration
- Run migrations
- Verify schema
- Rollback on errors

**12. db-query.md** - Быстрые SQL запросы
- Common queries (users, shops, orders)
- Table schemas
- Export to CSV/JSON
- Database statistics

---

## 🚀 Quick Start Examples

### Утренний старт разработки:
```
"quick start"           # Запустить всё
"health check"          # Проверить здоровье
```

### Когда что-то сломалось:
```
"analyze logs"          # Найти ошибки
"fix errors"            # Автофикс
"restart all"           # Перезапустить
```

### Перед коммитом:
```
"run tests"             # Все тесты
"check ui"              # Дизайн
"check animations"      # Анимации
```

### Работа с БД:
```
"migrate db"            # Миграции
"query db"              # SQL запросы
```

---

## 💡 Pro Tips

### Комбинирование SKILLS:

1. **Morning workflow:**
   ```
   "quick start" → "health check" → "analyze logs"
   ```

2. **Before commit:**
   ```
   "run tests" → "check ui" → "check animations"
   ```

3. **Emergency fix:**
   ```
   "analyze logs" → "fix errors" → "health check"
   ```

### Кастомизация:

Вы можете редактировать любой SKILL файл для:
- Изменения путей
- Добавления новых команд
- Настройки thresholds
- Добавления своих проверок

---

## 📊 Статистика

**Всего:** 12 SKILLS
**Строк кода:** 1235 lines
**Категорий:** 5 (Development, Debug, Testing, Design, Database)

**Охват:**
- ⚡ Development: 100%
- 🐛 Debugging: 100%
- 🧪 Testing: Backend + Bot
- 🎨 Design: UI + Animations
- 🗄️ Database: Migrations + Queries

---

## 🎯 Ваши предпочтения учтены

Все SKILLS созданы с учетом ваших предпочтений:

✅ **Скорость** - quick-start, fast restart, instant checks
✅ **Элегантность** - ui-check, animation-check, design validation
✅ **Чистый код** - автоматические quality checks
✅ **Дебаггинг** - smart log analysis, auto-fix
✅ **Тестирование** - full coverage, integration tests

---

## 📖 Дополнительно

Каждый SKILL файл содержит:
- Детальное описание
- Примеры использования
- Команды bash
- Best practices
- Когда использовать

Просто откройте любой `.md` файл чтобы увидеть полную документацию!

---

**Created:** 2025-10-31
**Version:** 1.0
**Project:** Status Stock 4.0
