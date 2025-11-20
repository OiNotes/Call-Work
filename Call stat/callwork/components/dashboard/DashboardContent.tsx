'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PulseGrid } from '@/components/dashboard/PulseGrid'
import { FunnelChart } from '@/components/analytics/FunnelChart'
import { ManagersTable } from '@/components/analytics/ManagersTable'
import { RedZoneAlerts } from '@/components/analytics/RedZoneAlerts'
import { PerformanceTrendChart } from '@/components/charts/PerformanceTrendChart'
import { calculateManagerStats, getFunnelData, ManagerStats, analyzeRedZones } from '@/lib/analytics/funnel'
import { Calendar } from 'lucide-react'
import { calculateFullFunnel, NorthStarKpi } from '@/lib/calculations/funnel'

interface User {
  id: string
  name: string
  email: string
  role: 'MANAGER' | 'EMPLOYEE'
}

interface DashboardContentProps {
  user: User
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function DashboardContent({ user }: DashboardContentProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [managerStats, setManagerStats] = useState<ManagerStats[]>([])
  const [teamFunnel, setTeamFunnel] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [teamStats, setTeamStats] = useState<any>(null)
  const [northStarKpi, setNorthStarKpi] = useState<NorthStarKpi | null>(null)
  const [rawEmployees, setRawEmployees] = useState<any[]>([])
  const [selectedManagerId, setSelectedManagerId] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<'thisMonth' | 'lastMonth' | 'week'>('thisMonth')
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
  })

  const getRangeByPreset = (preset: typeof datePreset) => {
    const now = new Date()
    if (preset === 'week') {
      const start = new Date()
      start.setDate(now.getDate() - 7)
      return { start, end: now }
    }
    if (preset === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start, end }
    }
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
  }

  const handleDatePresetChange = (preset: typeof datePreset) => {
    setDatePreset(preset)
    setDateRange(getRangeByPreset(preset))
  }

  const recomputeViews = (employeesList: any[], managerFilter = selectedManagerId) => {
    const filteredEmployees =
      managerFilter === 'all'
        ? employeesList
        : employeesList.filter((emp) => emp.id === managerFilter)

    const effectiveEmployees = filteredEmployees.length > 0 ? filteredEmployees : employeesList

    const processedStats = effectiveEmployees.map((emp: any) => {
      const stats = calculateManagerStats(emp.reports || [])
      return {
        id: emp.id,
        name: emp.name,
        ...stats,
      }
    })

    setManagerStats(processedStats)

    const teamReports = effectiveEmployees.flatMap((e: any) => e.reports || [])
    const tStats = calculateManagerStats(teamReports)
    setTeamStats(tStats)
    setTeamFunnel(getFunnelData(tStats))

    const { northStarKpi: teamNorthStar } = calculateFullFunnel({
      zoomBooked: tStats.zoomBooked,
      zoom1Held: tStats.zoom1Held,
      zoom2Held: tStats.zoom2Held,
      contractReview: tStats.contractReview,
      push: tStats.pushCount,
      deals: tStats.successfulDeals,
      sales: tStats.salesAmount,
      refusals: tStats.refusals,
      warming: tStats.warming,
    })
    setNorthStarKpi(teamNorthStar)

    const dailyMap = new Map<string, { date: string; sales: number; deals: number }>()
    teamReports.forEach((r: any) => {
      const d = new Date(r.date).toISOString().split('T')[0]
      if (!dailyMap.has(d)) {
        dailyMap.set(d, { date: d, sales: 0, deals: 0 })
      }
      const entry = dailyMap.get(d)!
      entry.sales += Number(r.monthlySalesAmount)
      entry.deals += r.successfulDeals
    })

    const finalTrend = Array.from(dailyMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((d) => ({
        ...d,
        date: new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
      }))
    setTrendData(finalTrend)

    const newAlerts: any[] = []
    processedStats.forEach((stat: ManagerStats) => {
      const issues = analyzeRedZones(stat)
      issues.forEach((issue) => {
        newAlerts.push({
          id: `${stat.id}-${issue.stage}`,
          type: issue.severity,
          title: `Проблема на этапе ${issue.stage}`,
          description: `${issue.metric} у сотрудника ${stat.name} составляет ${issue.value}% (Норма: ${issue.benchmark}%)`,
          managerName: stat.name,
        })
      })
    })

    if (tStats.successfulDeals === 0) {
      newAlerts.push({
        id: 'no-deals-team',
        type: 'critical',
        title: 'Отсутствие продаж',
        description: 'За выбранный период в команде не закрыто ни одной сделки.',
      })
    }

    setAlerts(newAlerts)
  }

  useEffect(() => {
    async function fetchData() {
      if (user.role !== 'MANAGER') return

      try {
        setLoading(true)

        const response = await fetch(
          `/api/employees?startDate=${dateRange.start.toISOString()}&endDate=${dateRange.end.toISOString()}`
        )
        const data = await response.json()
        const employeesList = data.employees || []
        setRawEmployees(employeesList)
        recomputeViews(employeesList, selectedManagerId)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user.role, dateRange.start, dateRange.end])

  useEffect(() => {
    if (rawEmployees.length === 0) return
    recomputeViews(rawEmployees, selectedManagerId)
  }, [selectedManagerId, rawEmployees])

  useEffect(() => {
    if (user.role !== 'MANAGER') {
      setLoading(false)
    }
  }, [user.role])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    )
  }

  if (user.role !== 'MANAGER') {
    return (
      <div className="glass-card p-8">
        <h2 className="text-2xl font-bold mb-2 text-[var(--foreground)]">Заполните дневной отчёт</h2>
        <p className="text-[var(--muted-foreground)] mb-4">
          Для сотрудников доступен личный кабинет отчётов. Данные автоматически попадут в аналитику.
        </p>
        <button
          onClick={() => router.push('/dashboard/report')}
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors"
        >
          Открыть форму отчёта
        </button>
      </div>
    )
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-12"
    >
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">
              Центр управления продажами
            </h1>
            <p className="text-[var(--muted-foreground)] mt-1">
              Оперативный контроль и аналитика
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <span className="text-xs text-[var(--muted-foreground)]">Фильтр по менеджеру</span>
              <select
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="all">Вся команда</option>
                {rawEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-[var(--muted)]/30 rounded-lg p-3 border border-[var(--border)] space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-xs text-[var(--muted-foreground)]">Период</span>
              </div>
              <div className="flex items-center gap-2">
                {(['thisMonth', 'lastMonth', 'week'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleDatePresetChange(preset)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      datePreset === preset
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-white text-[var(--muted-foreground)] border border-[var(--border)]'
                    }`}
                  >
                    {preset === 'thisMonth' && 'Этот месяц'}
                    {preset === 'lastMonth' && 'Прошлый месяц'}
                    {preset === 'week' && '7 дней'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                {dateRange.start.toLocaleDateString('ru-RU')} — {dateRange.end.toLocaleDateString('ru-RU')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* L1: Pulse Grid (Plan/Fact) */}
      {teamStats && (
        <PulseGrid
          stats={{
            ...teamStats,
            prevConversion: teamStats.totalConversion,
          }}
          northStarKpi={northStarKpi}
        />
      )}

      {/* L2: Management by Exception (Alerts) */}
      {alerts.length > 0 && (
        <motion.div variants={item}>
          <RedZoneAlerts alerts={alerts} />
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* L3: Team Funnel (Left Column) */}
        <div className="lg:col-span-1 space-y-8">
          <motion.div variants={item} className="glass-card p-8">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Воронка отдела</h2>
            <FunnelChart data={teamFunnel} />
          </motion.div>
        </div>

        {/* L4: Managers Efficiency (Right Column - Wider) */}
        <div className="lg:col-span-2 space-y-8">
          <motion.div variants={item} className="glass-card p-8">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Эффективность менеджеров</h2>
            <ManagersTable managers={managerStats} />
          </motion.div>
        </div>
      </div>

      {/* L5: Analytics & Dynamics (Bottom) - Only show if we have data */}
      {trendData.length > 0 && (
        <motion.div variants={item} className="glass-card p-8">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Динамика показателей</h2>
          <PerformanceTrendChart data={trendData} className="h-[300px]" />
        </motion.div>
      )}

    </motion.div>
  )
}
