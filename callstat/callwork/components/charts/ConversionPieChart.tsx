'use client'

import { memo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface ConversionData {
  name: string
  value: number
  [key: string]: any // для совместимости с Recharts ChartDataInput
}

interface ConversionPieChartProps {
  data: ConversionData[]
}

const COLORS = ['var(--success)', 'var(--primary)', 'var(--warning)', 'var(--danger)']

export const ConversionPieChart = memo(function ConversionPieChart({ data }: ConversionPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-lg)',
            fontSize: '14px',
            color: 'var(--foreground)'
          }}
          itemStyle={{ color: 'var(--foreground)' }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          formatter={(value) => <span className="text-sm text-[var(--foreground)] font-medium ml-1">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
})
