'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { MetricBadge } from './MetricBadge'
import { formatMoney } from '@/lib/utils/format'

interface EmployeeStats {
  dealsClosedCount: number
  totalSales: number
  pzToVzmConversion: number
  vzmToDealConversion: number
  hasRedZone: boolean
  redZoneStage?: string
}

interface EmployeeCardProps {
  employee: {
    id: string
    name: string
    email: string
  }
  stats: EmployeeStats
  onClick: () => void
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  },
  hover: {
    y: -4,
    boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
    transition: { duration: 0.2 }
  }
}

export const EmployeeCard = memo(function EmployeeCard({ employee, stats, onClick }: EmployeeCardProps) {
  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0]
    }
    return name.charAt(0)
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      onClick={onClick}
      className="glass-card p-6 border border-[var(--border)] cursor-pointer transition-all hover:border-[var(--primary)]/30"
    >
      {/* Аватар и имя */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--info)] flex items-center justify-center text-white font-semibold text-lg shadow-md">
          {getInitials(employee.name)}
        </div>
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">{employee.name}</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            {stats.dealsClosedCount} сделок • {formatMoney(stats.totalSales)}
          </p>
        </div>
      </div>

      {/* Ключевые метрики */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <MetricBadge
          label="ПЗМ → ВЗМ"
          value={`${stats.pzToVzmConversion}%`}
          isGood={stats.pzToVzmConversion > 60}
        />
        <MetricBadge
          label="ВЗМ → Сделка"
          value={`${stats.vzmToDealConversion}%`}
          isGood={stats.vzmToDealConversion > 70}
        />
      </div>

      {/* Индикатор красной зоны */}
      {stats.hasRedZone && (
        <div className="flex items-center gap-2 text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4" />
          Требует внимания: низкая конверсия
        </div>
      )}
    </motion.div>
  )
})
