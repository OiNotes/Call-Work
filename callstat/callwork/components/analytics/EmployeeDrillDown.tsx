'use client'

import { memo, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingUp, TrendingDown, Award, AlertTriangle, Users, Filter } from 'lucide-react'

interface EmployeeConversion {
  employee_id: string
  employee_name: string
  stage: string
  count: number
  conversion_rate: number
}

interface EmployeeDrillDownProps {
  stage: {
    stage: string
    count: number
    conversion_rate: number
    is_red_zone: boolean
  }
  employees: EmployeeConversion[]
  onClose: () => void
}

type FilterType = 'all' | 'top3' | 'bottom3'

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: { duration: 0.2 }
  }
}

const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (index: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: index * 0.05,
      duration: 0.2,
      ease: 'easeOut' as const
    }
  })
}

export const EmployeeDrillDown = memo(function EmployeeDrillDown({
  stage,
  employees,
  onClose
}: EmployeeDrillDownProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  // Фильтрация сотрудников по выбранному этапу
  const stageEmployees = useMemo(() => {
    return employees.filter(e => e.stage === stage.stage)
  }, [employees, stage.stage])

  // Применение фильтра
  const filteredEmployees = useMemo(() => {
    const sorted = [...stageEmployees].sort((a, b) => b.conversion_rate - a.conversion_rate)

    if (filter === 'top3') return sorted.slice(0, 3)
    if (filter === 'bottom3') return sorted.slice(-3).reverse()
    return sorted
  }, [stageEmployees, filter])

  // Статистика
  const stats = useMemo(() => {
    if (stageEmployees.length === 0) return { avgConversion: 0, topEmployee: null, totalEmployees: 0 }

    const avgConversion = stageEmployees.reduce((sum, e) => sum + e.conversion_rate, 0) / stageEmployees.length
    const topEmployee = [...stageEmployees].sort((a, b) => b.conversion_rate - a.conversion_rate)[0]

    return {
      avgConversion,
      topEmployee,
      totalEmployees: stageEmployees.length
    }
  }, [stageEmployees])

  const getPerformanceBadge = (conversionRate: number, avgRate: number) => {
    const diff = conversionRate - avgRate
    if (diff > 10) return { icon: Award, color: 'text-[#34C759]', bg: 'bg-green-50', label: 'Топ' }
    if (diff < -10) return { icon: AlertTriangle, color: 'text-[#FF3B30]', bg: 'bg-red-50', label: 'Низкий' }
    return { icon: Users, color: 'text-[#007AFF]', bg: 'bg-blue-50', label: 'Средний' }
  }

  return (
    <AnimatePresence>
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-[#E5E5E7] px-8 py-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-[#1D1D1F]">
                  {stage.stage}
                </h2>
                <p className="text-sm text-[#86868B] mt-1">
                  Детализация по сотрудникам
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5E7] flex items-center justify-center transition-colors duration-200"
              >
                <X className="w-5 h-5 text-[#86868B]" />
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-[#007AFF]" />
                  <span className="text-xs font-medium text-[#007AFF]">
                    Сотрудников
                  </span>
                </div>
                <p className="text-2xl font-semibold text-[#1D1D1F]">
                  {stats.totalEmployees}
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-[#34C759]" />
                  <span className="text-xs font-medium text-[#34C759]">
                    Средняя конверсия
                  </span>
                </div>
                <p className="text-2xl font-semibold text-[#1D1D1F]">
                  {stats.avgConversion.toFixed(1)}%
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-600">
                    Лучший результат
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#1D1D1F] truncate">
                  {stats.topEmployee?.employee_name || 'Нет данных'}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#86868B]" />
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  filter === 'all'
                    ? 'bg-[#007AFF] text-white shadow-md'
                    : 'bg-[#F5F5F7] text-[#86868B] hover:bg-[#E5E5E7]'
                }`}
              >
                Все сотрудники
              </button>
              <button
                onClick={() => setFilter('top3')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  filter === 'top3'
                    ? 'bg-[#34C759] text-white shadow-md'
                    : 'bg-[#F5F5F7] text-[#86868B] hover:bg-[#E5E5E7]'
                }`}
              >
                TOP-3
              </button>
              <button
                onClick={() => setFilter('bottom3')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  filter === 'bottom3'
                    ? 'bg-[#FF3B30] text-white shadow-md'
                    : 'bg-[#F5F5F7] text-[#86868B] hover:bg-[#E5E5E7]'
                }`}
              >
                BOTTOM-3
              </button>
            </div>
          </div>

          {/* Employee List */}
          <div className="px-8 py-6 overflow-y-auto max-h-[calc(90vh-320px)]">
            {filteredEmployees.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-[#86868B] mx-auto mb-4" />
                <p className="text-[#86868B]">Нет данных по сотрудникам</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEmployees.map((employee, index) => {
                  const badge = getPerformanceBadge(employee.conversion_rate, stats.avgConversion)
                  const Icon = badge.icon
                  const isAboveAverage = employee.conversion_rate > stats.avgConversion

                  return (
                    <motion.div
                      key={employee.employee_id}
                      custom={index}
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      className="group relative bg-white border border-[#E5E5E7] rounded-xl p-5 hover:shadow-lg hover:border-[#007AFF] transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          {/* Ranking Badge */}
                          <div className={`w-10 h-10 rounded-full ${badge.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-5 h-5 ${badge.color}`} />
                          </div>

                          {/* Employee Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-[#1D1D1F]">
                                {employee.employee_name}
                              </h3>
                              <span className={`px-2 py-1 rounded-md text-xs font-medium ${badge.bg} ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-sm text-[#86868B]">
                              Обработал: {employee.count.toLocaleString('ru-RU')} обращений
                            </p>
                          </div>
                        </div>

                        {/* Conversion Rate */}
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-2xl font-semibold text-[#1D1D1F]">
                              {employee.conversion_rate.toFixed(1)}%
                            </p>
                            <div className="flex items-center gap-1 justify-end mt-1">
                              {isAboveAverage ? (
                                <>
                                  <TrendingUp className="w-4 h-4 text-[#34C759]" />
                                  <span className="text-xs font-medium text-[#34C759]">
                                    +{(employee.conversion_rate - stats.avgConversion).toFixed(1)}%
                                  </span>
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="w-4 h-4 text-[#FF3B30]" />
                                  <span className="text-xs font-medium text-[#FF3B30]">
                                    {(employee.conversion_rate - stats.avgConversion).toFixed(1)}%
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4 h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${employee.conversion_rate}%` }}
                          transition={{ delay: index * 0.05 + 0.2, duration: 0.5 }}
                          className={`h-full rounded-full ${
                            employee.conversion_rate > stats.avgConversion
                              ? 'bg-gradient-to-r from-[#34C759] to-[#30D158]'
                              : 'bg-gradient-to-r from-[#FF3B30] to-[#FF453A]'
                          }`}
                        />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
})
