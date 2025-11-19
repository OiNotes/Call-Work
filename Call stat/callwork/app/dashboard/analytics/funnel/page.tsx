'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, TrendingDown, AlertCircle, ArrowLeft } from 'lucide-react'
import { InteractiveFunnelChart } from '@/components/analytics/InteractiveFunnelChart'
import { EmployeeDrillDown } from '@/components/analytics/EmployeeDrillDown'
import { useRouter } from 'next/navigation'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'
import { ru } from 'date-fns/locale'

interface FunnelStage {
  stage: string
  count: number
  conversion_rate: number
  is_red_zone: boolean
}

interface EmployeeConversion {
  employee_id: number
  employee_name: string
  stage: string
  count: number
  conversion_rate: number
}

interface FunnelData {
  funnel: FunnelStage[]
  employeeConversions: EmployeeConversion[]
}

type DatePreset = 'today' | 'week' | 'month' | 'custom'

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
  const [datePreset, setDatePreset] = useState<DatePreset>('month')
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  })

  useEffect(() => {
    fetchFunnelData()
  }, [dateRange])

  const updateDatePreset = (preset: DatePreset) => {
    setDatePreset(preset)
    const now = new Date()

    switch (preset) {
      case 'today':
        setDateRange({
          start: new Date(now.setHours(0, 0, 0, 0)),
          end: new Date(now.setHours(23, 59, 59, 999))
        })
        break
      case 'week':
        setDateRange({
          start: subDays(now, 7),
          end: now
        })
        break
      case 'month':
        setDateRange({
          start: startOfMonth(now),
          end: endOfMonth(now)
        })
        break
    }
  }

  async function fetchFunnelData() {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString()
      })

      const res = await fetch(`/api/analytics/funnel?${params}`)

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Не удалось загрузить данные воронки')
      }

      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Failed to fetch funnel:', err)
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
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

          {/* Date Range Picker */}
          <div className="bg-white rounded-2xl p-4 shadow-md border border-[#E5E5E7]">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-[#007AFF]" />
              <span className="text-sm font-semibold text-[#1D1D1F]">Период</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateDatePreset('today')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  datePreset === 'today'
                    ? 'bg-[#007AFF] text-white shadow-md'
                    : 'bg-[#F5F5F7] text-[#86868B] hover:bg-[#E5E5E7]'
                }`}
              >
                Сегодня
              </button>
              <button
                onClick={() => updateDatePreset('week')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  datePreset === 'week'
                    ? 'bg-[#007AFF] text-white shadow-md'
                    : 'bg-[#F5F5F7] text-[#86868B] hover:bg-[#E5E5E7]'
                }`}
              >
                Неделя
              </button>
              <button
                onClick={() => updateDatePreset('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  datePreset === 'month'
                    ? 'bg-[#007AFF] text-white shadow-md'
                    : 'bg-[#F5F5F7] text-[#86868B] hover:bg-[#E5E5E7]'
                }`}
              >
                Месяц
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-[#E5E5E7]">
              <p className="text-xs text-[#86868B]">
                {format(dateRange.start, 'd MMMM yyyy', { locale: ru })} -{' '}
                {format(dateRange.end, 'd MMMM yyyy', { locale: ru })}
              </p>
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
                  employees={data.employeeConversions}
                  onClose={() => setSelectedStage(null)}
                />
              )}
            </>
          )}
        </>
      ) : null}

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
