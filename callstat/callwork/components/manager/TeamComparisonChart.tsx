'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { motion } from 'framer-motion'

interface TeamComparisonProps {
  employeeStats: {
    deals: number
    sales: number
    bookedToZoom1: number
    pushToDeal: number
  }
  teamAverage: {
    deals: number
    sales: number
    bookedToZoom1: number
    pushToDeal: number
  }
}

export function TeamComparisonChart({ employeeStats, teamAverage }: TeamComparisonProps) {
  const data = [
    {
      metric: 'Сделки',
      employee: employeeStats.deals,
      team: teamAverage.deals
    },
    {
      metric: 'Запись → 1-й Zoom',
      employee: employeeStats.bookedToZoom1,
      team: teamAverage.bookedToZoom1
    },
    {
      metric: 'Дожим → Оплата',
      employee: employeeStats.pushToDeal,
      team: teamAverage.pushToDeal
    }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-2xl p-6 border"
    >
      <h3 className="text-lg font-semibold mb-4">Сравнение с командой</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="metric" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="employee"
              fill="#3b82f6"
              name="Сотрудник"
              radius={[8, 8, 0, 0]}
            />
            <Bar
              dataKey="team"
              fill="#94a3b8"
              name="Средняя по команде"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
