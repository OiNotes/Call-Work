'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Target } from 'lucide-react'
import { RedZone, getSeverityColor, getSeverityIcon } from '@/lib/analytics/recommendations'

interface RedZoneAnalysisProps {
  redZones: RedZone[]
}

export const RedZoneAnalysis = memo(function RedZoneAnalysis({ redZones }: RedZoneAnalysisProps) {
  if (redZones.length === 0) {
    return (
      <div className="mt-8 p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-green-900">Всё отлично!</h3>
            <p className="text-sm text-green-700 mt-1">
              Все показатели выше среднего по команде
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        Зоны для улучшения
      </h2>

      <div className="space-y-4">
        {redZones.map((zone, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-6 rounded-2xl border-2 ${getSeverityColor(zone.severity)}`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${getSeverityIcon(zone.severity)}`}>
                !
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">{zone.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{zone.description}</p>

                <div className="flex gap-6 text-sm mb-3">
                  <div>
                    <span className="text-gray-600">Текущее:</span>
                    <strong className="text-red-600 ml-2">{zone.current}%</strong>
                  </div>
                  <div className="text-gray-300">•</div>
                  <div>
                    <span className="text-gray-600">Средняя:</span>
                    <strong className="text-gray-900 ml-2">{zone.teamAverage}%</strong>
                  </div>
                  <div className="text-gray-300">•</div>
                  <div>
                    <span className="text-gray-600">Разрыв:</span>
                    <strong className="text-red-600 ml-2">-{zone.teamAverage - zone.current}%</strong>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 flex items-start gap-2">
                    <Target className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Рекомендация:</strong> {zone.recommendation}</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
})
