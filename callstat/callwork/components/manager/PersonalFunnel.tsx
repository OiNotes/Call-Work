'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface FunnelStage {
  stage: string
  value: number
  teamAverage: number
  conversion?: number
  teamConversion?: number
  isAboveAverage: boolean
}

interface PersonalFunnelProps {
  funnel: FunnelStage[]
}

export function PersonalFunnel({ funnel }: PersonalFunnelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white rounded-2xl p-6 border"
    >
      <h3 className="text-lg font-semibold mb-6">Персональная воронка</h3>

      <div className="space-y-4">
        {funnel.map((stage, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">{stage.stage}</h4>
                {stage.isAboveAverage ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{stage.value}</p>
                {stage.conversion !== undefined && (
                  <p className={`text-sm ${stage.isAboveAverage ? 'text-green-600' : 'text-red-600'}`}>
                    {stage.conversion}% конверсия
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    stage.isAboveAverage ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{
                    width: `${stage.conversion !== undefined
                      ? stage.conversion
                      : (stage.value / (funnel[0]?.value || 1)) * 100
                    }%`
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 w-16 text-right">
                vs {stage.teamAverage}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
