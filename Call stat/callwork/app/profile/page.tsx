'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TelegramCodeDisplay } from '@/components/auth/TelegramCodeDisplay'
import { motion } from 'framer-motion'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const [telegramCode, setTelegramCode] = useState<{ code: string; expiresAt: Date } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>
  }

  if (!session) {
    redirect('/login')
  }

  const generateCode = async () => {
    setIsGenerating(true)
    
    const response = await fetch('/api/telegram/generate-code', {
      method: 'POST',
    })

    if (response.ok) {
      const data = await response.json()
      setTelegramCode({
        code: data.code,
        expiresAt: new Date(data.expiresAt),
      })
    } else {
      alert('Ошибка генерации кода')
    }
    
    setIsGenerating(false)
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-[#1D1D1F]">Профиль</h1>

        {/* User Info Card */}
        <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5E7]">
          <h2 className="text-xl font-semibold text-[#1D1D1F] mb-4">
            Информация
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-[#86868B] mb-1">Имя</dt>
              <dd className="font-medium text-[#1D1D1F]">{session.user.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-[#86868B] mb-1">Email</dt>
              <dd className="font-medium text-[#1D1D1F]">{session.user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-[#86868B] mb-1">Роль</dt>
              <dd className="font-medium text-[#1D1D1F]">
                {session.user.role === 'MANAGER' ? 'Менеджер' : 'Сотрудник'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Telegram Integration Card */}
        <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5E7]">
          <h2 className="text-xl font-semibold text-[#1D1D1F] mb-4">
            Интеграция с Telegram
          </h2>
          
          {!telegramCode ? (
            <div className="text-center py-6">
              <p className="text-[#86868B] mb-4">
                Привяжите Telegram бот для отправки отчётов
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateCode}
                disabled={isGenerating}
                className="px-6 py-3 bg-[#007AFF] text-white rounded-[12px] font-medium hover:bg-[#0066D6] transition-colors disabled:bg-[#86868B]"
              >
                {isGenerating ? 'Генерация...' : 'Сгенерировать код'}
              </motion.button>
            </div>
          ) : (
            <TelegramCodeDisplay 
              code={telegramCode.code} 
              expiresAt={telegramCode.expiresAt}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
