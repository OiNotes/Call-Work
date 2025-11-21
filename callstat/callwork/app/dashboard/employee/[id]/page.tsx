'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, TrendingUp, Target } from 'lucide-react'
import { FunnelChart } from '@/components/analytics/FunnelChart'
import { RedZoneAlerts } from '@/components/analytics/RedZoneAlerts'
import { calculateManagerStatsClient, getFunnelData, analyzeRedZones, BENCHMARKS } from '@/lib/analytics/funnel.client'
import { formatMoney } from '@/lib/utils/format'

interface EmployeePageProps {
  params: Promise<{ id: string }>
}

export default function EmployeePage({ params }: EmployeePageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const employeeId = resolvedParams.id

  const [range, setRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [stats, setStats] = useState<any>(null)
  const [employee, setEmployee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [funnelData, setFunnelData] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)

        // Fetch employee reports
        const reportsRes = await fetch(`/api/employees/${employeeId}/reports?limit=100`) // Fetch enough data
        const reportsData = await reportsRes.json()
        const reports = reportsData.reports || []

        // Fetch employee info
        const employeesRes = await fetch(`/api/employees`)
        const employeesData = await employeesRes.json()
        const emp = employeesData.employees?.find((e: any) => e.id === employeeId)
        setEmployee(emp)

        // Calculate Stats (client-side without DB access)
        const calculatedStats = calculateManagerStatsClient(reports)
        setStats(calculatedStats)

        // Calculate Funnel
        const funnel = getFunnelData(calculatedStats)
        setFunnelData(funnel)

        // Generate Alerts
        const issues = analyzeRedZones({ ...calculatedStats, id: employeeId, name: emp?.name || '' })
        const newAlerts = issues.map(issue => ({
          id: `${employeeId}-${issue.stage}`,
          type: issue.severity,
          title: `Проблема на этапе ${issue.stage}`,
          description: `${issue.metric} составляет ${issue.value}% (Норма: ${issue.benchmark}%)`,
        }))
        setAlerts(newAlerts)

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
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

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Назад к команде</span>
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-3xl font-semibold shadow-lg">
              {getInitials(employee.name)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">{employee.name}</h1>
              <p className="text-[var(--muted-foreground)]">Личная статистика</p>
            </div>
          </div>

          {/* Period Filter (Visual Only for MVP) */}
          <div className="flex bg-white rounded-lg p-1 border border-[var(--border)]">
            {(['week', 'month', 'quarter'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${range === r
                    ? 'bg-[var(--primary)] text-white shadow-sm'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                  }`}
              >
                {r === 'week' && 'Неделя'}
                {r === 'month' && 'Месяц'}
                {r === 'quarter' && 'Квартал'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Main Stats (2/3) */}
          <div className="lg:col-span-2 space-y-8">

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-2 text-[var(--muted-foreground)]">
                  <Target className="w-4 h-4" />
                  <span className="text-sm font-medium">Сделки</span>
                </div>
                <div className="text-3xl font-bold text-[var(--foreground)]">{stats.successfulDeals}</div>
              </div>
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-2 text-[var(--muted-foreground)]">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm font-medium">Выручка</span>
                </div>
                <div className="text-3xl font-bold text-[var(--foreground)]">{formatMoney(stats.salesAmount)}</div>
              </div>
            </div>

            {/* Personal Funnel */}
            <div className="glass-card p-8">
              <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Личная воронка</h2>
              <FunnelChart data={funnelData} />
            </div>
          </div>

          {/* Right Column: Analysis (1/3) */}
          <div className="space-y-8">
            {/* Red Zone Alerts */}
            <div className="glass-card p-6 border-l-4 border-l-[var(--danger)]">
              <RedZoneAlerts alerts={alerts} />
              {alerts.length === 0 && (
                <div className="text-center py-8 text-[var(--muted-foreground)]">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <p className="font-medium">Отличная работа!</p>
                  <p className="text-sm">Критических проблем не обнаружено</p>
                </div>
              )}
            </div>

            {/* Conversion Breakdown */}
            <div className="glass-card p-6">
              <h3 className="font-semibold mb-4">Конверсии</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">Запись → 1-й Zoom</span>
                  <span className={`font-mono font-bold ${stats.bookedToZoom1 < BENCHMARKS.bookedToZoom1 ? 'text-red-500' : 'text-green-600'}`}>
                    {stats.bookedToZoom1}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">1-й → 2-й Zoom</span>
                  <span className={`font-mono font-bold ${stats.zoom1ToZoom2 < BENCHMARKS.zoom1ToZoom2 ? 'text-red-500' : 'text-green-600'}`}>
                    {stats.zoom1ToZoom2}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">2-й Zoom → Договор</span>
                  <span className={`font-mono font-bold ${stats.zoom2ToContract < BENCHMARKS.zoom2ToContract ? 'text-orange-500' : 'text-green-600'}`}>
                    {stats.zoom2ToContract}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">Договор → Дожим</span>
                  <span className={`font-mono font-bold ${stats.contractToPush < BENCHMARKS.contractToPush ? 'text-orange-500' : 'text-green-600'}`}>
                    {stats.contractToPush}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)]/30 rounded-lg">
                  <span className="text-sm">Дожим → Оплата</span>
                  <span className={`font-mono font-bold ${stats.pushToDeal < BENCHMARKS.pushToDeal ? 'text-red-500' : 'text-green-600'}`}>
                    {stats.pushToDeal}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
