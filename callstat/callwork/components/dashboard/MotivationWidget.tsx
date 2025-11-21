'use client'

import { useMemo } from 'react'
import { RefreshCcw } from 'lucide-react'
import { formatMoney, formatNumber } from '@/lib/utils/format'
import { MotivationCalculationResult } from '@/lib/motivation/motivationCalculator'
import { MotivationGradeConfig } from '@/lib/config/motivationGrades'

interface MotivationWidgetProps {
  title: string
  data?: MotivationCalculationResult | null
  grades?: MotivationGradeConfig[]
  loading?: boolean
  onRefresh?: () => void
}

function toPercent(rate: number) {
  return Math.round(rate * 1000) / 10
}

export function MotivationWidget({
  title,
  data,
  grades = [],
  loading = false,
  onRefresh,
}: MotivationWidgetProps) {
  const lastGradeMin = grades.length > 0 ? grades[grades.length - 1].minTurnover : 0

  const maxScale = useMemo(() => {
    const finiteGrades = grades
      .map((g) => g.maxTurnover ?? g.minTurnover)
      .filter((v) => typeof v === 'number') as number[]

    const ceiling = finiteGrades.length > 0 ? Math.max(...finiteGrades) : 0
    const target = data?.totalPotentialTurnover ?? 0
    const base = Math.max(target, ceiling, lastGradeMin || 1)

    return base === 0 ? 1 : base
  }, [grades, data?.totalPotentialTurnover, lastGradeMin])

  const factPercent = Math.min(100, ((data?.factTurnover ?? 0) / maxScale) * 100)
  const totalPercent = Math.min(
    100,
    ((data?.totalPotentialTurnover ?? data?.factTurnover ?? 0) / maxScale) * 100
  )

  const thresholds = useMemo(
    () =>
      grades
        .filter((grade) => (grade.minTurnover ?? 0) > 0)
        .map((grade) => ({
          value: grade.minTurnover,
          percent: Math.min(100, (grade.minTurnover / maxScale) * 100),
        })),
    [grades, maxScale]
  )

  const factRatePct = toPercent(data?.factRate ?? 0)
  const forecastRatePct = toPercent(data?.forecastRate ?? 0)
  const rateText =
    factRatePct === forecastRatePct
      ? `${factRatePct}%`
      : `${factRatePct}% → ${forecastRatePct}%`

  const potentialGain = data?.potentialGain ?? 0
  const gainLabel = `${potentialGain >= 0 ? '+' : ''}${formatMoney(potentialGain)}`

  return (
    <div className="glass-card p-6 shadow-sm relative overflow-hidden">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm text-[var(--muted-foreground)]">Мотивация</p>
          <h3 className="text-xl font-bold text-[var(--foreground)]">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="p-2 rounded-lg bg-[var(--muted)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Обновить расчёт"
          disabled={loading}
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading || !data ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-[var(--muted)] rounded w-1/2" />
          <div className="h-10 bg-[var(--muted)] rounded" />
          <div className="h-24 bg-[var(--muted)] rounded" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--muted)]/50 to-white border border-[var(--border)]">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
                Заработано сейчас
              </p>
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {formatMoney(data.salaryFact)}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Факт: {formatMoney(data.factTurnover)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-[var(--border)]">
              <p className="text-xs uppercase tracking-wide text-emerald-600 mb-1">
                Потенциальный итог
              </p>
              <div className="text-2xl font-bold text-emerald-700">
                {formatMoney(data.salaryForecast)}
              </div>
              <p className="text-xs text-emerald-700/80">
                Прирост: <span className="font-semibold"> {gainLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">Ставка</p>
              <div className="text-lg font-semibold text-[var(--foreground)]">{rateText}</div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-[var(--muted)]/60 text-[var(--muted-foreground)] text-sm">
              Потенциал: {formatMoney(data.totalPotentialTurnover)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative h-4 bg-[var(--muted)]/60 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[var(--primary)]/30"
                style={{ width: `${totalPercent}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[var(--primary)]"
                style={{ width: `${factPercent}%` }}
              />
              {thresholds.map((marker) => (
                <div
                  key={marker.value}
                  className="absolute top-0 bottom-0 w-[1px] bg-[var(--border)]"
                  style={{ left: `${marker.percent}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
              <span>0</span>
              <span>Макс: {formatMoney(maxScale)}</span>
            </div>
            <div className="flex gap-3 flex-wrap text-[10px] text-[var(--muted-foreground)]">
              {thresholds.map((marker) => (
                <span key={marker.value} className="flex items-center gap-1">
                  <span className="w-2 h-[1px] bg-[var(--border)]" />
                  {formatNumber(marker.value)} ₽
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
