'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  delay?: number
}

// Animation config вынесены за пределы компонента
const ANIMATION_CONFIG = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  ease: [0.16, 1, 0.3, 1] as const,
  duration: 0.4,
}

export const StatCard = memo(function StatCard({ label, value, subtitle, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={ANIMATION_CONFIG.initial}
      animate={ANIMATION_CONFIG.animate}
      transition={{
        duration: ANIMATION_CONFIG.duration,
        delay,
        ease: ANIMATION_CONFIG.ease
      }}
      className="glass-card rounded-[12px] p-5 border border-[var(--border)] hover:shadow-lg transition-all duration-300"
    >
      <div className="flex flex-col gap-2">
        {/* Label */}
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
          {label}
        </p>

        {/* Value */}
        <h4 className="text-3xl font-semibold text-[var(--foreground)] tracking-tight">
          {value}
        </h4>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </motion.div>
  )
})
