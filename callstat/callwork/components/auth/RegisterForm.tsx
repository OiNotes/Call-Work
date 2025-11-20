'use client'

import { useState, memo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, User, ArrowRight } from 'lucide-react'

interface RegisterFormProps {
  onSubmit: (data: { email: string; password: string; name: string }) => void
  isLoading?: boolean
}

export const RegisterForm = memo(function RegisterForm({ onSubmit, isLoading = false }: RegisterFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }, [formData, onSubmit])

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }))
  }, [])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, email: e.target.value }))
  }, [])

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, password: e.target.value }))
  }, [])

  const handleNameFocus = useCallback(() => {
    setFocusedField('name')
  }, [])

  const handleEmailFocus = useCallback(() => {
    setFocusedField('email')
  }, [])

  const handlePasswordFocus = useCallback(() => {
    setFocusedField('password')
  }, [])

  const handleBlur = useCallback(() => {
    setFocusedField(null)
  }, [])

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-5"
    >
      {/* Name Field */}
      <div className="relative">
        <label htmlFor="name" className="block text-sm font-medium text-[#1D1D1F] mb-2">
          Имя
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]">
            <User className="w-5 h-5" />
          </div>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={handleNameChange}
            onFocus={handleNameFocus}
            onBlur={handleBlur}
            required
            minLength={2}
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-white text-[#1D1D1F] placeholder:text-[#86868B] transition-all duration-200 outline-none ${
              focusedField === 'name'
                ? 'border-[#007AFF] shadow-[0_0_0_3px_rgba(0,122,255,0.1)]'
                : 'border-[#D1D1D6] hover:border-[#007AFF]'
            }`}
            placeholder="Иван Иванов"
          />
        </div>
      </div>

      {/* Email Field */}
      <div className="relative">
        <label htmlFor="email" className="block text-sm font-medium text-[#1D1D1F] mb-2">
          Email
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]">
            <Mail className="w-5 h-5" />
          </div>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={handleEmailChange}
            onFocus={handleEmailFocus}
            onBlur={handleBlur}
            required
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-white text-[#1D1D1F] placeholder:text-[#86868B] transition-all duration-200 outline-none ${
              focusedField === 'email'
                ? 'border-[#007AFF] shadow-[0_0_0_3px_rgba(0,122,255,0.1)]'
                : 'border-[#D1D1D6] hover:border-[#007AFF]'
            }`}
            placeholder="your@email.com"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="relative">
        <label htmlFor="password" className="block text-sm font-medium text-[#1D1D1F] mb-2">
          Пароль
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="password"
            type="password"
            value={formData.password}
            onChange={handlePasswordChange}
            onFocus={handlePasswordFocus}
            onBlur={handleBlur}
            required
            minLength={6}
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-white text-[#1D1D1F] placeholder:text-[#86868B] transition-all duration-200 outline-none ${
              focusedField === 'password'
                ? 'border-[#007AFF] shadow-[0_0_0_3px_rgba(0,122,255,0.1)]'
                : 'border-[#D1D1D6] hover:border-[#007AFF]'
            }`}
            placeholder="Минимум 6 символов"
          />
        </div>
        <p className="mt-1.5 text-xs text-[#86868B]">
          Используйте минимум 6 символов
        </p>
      </div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isLoading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] font-medium text-white transition-all duration-200 ${
          isLoading
            ? 'bg-[#86868B] cursor-not-allowed'
            : 'bg-[#007AFF] hover:bg-[#0066D6] active:bg-[#0052AD] shadow-[0_2px_8px_rgba(0,122,255,0.3)]'
        }`}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>Зарегистрироваться</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </motion.button>
    </form>
  )
})
