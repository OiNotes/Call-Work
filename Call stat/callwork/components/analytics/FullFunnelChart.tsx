'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, Users, TrendingDown, Flame, XCircle } from 'lucide-react'
import { getConversionColor, formatNumber, formatPercent } from '@/lib/calculations/funnel'
import type { FunnelStage, SideFlow } from '@/lib/calculations/funnel'

interface FullFunnelChartProps {
  funnel: FunnelStage[]
  sideFlow: SideFlow
  onStageClick?: (stage: FunnelStage) => void
}

export function FullFunnelChart({ funnel, sideFlow, onStageClick }: FullFunnelChartProps) {
  if (!funnel || funnel.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] text-slate-400">
        <p>Нет данных для отображения воронки</p>
      </div>
    )
  }

  const maxValue = funnel[0]?.value || 1

  return (
    <div className="grid grid-cols-[1fr_300px] gap-8">
      {/* Основная воронка */}
      <div className="relative">
        <div className="space-y-4">
          {funnel.map((stage, index) => {
            const widthPercent = (stage.value / maxValue) * 100
            const color = getConversionColor(stage.conversion, stage.isRedZone)

            return (
              <motion.div
                key={stage.stage}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                {/* Трапеция воронки */}
                <motion.div
                  className="relative mx-auto h-24 cursor-pointer overflow-hidden rounded-lg"
                  style={{
                    width: `${Math.max(widthPercent, 20)}%`,
                    clipPath: index === funnel.length - 1
                      ? 'polygon(10% 0%, 90% 0%, 85% 100%, 15% 100%)' // Последний этап - сужается
                      : 'polygon(5% 0%, 95% 0%, 100% 100%, 0% 100%)', // Трапеция
                    background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                  }}
                  whileHover={{ scale: 1.02, boxShadow: `0 10px 30px ${color}40` }}
                  onClick={() => onStageClick?.(stage)}
                >
                  {/* Контент внутри трапеции */}
                  <div className="flex items-center justify-between px-8 h-full text-white">
                    <div>
                      <p className="font-semibold text-lg">{stage.stage}</p>
                      <p className="text-sm opacity-90">{formatNumber(stage.value)} человек</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatPercent(stage.conversion)}</p>
                      {stage.isRedZone && (
                        <div className="flex items-center gap-1 text-xs mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Red Zone</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Стрелка вниз между этапами */}
                {index < funnel.length - 1 && (
                  <div className="flex justify-center my-2">
                    <TrendingDown className="w-5 h-5 text-slate-400" />
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Боковая панель - Отказы и Подогрев */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-6"
      >
        {/* Отказы */}
        <div className="glass-card p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Отказы</h3>
              <p className="text-xs text-slate-500">От ПЗМ Проведено</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-slate-600 dark:text-slate-400">Количество</span>
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatNumber(sideFlow.refusals.count)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-slate-600 dark:text-slate-400">% от ПЗМ</span>
              <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                {formatPercent(sideFlow.refusals.rate)}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-red-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(sideFlow.refusals.rate, 100)}%` }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>
        </div>

        {/* Подогрев */}
        <div className="glass-card p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">В подогреве</h3>
              <p className="text-xs text-slate-500">Клиенты на прогреве</p>
            </div>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-sm text-slate-600 dark:text-slate-400">Всего человек</span>
            <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {formatNumber(sideFlow.warming.count)}
            </span>
          </div>

          {/* Иконки людей визуализация */}
          <div className="mt-4 flex flex-wrap gap-2">
            {Array.from({ length: Math.min(sideFlow.warming.count, 12) }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: 0.6 + i * 0.05 }}
              >
                <Users className="w-4 h-4 text-orange-400" />
              </motion.div>
            ))}
            {sideFlow.warming.count > 12 && (
              <span className="text-xs text-slate-500">+{sideFlow.warming.count - 12}</span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
