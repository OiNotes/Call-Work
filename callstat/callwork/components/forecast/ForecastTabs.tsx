'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'

export function ForecastTabs() {
  const pathname = usePathname()
  const { data: session } = useSession()
  
  const isManager = session?.user?.role === 'MANAGER'

  // Tabs configuration
  const tabs = [
    ...(isManager ? [{
      name: 'Прогноз отдела',
      path: '/dashboard/forecast/department',
      id: 'department'
    }] : []),
    {
      name: 'Прогноз дохода',
      path: '/dashboard/forecast/income',
      id: 'income'
    }
  ]

  return (
    <div className="flex space-x-1 bg-[var(--secondary)] p-1 rounded-xl w-fit">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path
        
        return (
          <Link
            key={tab.id}
            href={tab.path}
            className="relative px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2"
          >
            {isActive && (
              <motion.div
                layoutId="active-forecast-tab"
                className="absolute inset-0 bg-white shadow-sm rounded-lg border border-gray-200/50"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className={`relative z-10 ${isActive ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
              {tab.name}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
