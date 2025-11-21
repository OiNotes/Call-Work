# Умный калькулятор мотивации и прогноза

## Что появилось
- Таблица `Deal` с бюджетом, статусами (`OPEN/WON/LOST`), полем `paymentStatus` и флагом `isFocus`.
- Таблица `MotivationGrade` с порогами и ставками комиссии.
- API: `GET /api/motivation/summary` — расчёт R\_Fact/R\_Hot/Forecast и зарплаты; `PATCH /api/deals/[id]/focus` — переключение фокуса сделки; `GET /api/deals` — список сделок для менеджера/команды.
- Виджет «Мой доход (Прогноз)» на дашборде + список «Фокус-лист» сделок с быстрым переключателем.

## Миграции и сиды
1. Примените миграции:
   ```bash
   npx prisma migrate deploy
   ```
2. Обновите Prisma Client:
   ```bash
   npx prisma generate
   ```
3. (Опционально для стендов) прогоните сиды с демо-данными и грейдами:
   ```bash
   npx prisma db seed
   ```

## Модель расчёта
- `R_Fact`: сумма бюджетов сделок со статусом `WON`, `paymentStatus = PAID`, дата оплаты/закрытия попала в период.
- `R_Hot`: сумма бюджетов открытых (`OPEN`) сделок с `isFocus = true`.
- `R_Forecast = R_Hot * 0.5`
- `R_Total_Potential = R_Fact + R_Forecast`
- Ставки берутся из `MotivationGrade` (`minTurnover/maxTurnover/commissionRate`).
- `Salary_Fact = R_Fact * rate(R_Fact)`
- `Total_Forecast_Salary = R_Total_Potential * rate(R_Total_Potential)`
- `Potential_Gain = Total_Forecast_Salary - Salary_Fact`

## Пример запроса к API
```
GET /api/motivation/summary?managerId=all&startDate=2025-02-01T00:00:00.000Z&endDate=2025-02-28T23:59:59.999Z
Authorization: (сессия NextAuth)
```

Ответ:
```json
{
  "factTurnover": 750000,
  "hotTurnover": 500000,
  "forecastTurnover": 250000,
  "totalPotentialTurnover": 1000000,
  "factRate": 0.05,
  "forecastRate": 0.07,
  "salaryFact": 37500,
  "salaryForecast": 70000,
  "potentialGain": 32500,
  "grades": [
    { "minTurnover": 0, "maxTurnover": 600000, "commissionRate": 0 },
    { "minTurnover": 600000, "maxTurnover": 1000000, "commissionRate": 0.05 },
    ...
  ]
}
```

## Тесты
- Юнит-тест калькулятора: `npx tsx tests/motivationCalculator.test.ts`
