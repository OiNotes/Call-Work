'use client'

import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface ActivityData {
  day: string
  pzm: number
  vzm: number
  deals: number
}

interface WeeklyActivityChartProps {
  data: ActivityData[]
}

export const WeeklyActivityChart = memo(function WeeklyActivityChart({ data }: WeeklyActivityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E7" />
        <XAxis
          dataKey="day"
          tick={{ fill: '#86868B', fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#86868B', fontSize: 12 }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #E5E5E7',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
        <Legend
          verticalAlign="top"
          height={36}
          iconType="square"
        />
        <Bar dataKey="pzm" fill="#3B82F6" radius={[8, 8, 0, 0]} name="ПЗМ" />
        <Bar dataKey="vzm" fill="#8B5CF6" radius={[8, 8, 0, 0]} name="ВЗМ" />
        <Bar dataKey="deals" fill="#10B981" radius={[8, 8, 0, 0]} name="Сделки" />
      </BarChart>
    </ResponsiveContainer>
  )
})
