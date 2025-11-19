'use client'

import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface EmployeeData {
  name: string
  deals: number
  sales: number
}

interface EmployeeComparisonChartProps {
  data: EmployeeData[]
}

const COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--danger)', 'var(--info)']

export const EmployeeComparisonChart = memo(function EmployeeComparisonChart({ data }: EmployeeComparisonChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          contentStyle={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            fontSize: '14px',
            color: 'var(--foreground)'
          }}
          itemStyle={{ color: 'var(--foreground)' }}
          formatter={(value: number) => [`${value} сделок`, 'Количество']}
        />
        <Bar dataKey="deals" radius={[6, 6, 6, 6]} barSize={32}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              className="transition-all duration-300 hover:opacity-80"
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})
