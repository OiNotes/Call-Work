'use client'

import { memo } from 'react'

interface TrendDataPoint {
  date: string
  sales: number
  deals: number
}

interface TrendChartProps {
  data: TrendDataPoint[]
}

export const TrendChart = memo(function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Недостаточно данных для построения графика
      </div>
    )
  }

  const maxSales = Math.max(...data.map(d => d.sales))
  const maxDeals = Math.max(...data.map(d => d.deals))

  return (
    <div className="space-y-6">
      {/* Продажи */}
      <div>
        <h4 className="text-sm font-semibold text-gray-600 mb-3">Продажи</h4>
        <div className="space-y-2">
          {data.map((point, index) => {
            const widthPercent = maxSales > 0 ? (point.sales / maxSales) * 100 : 0
            return (
              <div key={index} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20">{point.date}</span>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-end pr-2 text-white text-xs font-semibold"
                    style={{ width: `${widthPercent}%` }}
                  >
                    {widthPercent > 15 && `${point.sales.toLocaleString('ru-RU')} ₽`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Сделки */}
      <div>
        <h4 className="text-sm font-semibold text-gray-600 mb-3">Сделки</h4>
        <div className="space-y-2">
          {data.map((point, index) => {
            const widthPercent = maxDeals > 0 ? (point.deals / maxDeals) * 100 : 0
            return (
              <div key={index} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20">{point.date}</span>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-end pr-2 text-white text-xs font-semibold"
                    style={{ width: `${widthPercent}%` }}
                  >
                    {widthPercent > 15 && `${point.deals} шт`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
