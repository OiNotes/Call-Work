'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getConversionColor, formatPercent } from '@/lib/calculations/funnel'
import type { FunnelStage } from '@/lib/calculations/funnel'

interface MiniFunnelCardProps {
  employeeId: string
  employeeName: string
  funnel: FunnelStage[]
  redZones: string[]
}

export function MiniFunnelCard({ employeeId, employeeName, funnel, redZones }: MiniFunnelCardProps) {
  const router = useRouter()

  if (!funnel || funnel.length === 0) return null

  const finalConversion = funnel[funnel.length - 1]?.conversion || 0
  const maxValue = funnel[0]?.value || 1

  return (
    <motion.div
      className="glass-card p-5 border border-slate-200 dark:border-slate-700 cursor-pointer h-[360px] flex flex-col"
      whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
      onClick={() => router.push(`/dashboard/employee/${employeeId}`)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="mb-4">
        <h3 className="font-semibold text-lg text-slate-900 dark:text-white truncate">
          {employeeName}
        </h3>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-bold" style={{ color: getConversionColor(finalConversion, false) }}>
            {formatPercent(finalConversion)}
          </span>
          <span className="text-xs text-slate-500">финальная конверсия</span>
        </div>
      </div>

      {/* Мини-воронка */}
      <div className="flex-1 flex flex-col justify-center space-y-2">
        {funnel.map((stage, _index) => {
          const widthPercent = (stage.value / maxValue) * 100
          const color = getConversionColor(stage.conversion, stage.isRedZone)

          return (
            <div key={stage.stage} className="space-y-1">
              {/* Этап название + конверсия */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 truncate">
                  {stage.stage.replace(' Проведено', '')}
                </span>
                <span className="font-semibold ml-2" style={{ color }}>
                  {formatPercent(stage.conversion)}
                </span>
              </div>

              {/* Бар воронки */}
              <div
                className="h-6 rounded-md transition-all duration-300"
                style={{
                  width: `${Math.max(widthPercent, 15)}%`,
                  background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
                }}
              >
                <div className="flex items-center justify-center h-full text-white text-xs font-medium">
                  {stage.value}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer - Red Zones */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
        {redZones.length > 0 ? (
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">Red Zones:</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                {redZones.join(', ')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <TrendingUp className="w-4 h-4" />
            <p className="text-xs font-medium">Все показатели в норме</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
