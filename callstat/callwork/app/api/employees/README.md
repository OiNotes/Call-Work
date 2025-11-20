# Employees API

API endpoints для работы с сотрудниками и их статистикой.

## Endpoints

### GET /api/employees

Получить список всех работников менеджера с их статистикой.

**Auth:** Требуется роль MANAGER

**Query параметры:**
- `startDate` (optional) - Начальная дата периода (ISO 8601). По умолчанию: месяц назад
- `endDate` (optional) - Конечная дата периода (ISO 8601). По умолчанию: сегодня

**Response:**
```json
{
  "employees": [
    {
      "id": "user_id",
      "name": "Иван Иванов",
      "email": "ivan@example.com",
      "stats": {
        "pzmScheduled": 50,
        "pzmConducted": 45,
        "vzmConducted": 30,
        "dealsClosed": 20,
        "salesAmount": 1500000,
        "pzmConversion": 90,
        "pzToVzmConversion": 67,
        "vzmToDealConversion": 67,
        "overallConversion": 44,
        "hasRedZone": false
      }
    }
  ]
}
```

**hasRedZone:** true если `pzToVzmConversion < 60%` или `vzmToDealConversion < 70%`

---

### GET /api/employees/[id]/stats

Получить детальную статистику конкретного работника.

**Auth:** 
- EMPLOYEE может смотреть только свою статистику
- MANAGER может смотреть статистику своих работников

**Query параметры:**
- `range` (optional) - Период: `week`, `month`, `quarter`, `year`. По умолчанию: `month`

**Response:**
```json
{
  "stats": {
    "pzmScheduled": 50,
    "pzmConducted": 45,
    "vzmConducted": 30,
    "dealsClosed": 20,
    "salesAmount": 1500000,
    "rejections": 5,
    "warmUp": 10,
    "contractReview": 8,
    "pzmConversion": 90,
    "pzToVzmConversion": 67,
    "vzmToDealConversion": 67,
    "overallConversion": 44,
    "avgCheck": 75000
  },
  "teamAverageConversions": {
    "pzmConversion": 85,
    "pzToVzmConversion": 65,
    "vzmToDealConversion": 70,
    "overallConversion": 42
  }
}
```

**avgCheck:** Средний чек = `salesAmount / dealsClosed`

---

### GET /api/employees/[id]/reports

Получить список отчётов работника с пагинацией.

**Auth:** 
- EMPLOYEE может смотреть только свои отчёты
- MANAGER может смотреть отчёты своих работников

**Query параметры:**
- `limit` (optional) - Количество записей. По умолчанию: 10
- `offset` (optional) - Смещение для пагинации. По умолчанию: 0

**Response:**
```json
{
  "reports": [
    {
      "id": "report_id",
      "date": "2024-01-15T00:00:00.000Z",
      "pzmScheduled": 5,
      "pzmConducted": 4,
      "vzmConducted": 3,
      "dealsClosed": 2,
      "salesAmount": "150000.00"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Типы конверсий

Все endpoints используют единую логику расчёта конверсий из `lib/analytics/conversions.ts`:

- **pzmConversion** - % проведённых ПЗМ от запланированных
- **pzToVzmConversion** - % ВЗМ от проведённых ПЗМ (красная зона < 60%)
- **vzmToDealConversion** - % сделок от ВЗМ (красная зона < 70%)
- **overallConversion** - % сделок от запланированных ПЗМ

## Error Handling

- `401 Unauthorized` - Пользователь не авторизован
- `403 Forbidden` - Недостаточно прав для доступа к данным
- `500 Internal Server Error` - Ошибка сервера
