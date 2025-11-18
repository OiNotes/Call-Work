'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, TrendingUp, Users, Target } from 'lucide-react'
import { KPICard } from '@/components/analytics/KPICard'
import { RedZoneAnalysis } from '@/components/manager/RedZoneAnalysis'
import { FunnelChartWithAnalysis } from '@/components/manager/FunnelChartWithAnalysis'
import { TrendChart } from '@/components/manager/TrendChart'
import { ReportsTable } from '@/components/manager/ReportsTable'
import { analyzeRedZones } from '@/lib/analytics/recommendations'
import { formatMoney, formatDateShort } from '@/lib/utils/format'

interface EmployeePageProps {
  params: Promise<{ id: string }>
}

export default function EmployeePage({ params }: EmployeePageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const employeeId = resolvedParams.id
  
  const [range, setRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [stats, setStats] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        
        // Загружаем статистику работника
        const statsRes = await fetch(`/api/employees/${employeeId}/stats?range=${range}`)
        const statsData = await statsRes.json()
        setStats(statsData)
        
        // Загружаем отчёты
        const reportsRes = await fetch(`/api/employees/${employeeId}/reports?limit=10`)
        const reportsData = await reportsRes.json()
        setReports(reportsData.reports || [])
        
        // Загружаем инфо о работнике (из списка employees или отдельного endpoint)
        const employeesRes = await fetch(`/api/employees`)
        const employeesData = await employeesRes.json()
        const emp = employeesData.employees?.find((e: any) => e.id === employeeId)
        setEmployee(emp)
        
      } catch (error) {
        console.error('Error fetching employee data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [employeeId, range])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  if (!stats || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Данные не найдены</p>
          <button 
            onClick={() => router.back()} 
            className="mt-4 text-blue-600 hover:underline"
          >
            Вернуться назад
          </button>
        </div>
      </div>
    )
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0]
    }
    return name.charAt(0)
  }

  const getRangeName = (r: string) => {
    const names: Record<string, string> = {
      week: 'последнюю неделю',
      month: 'последний месяц',
      quarter: 'последний квартал',
      year: 'последний год',
    }
    return names[r] || 'выбранный период'
  }

  // Анализ красных зон
  const redZones = analyzeRedZones({
    pzmConversion: stats.stats.pzmConversion,
    pzToVzmConversion: stats.stats.pzToVzmConversion,
    vzmToDealConversion: stats.stats.vzmToDealConversion,
    teamAverage: stats.teamAverageConversions,
  })

  // Данные для графика трендов (последние 7 дней из отчётов)
  const trendData = reports.slice(0, 7).reverse().map((report) => ({
    date: new Date(report.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
    sales: Number(report.monthlySalesAmount),
    deals: report.successfulDeals,
  }))

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Кнопка назад */}
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Назад к команде
        </button>

        {/* Профиль работника */}
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-3xl font-semibold">
            {getInitials(employee.name)}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{employee.name}</h1>
            <p className="text-gray-500">Статистика за {getRangeName(range)}</p>
          </div>
        </div>

        {/* Фильтр периода */}
        <div className="flex gap-2 mb-8">
          {(['week', 'month', 'quarter', 'year'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                range === r 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {r === 'week' && 'Неделя'}
              {r === 'month' && 'Месяц'}
              {r === 'quarter' && 'Квартал'}
              {r === 'year' && 'Год'}
            </button>
          ))}
        </div>

        {/* Grid метрик */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Закрыто сделок"
            value={stats.stats.successfulDeals.toString()}
            change={0}
            icon={<Target className="w-5 h-5" />}
            subtitle="за период"
          />
          <KPICard
            title="Сумма продаж"
            value={formatMoney(stats.stats.monthlySalesAmount)}
            change={0}
            icon={<DollarSign className="w-5 h-5" />}
            subtitle="общий доход"
          />
          <KPICard
            title="Конверсия ПЗМ"
            value={`${stats.stats.pzmConversion}%`}
            change={0}
            icon={<TrendingUp className="w-5 h-5" />}
            subtitle="явка на встречи"
          />
          <KPICard
            title="Средний чек"
            value={formatMoney(stats.stats.avgCheck)}
            change={0}
            icon={<Users className="w-5 h-5" />}
            subtitle="на сделку"
          />
        </div>

        {/* Воронка продаж */}
        <div className="bg-white rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Воронка продаж</h2>
          <FunnelChartWithAnalysis data={{
            zoomAppointments: stats.stats.zoomAppointments,
            pzmConducted: stats.stats.pzmConducted,
            vzmConducted: stats.stats.vzmConducted,
            successfulDeals: stats.stats.successfulDeals,
          }} />
        </div>

        {/* Анализ красных зон */}
        <RedZoneAnalysis redZones={redZones} />

        {/* График динамики */}
        {trendData.length > 0 && (
          <div className="bg-white rounded-2xl p-6 mt-8">
            <h2 className="text-xl font-semibold mb-6">Динамика продаж</h2>
            <TrendChart data={trendData} />
          </div>
        )}

        {/* Таблица отчётов */}
        <div className="bg-white rounded-2xl p-6 mt-8">
          <h2 className="text-xl font-semibold mb-6">Последние отчёты</h2>
          <ReportsTable reports={reports} />
        </div>
      </div>
    </div>
  )
}
