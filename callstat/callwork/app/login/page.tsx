'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true)
    
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.ok) {
      router.push('/dashboard')
    } else {
      alert('Неверный email или пароль')
    }
    
    setIsLoading(false)
  }

  const handleRegister = async (data: { email: string; password: string; name: string }) => {
    setIsLoading(true)
    
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (response.ok) {
      await handleLogin(data.email, data.password)
    } else {
      const error = await response.json()
      alert(error.error || 'Ошибка регистрации')
    }
    
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5F5F7] to-[#E5E5E7] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-[24px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[#1D1D1F] mb-2">
              Callwork
            </h1>
            <p className="text-[#86868B]">
              Система учёта статистики call-центра
            </p>
          </div>

          <div className="flex gap-2 mb-6 p-1 bg-[#F5F5F7] rounded-[12px]">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2.5 rounded-[8px] text-sm font-medium transition-all duration-200 ${
                activeTab === 'login'
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2.5 rounded-[8px] text-sm font-medium transition-all duration-200 ${
                activeTab === 'register'
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              Регистрация
            </button>
          </div>

          {activeTab === 'login' ? (
            <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
          ) : (
            <RegisterForm onSubmit={handleRegister} isLoading={isLoading} />
          )}
        </div>
      </motion.div>
    </div>
  )
}
