'use client'

import { useState, memo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight } from 'lucide-react'

interface LoginFormProps {
  onSubmit: (email: string, password: string) => void
  isLoading?: boolean
}

export const LoginForm = memo(function LoginForm({ onSubmit, isLoading = false }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(email, password)
  }, [email, password, onSubmit])

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
  }, [])

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
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
      {/* Email Field */}
      <div className="relative">
        <label htmlFor="email" className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Email
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
            <Mail className="w-5 h-5" />
          </div>
          <input
            id="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            onFocus={handleEmailFocus}
            onBlur={handleBlur}
            required
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-all duration-200 outline-none ${focusedField === 'email'
                ? 'border-[var(--primary)] shadow-[0_0_0_3px_rgba(41,151,255,0.1)]'
                : 'border-[var(--border)] hover:border-[var(--primary)]'
              }`}
            placeholder="your@email.com"
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="relative">
        <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Пароль
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
            <Lock className="w-5 h-5" />
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            onFocus={handlePasswordFocus}
            onBlur={handleBlur}
            required
            className={`w-full pl-12 pr-4 py-3.5 rounded-[12px] border bg-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-all duration-200 outline-none ${focusedField === 'password'
                ? 'border-[var(--primary)] shadow-[0_0_0_3px_rgba(41,151,255,0.1)]'
                : 'border-[var(--border)] hover:border-[var(--primary)]'
              }`}
            placeholder="••••••••"
          />
        </div>
      </div>

      {/* Forgot Password Link */}
      <div className="flex justify-end">
        <button
          type="button"
          className="text-sm text-[var(--primary)] hover:underline transition-all duration-200"
        >
          Забыли пароль?
        </button>
      </div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isLoading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] font-medium text-[var(--primary-foreground)] transition-all duration-200 ${isLoading
            ? 'bg-[var(--muted)] cursor-not-allowed'
            : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-lg shadow-[var(--primary)]/30'
          }`}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>Войти</span>
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </motion.button>
    </form>
  )
})
