'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { RedZone, getSeverityColor, getSeverityIcon } from '@/lib/analytics/recommendations'

interface RedZoneAnalysisProps {
  redZones: RedZone[]
}

export const RedZoneAnalysis = memo(function RedZoneAnalysis({ redZones }: RedZoneAnalysisProps) {
  if (redZones.length === 0) {
    return (
      <div className="mt-8 p-6 bg-green-50 rounded-2xl border border-green-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900">Всё отлично!</h3>
            <p className="text-sm text-green-700">
              Все показатели в норме, критических проблем не обнаружено
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Зоны внимания</h2>
      <div className="space-y-4">
        {redZones.map((zone, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-6 rounded-2xl border ${getSeverityColor(zone.severity)}`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getSeverityIcon(zone.severity)}`}>
                {zone.severity === 'critical' ? '!' : 'i'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{zone.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{zone.description}</p>
                
                <div className="flex gap-4 text-sm">
                  <span>Текущее: <strong>{zone.current}%</strong></span>
                  <span className="text-gray-400">•</span>
                  <span>Средний по команде: <strong>{zone.teamAverage}%</strong></span>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>💡 Рекомендация:</strong> {zone.recommendation}
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
