# CallWork Analytics Cheat Sheet

## Воронка отдела продаж

Шаги (бизнес-этапы):
1) Записан на Zoom (`zoomBooked`)
2) 1-й Zoom (`zoom1Held`)
3) 2-й Zoom (`zoom2Held`)
4) Разбор договора (`contractReview`)
5) Дожим (`push`)
6) Оплата (`deal`)

Step-to-step конверсии:
- Запись → 1-й Zoom = `zoom1Held / zoomBooked * 100`
- 1-й Zoom → 2-й Zoom = `zoom2Held / zoom1Held * 100`
- 2-й Zoom → Разбор = `contractReview / zoom2Held * 100`
- Разбор → Дожим = `push / contractReview * 100`
- Дожим → Оплата = `deals / push * 100`

Главный KPI (North Star):
- `payments / firstZooms * 100` = `deals / zoom1Held * 100`
- Цель (benchmark): 5%

Side-flow (потери/прогрев):
- Для каждого этапа считаем отказы `refusalsOnStage / totalOnStage * 100`
- Подогрев (warming) — отдельный счётчик, не участвует в step-to-step конверсии.

## Benchmarks (единый источник)
Хранятся в `lib/config/benchmarks.ts`:
- BOOKED_TO_ZOOM1: 60
- ZOOM1_TO_ZOOM2: 50
- ZOOM2_TO_CONTRACT: 40
- CONTRACT_TO_PUSH: 60
- PUSH_TO_DEAL: 70
- ZOOM1_TO_DEAL_KPI: 5

Используются в:
- RedZoneAlerts (точки внимания)
- ManagersTable (heatmap норм)
- Funnel/детализация для подсветки красных зон

## API
- `/api/analytics/funnel` — возвращает воронку, side-flow, North Star KPI, TOP/BOTTOM менеджеров. Параметры: `startDate`, `endDate`, `userId` (опционально, `all` не передаётся).
- `/api/reports` — приём дневных отчётов (ручной ввод): записи, 1-й/2-й Zoom, договор, дожим, оплаты, отказы по этапам, прогрев.

## Формулы для карточек дашборда
- Выручка факт = сумма `monthlySalesAmount`
- План/факт по сделкам = `successfulDeals / planDeals * 100`
- Общая конверсия = `deals / zoomBooked * 100`
- Главный KPI = `deals / zoom1Held * 100` (цель 5%)

## Как интерпретировать
- Красная зона: конверсия этапа ниже benchmark из конфига.
- Точка внимания “нет продаж”: если `deals` = 0 за выбранный период.
- Отказы по этапам: смотреть, где самый высокий % отказов — туда идти слушать звонки.

## Тесты
- `npm run test:analytics` — быстрые проверки формул KPI и step-to-step конверсий (`tests/analytics.test.ts`).
