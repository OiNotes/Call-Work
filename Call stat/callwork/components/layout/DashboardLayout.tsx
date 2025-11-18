'use client'

import { memo, useCallback } from 'react'
import { LogOut } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export const DashboardLayout = memo(function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession()

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/login' })
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-[#E5E5E7]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="text-2xl font-bold text-[#1D1D1F] transition-opacity duration-300">
            Callwork
          </div>

          {/* User Menu */}
          {session?.user && (
            <div className="flex items-center gap-4 transition-opacity duration-300">
              <div className="flex items-center gap-3 px-4 py-2 rounded-[12px] bg-[#F5F5F7]">
                <div className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center text-white text-sm font-semibold">
                  {session.user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium text-[#1D1D1F]">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-[#86868B]">
                    {session.user.role === 'MANAGER' ? 'Менеджер' : 'Сотрудник'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="p-2 rounded-[8px] text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#FF3B30] transition-colors"
                title="Выйти"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]">
          {children}
        </div>
      </main>
    </div>
  )
})
