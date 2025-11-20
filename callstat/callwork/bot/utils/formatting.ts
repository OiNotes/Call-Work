import { ReportData } from '../types'

export function formatReportPreview(data: Partial<ReportData>, date: Date): string {
  const dateStr = formatDate(date)

  return `
📊 Отчёт за ${dateStr}

✅ Записи на ПЗМ: ${data.zoomAppointments ?? 0}
✅ Проведено ПЗМ: ${data.pzmConducted ?? 0}
${data.refusalsCount ? `❌ Отказы: ${data.refusalsCount}${data.refusalsReasons ? ` (${data.refusalsReasons})` : ''}` : ''}
🔥 Подогрев: ${data.warmingUpCount ?? 0}
✅ Проведено ВЗМ: ${data.vzmConducted ?? 0}
📋 Разбор договора: ${data.contractReviewCount ?? 0}
💰 Закрыто сделок: ${data.successfulDeals ?? 0}
💵 Сумма продаж: ${formatCurrency(data.monthlySalesAmount ?? 0)}

Всё верно?
  `.trim()
}

export function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}

export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`
}
