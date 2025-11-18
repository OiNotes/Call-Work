'use client'

import { memo } from 'react'
import { TrendingDown } from 'lucide-react'

interface FunnelData {
  zoomAppointments: number
  pzmConducted: number
  vzmConducted: number
  successfulDeals: number
}

interface FunnelChartProps {
  data: FunnelData
}

export const FunnelChartWithAnalysis = memo(function FunnelChartWithAnalysis({ data }: FunnelChartProps) {
  const stages = [
    { label: 'Zoom встречи запланировано', value: data.zoomAppointments, color: 'bg-blue-500' },
    { label: 'ПЗМ проведено', value: data.pzmConducted, color: 'bg-blue-600' },
    { label: 'ВЗМ проведено', value: data.vzmConducted, color: 'bg-purple-500' },
    { label: 'Успешные сделки', value: data.successfulDeals, color: 'bg-green-500' },
  ]

  const maxValue = data.zoomAppointments || 1

  return (
    <div className="space-y-4">
      {stages.map((stage, index) => {
        const widthPercent = (stage.value / maxValue) * 100
        const prevValue = index > 0 ? stages[index - 1].value : stage.value
        const conversionRate = prevValue > 0 ? Math.round((stage.value / prevValue) * 100) : 100
        const isLowConversion = conversionRate < 70 && index > 0

        return (
          <div key={stage.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{stage.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{stage.value}</span>
                {index > 0 && (
                  <span className={`text-xs ${isLowConversion ? 'text-red-600' : 'text-gray-500'}`}>
                    ({conversionRate}%)
                  </span>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="h-12 bg-gray-100 rounded-lg overflow-hidden">
                <div 
                  className={`h-full ${stage.color} transition-all duration-500 flex items-center justify-end pr-3 text-white font-semibold text-sm`}
                  style={{ width: `${widthPercent}%` }}
                >
                  {widthPercent > 10 && stage.value}
                </div>
              </div>
              {isLowConversion && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
})
