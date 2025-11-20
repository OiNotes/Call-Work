# Alert System API Examples

## Endpoints

### 1. GET /api/alerts - Получить список алертов

**Query Parameters:**
- `severity` - фильтр по критичности (INFO, WARNING, CRITICAL)
- `isRead` - фильтр по прочитанности (true/false)

**Response Example:**
```json
{
  "alerts": [
    {
      "id": "cm3oqj4x50000xb8qy5v1e2f3",
      "type": "NO_REPORTS",
      "severity": "WARNING",
      "title": "Нет отчётов 2+ дня",
      "description": "Иван Петров не сдал отчёт за последние 2 дня",
      "userId": "cm3oqj4x50001xb8qy5v1e2f4",
      "user": {
        "id": "cm3oqj4x50001xb8qy5v1e2f4",
        "name": "Иван Петров"
      },
      "isRead": false,
      "createdAt": "2025-11-18T22:30:00.000Z"
    },
    {
      "id": "cm3oqj4x50002xb8qy5v1e2f5",
      "type": "NO_DEALS",
      "severity": "CRITICAL",
      "title": "Нет закрытых сделок 5+ дней",
      "description": "Мария Сидорова не закрыла ни одной сделки за последние 5 дней",
      "userId": "cm3oqj4x50003xb8qy5v1e2f6",
      "user": {
        "id": "cm3oqj4x50003xb8qy5v1e2f6",
        "name": "Мария Сидорова"
      },
      "isRead": false,
      "createdAt": "2025-11-18T22:25:00.000Z"
    },
    {
      "id": "cm3oqj4x50004xb8qy5v1e2f7",
      "type": "LOW_CONVERSION",
      "severity": "WARNING",
      "title": "Упала конверсия",
      "description": "Конверсия Алексей Ковалёв упала с 45.2% до 32.1%",
      "userId": "cm3oqj4x50005xb8qy5v1e2f8",
      "user": {
        "id": "cm3oqj4x50005xb8qy5v1e2f8",
        "name": "Алексей Ковалёв"
      },
      "isRead": true,
      "createdAt": "2025-11-18T22:20:00.000Z"
    }
  ],
  "unreadCount": 2
}
```

### 2. POST /api/alerts - Пометить все как прочитанные

**Response Example:**
```json
{
  "updated": 5
}
```

### 3. PATCH /api/alerts/[id]/read - Пометить конкретный алерт как прочитанный

**Response Example:**
```json
{
  "alert": {
    "id": "cm3oqj4x50000xb8qy5v1e2f3",
    "type": "NO_REPORTS",
    "severity": "WARNING",
    "title": "Нет отчётов 2+ дня",
    "description": "Иван Петров не сдал отчёт за последние 2 дня",
    "userId": "cm3oqj4x50001xb8qy5v1e2f4",
    "isRead": true,
    "createdAt": "2025-11-18T22:30:00.000Z"
  }
}
```

### 4. GET /api/cron/check-alerts - Cron проверка (только Vercel Cron)

**Authorization:** Bearer token через `CRON_SECRET` env variable

**Response Example:**
```json
{
  "created": 3,
  "alerts": [
    { "type": "NO_REPORTS", "userId": "cm3oqj4x50001xb8qy5v1e2f4" },
    { "type": "NO_DEALS", "userId": "cm3oqj4x50003xb8qy5v1e2f6" },
    { "type": "LOW_CONVERSION", "userId": "cm3oqj4x50005xb8qy5v1e2f8" }
  ]
}
```

## Alert Types

### NO_REPORTS (WARNING)
- **Триггер:** Сотрудник не сдал отчёт 2+ дня подряд
- **Проверка:** Каждый день в 9:00, 15:00, 21:00 UTC
- **Дубликаты:** Не создаются в течение 2 дней

### NO_DEALS (CRITICAL)
- **Триггер:** Сотрудник не закрыл ни одной сделки 5+ дней
- **Проверка:** Каждый день в 9:00, 15:00, 21:00 UTC
- **Дубликаты:** Не создаются в течение 5 дней

### LOW_CONVERSION (WARNING)
- **Триггер:** Конверсия упала больше чем на 20% (текущая неделя vs прошлая)
- **Проверка:** Каждый день в 9:00, 15:00, 21:00 UTC
- **Дубликаты:** Не создаются в течение текущей недели

## Permissions

- **EMPLOYEE:** Видит только свои алерты
- **MANAGER:** Видит все алерты всех сотрудников

## Environment Variables

Добавить в `.env.local`:
```
CRON_SECRET=your-secret-key-here
```

## Vercel Cron Schedule

- **Расписание:** `0 9,15,21 * * *` (3 раза в день)
- **Время:** 9:00, 15:00, 21:00 UTC
- **Московское время:** 12:00, 18:00, 00:00 MSK

## Testing Locally

```bash
# Тест GET alerts
curl http://localhost:3000/api/alerts

# Тест GET alerts с фильтрами
curl "http://localhost:3000/api/alerts?severity=CRITICAL&isRead=false"

# Тест POST mark all read
curl -X POST http://localhost:3000/api/alerts

# Тест PATCH mark single read
curl -X PATCH http://localhost:3000/api/alerts/[alert-id]/read

# Тест cron (с CRON_SECRET)
curl -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/cron/check-alerts
```
