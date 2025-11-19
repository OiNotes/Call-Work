# Alert System API

## Обзор

Alert System - система автоматического мониторинга и оповещения о проблемах в работе сотрудников.

## Архитектура

```
app/api/alerts/
├── route.ts              # GET /api/alerts, POST /api/alerts (mark all read)
├── [id]/
│   └── read/
│       └── route.ts      # PATCH /api/alerts/[id]/read (mark single read)
└── EXAMPLES.md           # Примеры использования API

app/api/cron/
└── check-alerts/
    └── route.ts          # GET /api/cron/check-alerts (Vercel Cron)

app/api/sse/
└── activities/
    └── route.ts          # SSE stream для real-time broadcast критичных алертов
```

## Типы алертов

### 1. NO_REPORTS (WARNING)
**Триггер:** Сотрудник не сдал отчёт 2+ дня подряд

**Логика:**
- Проверяется каждый активный сотрудник (isActive = true)
- Ищутся отчёты за последние 2 дня
- Если отчётов нет - создаётся алерт
- Дубликаты не создаются (проверка по типу + userId + createdAt >= 2 дня назад)

### 2. NO_DEALS (CRITICAL)
**Триггер:** Сотрудник не закрыл ни одной сделки 5+ дней

**Логика:**
- Проверяется каждый активный сотрудник
- Ищутся отчёты за последние 5 дней
- Если есть отчёты, но ни в одном successfulDeals = 0 - создаётся алерт
- Дубликаты не создаются (проверка по типу + userId + createdAt >= 5 дней назад)
- **Real-time broadcast:** критичные алерты отправляются через SSE в реальном времени

### 3. LOW_CONVERSION (WARNING)
**Триггер:** Конверсия упала больше чем на 20% (текущая неделя vs прошлая)

**Логика:**
- Текущая неделя = от понедельника до сегодня
- Прошлая неделя = 7 дней назад от понедельника
- Конверсия = (successfulDeals / vzmConducted) * 100
- Если текущая < прошлая * 0.8 - создаётся алерт
- Дубликаты не создаются в течение текущей недели

## Cron Job

**Расписание:** `0 9,15,21 * * *` (3 раза в день)
- 9:00 UTC (12:00 MSK)
- 15:00 UTC (18:00 MSK)
- 21:00 UTC (00:00 MSK)

**Авторизация:** Bearer token через `CRON_SECRET` env variable

**Процесс:**
1. Получить всех активных сотрудников
2. Проверить каждый тип алерта
3. Создать алерты массовым insert (createMany)
4. Broadcast критичных алертов через SSE

## Permissions

- **EMPLOYEE:** Видит только свои алерты
- **MANAGER:** Видит все алерты всех сотрудников

## Real-time Notifications

Критичные алерты (severity = 'CRITICAL') автоматически транслируются через SSE:

```typescript
// Server-Sent Events endpoint
GET /api/sse/activities

// Broadcast format
{
  type: 'alert',
  message: 'Нет закрытых сделок 5+ дней',
  details: 'Иван Петров не закрыл ни одной сделки за последние 5 дней',
  userId: 'cm3oqj4x50001xb8qy5v1e2f4',
  userName: 'Иван Петров',
  timestamp: '2025-11-18T22:30:00.000Z',
  id: 'activity-1700342400000-abc123def'
}
```

Frontend может подключиться к `/api/sse/activities` для получения уведомлений в реальном времени.

## Database Schema

```prisma
model Alert {
  id          String        @id @default(cuid())
  type        AlertType     // NO_REPORTS, LOW_CONVERSION, NO_DEALS, BEHIND_PACE
  severity    AlertSeverity // INFO, WARNING, CRITICAL
  title       String
  description String
  userId      String?
  user        User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  isRead      Boolean       @default(false)
  createdAt   DateTime      @default(now())

  @@index([isRead])
  @@index([createdAt])
  @@index([userId])
}
```

## Environment Variables

```bash
# .env.local
CRON_SECRET="your-secret-key-here"
```

Генерация secret:
```bash
openssl rand -base64 32
```

## Testing

### Local Testing

```bash
# 1. Запустить dev server
npm run dev

# 2. Тест GET alerts
curl http://localhost:3000/api/alerts

# 3. Тест cron (с CRON_SECRET)
curl -H "Authorization: Bearer your-cron-secret" \
  http://localhost:3000/api/cron/check-alerts

# 4. Тест mark single read
curl -X PATCH http://localhost:3000/api/alerts/[alert-id]/read

# 5. Тест mark all read
curl -X POST http://localhost:3000/api/alerts
```

### Vercel Deployment

После deployment в Vercel:
1. Добавить `CRON_SECRET` в Environment Variables
2. Vercel автоматически создаст cron job из `vercel.json`
3. Логи cron можно смотреть в Vercel Dashboard → Functions → Logs

## API Examples

См. [EXAMPLES.md](./EXAMPLES.md) для детальных примеров запросов и ответов.

## Troubleshooting

### Алерты не создаются

1. Проверить CRON_SECRET в Environment Variables
2. Проверить логи Vercel Cron
3. Проверить что есть активные сотрудники (isActive = true)
4. Проверить что есть отчёты в БД

### Дубликаты алертов

Система проверяет существующие алерты перед созданием новых:
- NO_REPORTS - не создаёт дубликаты в течение 2 дней
- NO_DEALS - не создаёт дубликаты в течение 5 дней
- LOW_CONVERSION - не создаёт дубликаты в течение текущей недели

### SSE не работает

1. Проверить что пользователь авторизован
2. Проверить браузер поддерживает EventSource
3. Проверить логи в консоли браузера
4. Попробовать переподключиться (heartbeat каждые 30 секунд)

## Best Practices

1. **Проверять isRead:** Фильтровать только непрочитанные алерты на главной странице
2. **Показывать unreadCount:** Отображать badge с количеством непрочитанных
3. **Auto-refresh:** Обновлять список алертов при получении SSE события
4. **Группировка:** Группировать алерты по severity (CRITICAL → WARNING → INFO)
5. **Mark as read:** Помечать как прочитанное при клике на алерт
