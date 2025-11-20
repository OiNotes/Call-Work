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

  useEffect(() => {
    async function fetchData() {
      if (user.role !== 'MANAGER') return

      try {
        setLoading(true)
        const now = new Date()
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        const endDate = now

        const response = await fetch(
          `/api/employees?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        )
        const data = await response.json()

        // Process data
        const processedStats = data.employees.map((emp: any) => {
          const stats = calculateManagerStats(emp.reports || [])
          return {
            id: emp.id,
            name: emp.name,
            ...stats
          }
        })

        setManagerStats(processedStats)

        // Calculate Team Funnel
        const teamReports = data.employees.flatMap((e: any) => e.reports || [])
        const tStats = calculateManagerStats(teamReports)
        setTeamStats(tStats)
        setTeamFunnel(getFunnelData(tStats))

        // Calculate Trend Data
        const dailyMap = new Map()
        teamReports.forEach((r: any) => {
          const d = new Date(r.date).toISOString().split('T')[0]
          if (!dailyMap.has(d)) {
            dailyMap.set(d, { date: d, sales: 0, deals: 0 })
          }
          const entry = dailyMap.get(d)
          entry.sales += Number(r.monthlySalesAmount)
          entry.deals += r.successfulDeals
        })
        const finalTrend = Array.from(dailyMap.values())
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((d: any) => ({
            ...d,
            date: new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
          }))

        setTrendData(finalTrend)

        // Generate Alerts (L2)
        const newAlerts: any[] = []

        // 1. Check for low conversion
        processedStats.forEach((stat: ManagerStats) => {
          const issues = analyzeRedZones(stat)
          issues.forEach(issue => {
            newAlerts.push({
              id: `${stat.id}-${issue.stage}`,
              type: issue.severity,
              title: `Проблема на этапе ${issue.stage}`,
              description: `${issue.metric} у сотрудника ${stat.name} составляет ${issue.value}% (Норма: ${issue.benchmark}%)`,
              managerName: stat.name
            })
          })
        })

        // 2. Check for no deals (Global)
        if (tStats.successfulDeals === 0) {
          newAlerts.push({
            id: 'no-deals-team',
            type: 'critical',
            title: 'Отсутствие продаж',
            description: 'За выбранный период в команде не закрыто ни одной сделки.',
          })
        }

        setAlerts(newAlerts)

      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user.role])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
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
      <div className="flex items-end justify-between border-b border-[var(--border)] pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">
            Центр управления продажами
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Оперативный контроль и аналитика
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--muted)]/30 rounded-lg">
          <Calendar className="w-4 h-4 text-[var(--muted-foreground)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            {new Date().toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* L1: Pulse Grid (Plan/Fact) */}
      {teamStats && (
        <PulseGrid stats={{
          ...teamStats,
          prevConversion: 12 // Mock previous conversion for demo
        }} />
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
