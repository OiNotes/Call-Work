'use client'

import { ForecastTabs } from '@/components/forecast/ForecastTabs'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export default function ForecastLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Sticky Floating Toolbar */}
        <div className="sticky top-[104px] z-40 -mx-6 px-6 py-4 bg-[var(--background)]/90 backdrop-blur-xl border-b border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300">
          
          {/* Title & Back */}
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard"
              className="p-2 bg-[var(--secondary)]/50 hover:bg-[var(--secondary)] rounded-xl transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                Прогнозы
              </h1>
              <p className="text-xs text-[var(--muted-foreground)]">
                Планирование и моделирование
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-shrink-0">
            <ForecastTabs />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="min-h-screen"
        >
          {children}
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
