'use client'

import { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon?: React.ReactNode
  subtitle?: string
}

// Вынесли variants за пределы компонента (не пересоздаются)
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  hover: { 
    y: -4,
    transition: { duration: 0.2 }
  }
}

// ✅ React.memo для предотвращения ненужных ре-рендеров
export const KPICard = memo(function KPICard({ 
  title, 
  value, 
  change, 
  icon, 
  subtitle 
}: KPICardProps) {
  // ✅ useMemo для кэширования вычислений
  const isPositive = useMemo(
    () => change !== undefined && change >= 0, 
    [change]
  )

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="relative group"
    >
      <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5E7] transition-shadow duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-[#86868B] mb-1">
              {title}
            </p>
          </div>
          {icon && (
            <div className="w-10 h-10 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[#007AFF]">
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-3">
          <h3 className="text-4xl font-semibold text-[#1D1D1F] tracking-tight">
            {value}
          </h3>
        </div>

        {/* Footer - ✅ убрали motion.div для производительности */}
        <div className="flex items-center justify-between">
          {subtitle && (
            <p className="text-sm text-[#86868B]">
              {subtitle}
            </p>
          )}
          
          {change !== undefined && (
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                isPositive ? 'text-[#34C759]' : 'text-[#FF3B30]'
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>

        {/* Hover effect border */}
        <div className="absolute inset-0 rounded-[16px] border-2 border-[#007AFF] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    </motion.div>
  )
})
