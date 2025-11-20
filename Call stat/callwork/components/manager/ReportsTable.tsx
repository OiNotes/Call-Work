'use client'

import { memo } from 'react'
import { formatDate, formatMoney } from '@/lib/utils/format'

interface Report {
  id: string
  date: string // ISO string from API
  zoomAppointments: number
  pzmConducted: number
  vzmConducted: number
  contractReviewCount?: number
  pushCount?: number
  successfulDeals: number
  monthlySalesAmount: number
  refusalsCount?: number
}

interface ReportsTableProps {
  reports: Report[]
}

export const ReportsTable = memo(function ReportsTable({ reports }: ReportsTableProps) {
  const calculateConversion = (numerator: number, denominator: number) =>
    denominator === 0 ? 0 : Math.round((numerator / denominator) * 100)

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Нет отчётов за выбранный период
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-semibold text-sm text-gray-600">Дата</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-gray-600">Записаны</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-gray-600">1-й Zoom</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-gray-600">2-й Zoom</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-gray-600">Договор</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-gray-600">Дожим</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-gray-600">Оплаты</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-gray-600">Отказы</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-gray-600">Продажи</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-gray-600">KPI 1-й Zoom → Оплата</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const kpi = calculateConversion(report.successfulDeals, report.pzmConducted)
            return (
              <tr key={report.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-sm">{formatDate(report.date)}</td>
                <td className="py-3 px-4 text-sm text-right">{report.zoomAppointments}</td>
                <td className="py-3 px-4 text-sm text-right font-semibold">{report.pzmConducted}</td>
                <td className="py-3 px-4 text-sm text-right">{report.vzmConducted}</td>
                <td className="py-3 px-4 text-sm text-right">{report.contractReviewCount ?? 0}</td>
                <td className="py-3 px-4 text-sm text-right">{report.pushCount ?? 0}</td>
                <td className="py-3 px-4 text-sm text-right font-semibold text-green-600">
                  {report.successfulDeals}
                </td>
                <td className="py-3 px-4 text-sm text-right">{report.refusalsCount ?? 0}</td>
                <td className="py-3 px-4 text-sm text-right font-semibold">
                  {formatMoney(report.monthlySalesAmount)}
                </td>
                <td className="py-3 px-4 text-sm text-right">
                  <span
                    className={`inline-block px-2 py-1 rounded ${
                      kpi >= 5
                        ? 'bg-green-100 text-green-700'
                        : kpi >= 3
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {kpi}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
