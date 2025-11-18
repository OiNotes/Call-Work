'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { KPICard } from '@/components/analytics/KPICard'
import { StatCard } from '@/components/analytics/StatCard'
import { EmployeeCard } from '@/components/manager/EmployeeCard'
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

export function DashboardContent({ user }: DashboardContentProps) {
  const router = useRouter()
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchEmployees() {
      if (user.role !== 'MANAGER') return
      
      try {
        setLoading(true)
        const now = new Date()
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1) // Начало месяца
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

  // Mock data - будет заменено на реальные данные из API
  const stats = {
    totalDeals: 48,
    totalSales: 125000,
    pzmConversion: 65.5,
    avgDeal: 2604,
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#1D1D1F] mb-2">
          Добро пожаловать, {user.name}!
        </h1>
        <p className="text-[#86868B]">
          Статистика за последние 30 дней
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Закрыто сделок"
          value={stats.totalDeals}
          change={12.5}
          icon={<TrendingUp className="w-5 h-5" />}
          subtitle="vs прошлый месяц"
        />
        <KPICard
          title="Сумма продаж"
          value={`${stats.totalSales.toLocaleString('ru-RU')} ₽`}
          change={8.3}
          icon={<DollarSign className="w-5 h-5" />}
          subtitle="общий доход"
        />
        <KPICard
          title="Конверсия ПЗМ"
          value={`${stats.pzmConversion}%`}
          change={-2.1}
          icon={<Phone className="w-5 h-5" />}
          subtitle="эффективность"
        />
        <KPICard
          title="Средний чек"
          value={`${stats.avgDeal.toLocaleString('ru-RU')} ₽`}
          change={5.7}
          icon={<Users className="w-5 h-5" />}
          subtitle="на сделку"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="ПЗМ запланировано" value="127" delay={0} />
        <StatCard label="ПЗМ проведено" value="83" delay={0.1} />
        <StatCard label="ВЗМ проведено" value="52" delay={0.2} />
        <StatCard label="Отказы" value="31" delay={0.3} />
      </div>

      {/* Placeholder for Charts */}
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5E7]">
        <h3 className="text-lg font-semibold text-[#1D1D1F] mb-4">
          График продаж
        </h3>
        <div className="h-64 flex items-center justify-center text-[#86868B]">
          График будет добавлен позже
        </div>
      </div>

      {/* Секция команды - только для менеджеров */}
      {user.role === 'MANAGER' && (
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-[#1D1D1F]">Команда</h2>
            {employees.length > 0 && (
              <p className="text-sm text-[#86868B]">
                {employees.length} {employees.length === 1 ? 'сотрудник' : 'сотрудников'}
              </p>
            )}
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            <div className="bg-white rounded-[16px] p-8 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5E7] text-center">
              <p className="text-[#86868B]">Нет данных о сотрудниках</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
