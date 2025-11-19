'use client'

import { memo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  date: string
  sales: number
  deals: number
}

interface TeamSalesChartProps {
  data: DataPoint[]
}

export const TeamSalesChart = memo(function TeamSalesChart({ data }: TeamSalesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
        />
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
          formatter={(value: number) => [`${value.toLocaleString('ru-RU')} ₽`, 'Продажи']}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="var(--primary)"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorSales)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})
