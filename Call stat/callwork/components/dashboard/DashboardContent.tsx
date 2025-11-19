'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { KPICard } from '@/components/analytics/KPICard'
import { StatCard } from '@/components/analytics/StatCard'
import { EmployeeCard } from '@/components/manager/EmployeeCard'
import { TeamSalesChart } from '@/components/charts/TeamSalesChart'
import { EmployeeComparisonChart } from '@/components/charts/EmployeeComparisonChart'
import { ConversionPieChart } from '@/components/charts/ConversionPieChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { TrendingUp, Users, Phone, DollarSign } from 'lucide-react'

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
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Animated counter hook logic (simplified)
  const useCounter = (end: number, duration = 2000) => {
    const [count, setCount] = useState(0)
    useEffect(() => {
      let startTime: number
      let animationFrame: number

      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime
        const progress = (currentTime - startTime) / duration

        if (progress < 1) {
          setCount(Math.floor(end * progress))
          animationFrame = requestAnimationFrame(animate)
        } else {
          setCount(end)
        }
      }

      animationFrame = requestAnimationFrame(animate)
      return () => cancelAnimationFrame(animationFrame)
    }, [end, duration])
    return count
  }

  useEffect(() => {
    async function fetchEmployees() {
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
        setEmployees(data.employees || [])
      } catch (error) {
        console.error('Error fetching employees:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEmployees()
  }, [user.role])

  // Mock data
  const stats = {
    totalDeals: 48,
    totalSales: 125000,
    pzmConversion: 65.5,
    avgDeal: 2604,
  }

  const animatedSales = useCounter(stats.totalSales)
  const animatedDeals = useCounter(stats.totalDeals)

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Welcome Section */}
      <motion.div variants={item} className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[var(--foreground)] mb-2 tracking-tight">
            Good morning, <span className="text-gradient-blue">{user.name}</span>
          </h1>
          <p className="text-[var(--muted-foreground)] text-lg">
            Your command center is ready.
          </p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-sm text-[var(--muted-foreground)] font-medium uppercase tracking-wider">Current Month</p>
          <p className="text-2xl font-mono text-[var(--foreground)]">{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
      </motion.div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[minmax(180px,auto)]">

        {/* Primary KPI - Sales (Large Box) */}
        <motion.div variants={item} className="md:col-span-2 lg:col-span-2 row-span-2 glass-card p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-[var(--muted-foreground)] font-medium mb-1">Total Revenue</p>
              <h2 className="text-5xl font-bold text-[var(--foreground)] tracking-tight font-mono">
                {animatedSales.toLocaleString('ru-RU')} <span className="text-2xl text-[var(--muted-foreground)]">₽</span>
              </h2>
            </div>
            <div className="bg-[var(--primary)]/10 p-3 rounded-2xl">
              <DollarSign className="w-8 h-8 text-[var(--primary)]" />
            </div>
          </div>

          <div className="h-[200px] w-full -ml-4">
            <TeamSalesChart
              data={[
                { date: '15 Nov', sales: 125000, deals: 12 },
                { date: '16 Nov', sales: 98000, deals: 9 },
                { date: '17 Nov', sales: 142000, deals: 14 },
                { date: '18 Nov', sales: 178000, deals: 16 },
              ]}
            />
          </div>

          <div className="absolute bottom-6 right-8 flex items-center gap-2 text-[var(--success)] bg-[var(--success)]/10 px-3 py-1 rounded-full text-sm font-medium">
            <TrendingUp className="w-4 h-4" />
            <span>+8.3% vs last month</span>
          </div>
        </motion.div>

        {/* Secondary KPI - Deals */}
        <motion.div variants={item} className="glass-card p-6 flex flex-col justify-between group hover:border-[var(--primary)]/30 transition-colors">
          <div className="flex justify-between items-start">
            <p className="text-[var(--muted-foreground)] font-medium">Deals Closed</p>
            <TrendingUp className="w-5 h-5 text-[var(--success)]" />
          </div>
          <div>
            <h3 className="text-4xl font-bold text-[var(--foreground)] font-mono mb-2">{animatedDeals}</h3>
            <p className="text-sm text-[var(--success)]">+12.5% growth</p>
          </div>
        </motion.div>

        {/* Secondary KPI - Conversion */}
        <motion.div variants={item} className="glass-card p-6 flex flex-col justify-between group hover:border-[var(--primary)]/30 transition-colors">
          <div className="flex justify-between items-start">
            <p className="text-[var(--muted-foreground)] font-medium">Conversion</p>
            <Phone className="w-5 h-5 text-[var(--warning)]" />
          </div>
          <div>
            <h3 className="text-4xl font-bold text-[var(--foreground)] font-mono mb-2">{stats.pzmConversion}%</h3>
            <p className="text-sm text-[var(--danger)]">-2.1% decrease</p>
          </div>
        </motion.div>

        {/* Activity Feed (Tall Box) */}
        <motion.div variants={item} className="md:col-span-1 lg:col-span-1 row-span-2 glass-card p-0 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--foreground)]">Live Activity</h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <ActivityFeed />
          </div>
        </motion.div>

        {/* Employee Comparison (Wide Box) */}
        <motion.div variants={item} className="md:col-span-2 lg:col-span-2 glass-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-[var(--foreground)]">Top Performers</h3>
            <button className="text-xs text-[var(--primary)] hover:text-[var(--foreground)] transition-colors">View All</button>
          </div>
          <div className="h-[200px]">
            <EmployeeComparisonChart
              data={employees.slice(0, 5).map(emp => ({
                name: emp.name.split(' ')[0],
                deals: emp.stats.successfulDeals,
                sales: emp.stats.monthlySalesAmount
              }))}
            />
          </div>
        </motion.div>

        {/* Conversion Pie (Square Box) */}
        <motion.div variants={item} className="md:col-span-1 lg:col-span-1 glass-card p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-4">Efficiency</h3>
          <div className="h-[180px]">
            <ConversionPieChart
              data={[
                { name: 'High', value: employees.filter(e => e.stats.vzmToDealConversion > 80).length },
                { name: 'Medium', value: employees.filter(e => e.stats.vzmToDealConversion >= 60 && e.stats.vzmToDealConversion <= 80).length },
                { name: 'Low', value: employees.filter(e => e.stats.vzmToDealConversion >= 40 && e.stats.vzmToDealConversion < 60).length },
                { name: 'Critical', value: employees.filter(e => e.stats.vzmToDealConversion < 40).length },
              ]}
            />
          </div>
        </motion.div>

      </div>

      {/* Team Section (Manager Only) */}
      {user.role === 'MANAGER' && (
        <motion.div variants={item} className="pt-8 border-t border-[var(--border)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[var(--foreground)]">Team Overview</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            </div>
          ) : employees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employees.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={{
                    id: employee.id,
                    name: employee.name,
                    email: employee.email,
                  }}
                  stats={{
                    dealsClosedCount: employee.stats.successfulDeals,
                    totalSales: employee.stats.monthlySalesAmount,
                    pzToVzmConversion: employee.stats.pzToVzmConversion,
                    vzmToDealConversion: employee.stats.vzmToDealConversion,
                    hasRedZone: employee.stats.hasRedZone,
                  }}
                  onClick={() => router.push(`/dashboard/employee/${employee.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="text-[var(--muted-foreground)]">No team members found</p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
