'use client'

import { memo, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Home, TrendingUp, BarChart, Trophy, Bell, LayoutDashboard } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { AlertBadge } from '@/components/alerts/AlertBadge'
import { motion } from 'framer-motion'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export const DashboardLayout = memo(function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/login' })
  }, [])

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Forecast', href: '/dashboard/forecast', icon: TrendingUp },
    { name: 'Funnel', href: '/dashboard/analytics/funnel', icon: BarChart },
    { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Trophy },
    {
      name: 'Alerts',
      href: '/dashboard/alerts',
      icon: Bell,
      badge: <AlertBadge />
    },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans selection:bg-[var(--primary)] selection:text-white transition-colors duration-300">
      {/* Floating Header */}
      <header className="sticky top-6 z-50 px-6 mb-8">
        <div className="max-w-7xl mx-auto glass-card rounded-[24px] h-[72px] flex items-center justify-between px-2 pl-6">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[var(--primary)]/30 group-hover:scale-105 transition-transform duration-300">
              C
            </div>
            <span className="text-xl font-bold tracking-tight text-[var(--foreground)]">Callwork</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-[var(--secondary)]/50 p-1.5 rounded-full border border-[var(--border)]">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${active
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-md border border-[var(--border)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]/50'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-[var(--primary)]' : ''}`} />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-1">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-4 pr-2">
            {/* TV Mode Button */}
            <Link
              href="/tv"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-[var(--primary)] text-sm font-medium hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/50 transition-all duration-300 group"
            >
              <LayoutDashboard className="w-4 h-4 group-hover:animate-pulse" />
              <span>TV Mode</span>
            </Link>

            {/* User Menu */}
            {session?.user && (
              <div className="flex items-center gap-4 pl-4 border-l border-[var(--border)]">
                <div className="flex items-center gap-3 cursor-pointer group">
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                      {session.user.name}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider mt-0.5">
                      {session.user.role === 'MANAGER' ? 'Manager' : 'Employee'}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] text-sm font-bold group-hover:border-[var(--primary)]/50 transition-colors">
                    {session.user.name?.charAt(0).toUpperCase()}
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-10 h-10 rounded-full bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] hover:border-[var(--danger)]/30 transition-all duration-300"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
})
