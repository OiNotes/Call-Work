'use client'

import { Copy, Check, Clock } from 'lucide-react'
import { useState, useEffect, memo, useCallback } from 'react'

interface TelegramCodeDisplayProps {
  code: string
  expiresAt?: Date
}

export const TelegramCodeDisplay = memo(function TelegramCodeDisplay({ code, expiresAt }: TelegramCodeDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')

  useEffect(() => {
    if (!expiresAt) return

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const expiry = new Date(expiresAt).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setTimeLeft('Истёк')
        clearInterval(interval)
      } else {
        const minutes = Math.floor(diff / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="bg-gradient-to-br from-[#007AFF] to-[#0066D6] rounded-[16px] p-8 text-white transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
      <div className="text-center space-y-6">
        {/* Title */}
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Код для привязки Telegram
          </h3>
          <p className="text-sm text-white/80">
            Используйте этот код в боте
          </p>
        </div>

        {/* Code Display */}
        <div
          className="bg-white/10 backdrop-blur-sm rounded-[12px] p-6 cursor-pointer transition-transform duration-200 hover:scale-102 active:scale-98"
          onClick={handleCopy}
        >
          <div className="text-5xl font-bold tracking-wider mb-3">
            {code}
          </div>
          
          <button className="inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white transition-all duration-200 active:scale-95">
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Скопировано!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Нажмите чтобы скопировать</span>
              </>
            )}
          </button>
        </div>

        {/* Timer */}
        {timeLeft && (
          <div className="flex items-center justify-center gap-2 text-sm text-white/80">
            <Clock className="w-4 h-4" />
            <span>Действителен: {timeLeft}</span>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white/5 rounded-[12px] p-4 text-left">
          <p className="text-sm text-white/90 font-medium mb-3">
            Как использовать:
          </p>
          <ol className="space-y-2 text-sm text-white/80">
            <li className="flex gap-2">
              <span className="font-semibold text-white">1.</span>
              <span>Откройте бота @CallworkBot в Telegram</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-white">2.</span>
              <span>Отправьте команду /register</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-white">3.</span>
              <span>Введите этот код</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
})
