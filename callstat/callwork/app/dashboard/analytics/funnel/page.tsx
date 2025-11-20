'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, AlertCircle, ArrowLeft } from 'lucide-react'
import { InteractiveFunnelChart } from '@/components/analytics/InteractiveFunnelChart'
import { EmployeeDrillDown } from '@/components/analytics/EmployeeDrillDown'
import { useRouter } from 'next/navigation'
import { subDays, startOfMonth, endOfMonth } from 'date-fns'
import { PeriodSelector, PeriodPreset } from '@/components/filters/PeriodSelector'

interface FunnelStage {
  stage: string
  count: number
  conversion_rate: number
  is_red_zone: boolean
}

interface EmployeeConversion {
  employee_id: string
  employee_name: string
  stage: string
  count: number
  conversion_rate: number
}

interface FunnelData {
  funnel: FunnelStage[]
  employeeConversions: EmployeeConversion[]
  sideFlow?: {
    refusals: {
      total: number
      rateFromFirstZoom: number
      byStage: Array<{ stageId: string; label: string; count: number; rate: number }>
    }
    warming: { count: number }
  }
  northStarKpi?: {
    value: number
    target: number
    delta: number
    isOnTrack: boolean
  }
}

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  }
}

export default function FunnelPage() {
  const router = useRouter()
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null)
  const [datePreset, setDatePreset] = useState<PeriodPreset>('thisMonth')
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  })
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([])
  const [selectedManager, setSelectedManager] = useState<string>('all')

  const fetchFunnelData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString()
      })
      if (selectedManager !== 'all') {
        params.set('userId', selectedManager)
      }

      const res = await fetch(`/api/analytics/funnel?${params}`)

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Не удалось загрузить данные воронки')
      }

      const json = await res.json()
      setData(json)

      const uniqueManagers = Array.from(
        new Map(
          (json.employeeConversions || []).map((emp: EmployeeConversion) => [emp.employee_id, emp.employee_name])
        ).entries()
      ).map(([id, name]) => ({ id: id as string, name: name as string }))
      setManagers(uniqueManagers)
    } catch (err) {
      console.error('Failed to fetch funnel:', err)
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }, [dateRange.start, dateRange.end, selectedManager])

  useEffect(() => {
    fetchFunnelData()
  }, [fetchFunnelData])

  const updateDatePreset = (preset: PeriodPreset, nextRange?: { start: Date; end: Date }) => {
    setDatePreset(preset)
    if (nextRange) {
      setDateRange(nextRange)
      return
    }

    const now = new Date()
    if (preset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      setDateRange({ start, end })
    } else if (preset === 'week') {
      setDateRange({ start: subDays(now, 7), end: now })
    } else if (preset === 'lastMonth') {
      setDateRange({ start: startOfMonth(subDays(startOfMonth(now), 1)), end: endOfMonth(subDays(startOfMonth(now), 1)) })
    } else {
      setDateRange({ start: startOfMonth(now), end: endOfMonth(now) })
    }
  }


  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-gradient-to-br from-[#F5F5F7] to-[#E5E5E7] p-8"
    >
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#007AFF] hover:text-[#0051D5] mb-4 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Назад</span>
        </button>

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <TrendingDown className="w-8 h-8 text-[#007AFF]" />
                  <h1 className="text-4xl font-bold text-[#1D1D1F]">
                    Рентген воронки продаж
                  </h1>
                </div>
                <p className="text-[#86868B]">
                  Анализ конверсий на каждом этапе продаж с детализацией по сотрудникам
                </p>
            </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <PeriodSelector
              selectedPreset={datePreset}
              range={dateRange}
              onPresetChange={(preset, next) => updateDatePreset(preset, next)}
              title="Период"
            />

            <div className="bg-white rounded-2xl p-4 shadow-md border border-[#E5E5E7]">
              <p className="text-xs text-[#86868B] mb-2">Менеджер</p>
              <select
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                className="rounded-lg border border-[#E5E5E7] px-3 py-2 text-sm"
              >
                <option value="all">Вся команда</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-lg border border-[#E5E5E7] p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-16 h-16 mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-4 border-[#E5E5E7] border-t-[#007AFF]"
              />
            </div>
            <p className="text-lg font-medium text-[#86868B]">
              Загрузка данных воронки...
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-2xl p-8 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-200 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#1D1D1F] mb-2">
                Ошибка загрузки данных
              </h2>
              <p className="text-[#86868B] mb-4">{error}</p>
              <button
                onClick={fetchFunnelData}
                className="px-6 py-2 bg-[#007AFF] text-white rounded-lg font-medium hover:bg-[#0051D5] transition-colors duration-200"
              >
                Повторить попытку
              </button>
            </div>
          </div>
        </div>
      ) : data ? (
        <>
          {data.funnel.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg border border-[#E5E5E7] p-12 text-center">
              <TrendingDown className="w-16 h-16 text-[#86868B] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[#1D1D1F] mb-2">
                Нет данных за выбранный период
              </h3>
              <p className="text-[#86868B]">
                Попробуйте выбрать другой период или убедитесь, что есть активность
              </p>
            </div>
          ) : (
            <>
              <InteractiveFunnelChart
                funnel={data.funnel}
                onStageClick={setSelectedStage}
              />

              {selectedStage && (
                <EmployeeDrillDown
                  stage={selectedStage}
                  employees={
                    selectedManager === 'all'
                      ? data.employeeConversions
                      : data.employeeConversions.filter((e) => e.employee_id === selectedManager)
                  }
                  onClose={() => setSelectedStage(null)}
                />
              )}
            </>
          )}
        </>
      ) : null}

      {!loading && !error && data?.sideFlow && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="bg-white rounded-2xl shadow-md border border-[#E5E5E7] p-6">
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-4">Отказы по этапам</h3>
            <div className="space-y-2">
              {data.sideFlow.refusals.byStage.map((item) => (
                <div key={item.stageId} className="flex items-center justify-between text-sm">
                  <span className="text-[#1D1D1F]">{item.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#86868B]">{item.count}</span>
                    <span className={`font-semibold ${item.rate > 20 ? 'text-[#FF3B30]' : 'text-green-600'}`}>
                      {item.rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-[#E5E5E7] p-6">
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-2">Главный KPI</h3>
            <p className="text-sm text-[#86868B] mb-4">1-й Zoom → Оплата</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-[#1D1D1F]">{data.northStarKpi?.value.toFixed(1)}%</p>
                <p className="text-xs text-[#86868B]">Цель: {data.northStarKpi?.target}%</p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  data.northStarKpi?.isOnTrack ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                }`}
              >
                {data.northStarKpi?.isOnTrack ? 'В норме' : 'Ниже цели'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {!loading && !error && data && data.funnel.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#1D1D1F] mb-2">
                Как пользоваться анализом воронки
              </h3>
              <ul className="space-y-2 text-sm text-[#86868B]">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>
                    <strong className="text-[#1D1D1F]">Нажмите на этап</strong> воронки для просмотра детализации по сотрудникам
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">•</span>
                  <span>
                    <strong className="text-[#1D1D1F]">Красные зоны</strong> — этапы с низкой конверсией, требующие внимания
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span>
                    <strong className="text-[#1D1D1F]">Зелёные зоны</strong> — этапы с хорошей конверсией (&gt;70%)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>
                    Используйте фильтры <strong className="text-[#1D1D1F]">TOP-3</strong> и{' '}
                    <strong className="text-[#1D1D1F]">BOTTOM-3</strong> для быстрого анализа производительности
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
