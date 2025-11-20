'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'

export function VirtualGong() {
  useEffect(() => {
    // Только в production включаем SSE для уведомлений о сделках
    if (process.env.NODE_ENV === 'development') {
      return // В dev режиме не подключаемся к SSE
    }

    let eventSource: EventSource | null = null

    try {
      eventSource = new EventSource('/api/sse/deals')

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Toast notification
          toast.success(
            `🎉 ${data.employeeName} закрыл ${data.dealsCount} ${pluralize(data.dealsCount)} на ${formatMoney(data.amount)}!`,
            { duration: 5000 }
          )

          // Confetti
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FFD700', '#FFA500', '#FF6B00']
          })
        } catch (error) {
          // Quietly ignore parse errors
        }
      }

      eventSource.onerror = () => {
        // Quietly close connection on error
        eventSource?.close()
      }
    } catch (error) {
      // Quietly ignore EventSource creation errors
    }

    return () => {
      eventSource?.close()
    }
  }, [])

  return null // Невидимый компонент
}

function pluralize(count: number) {
  if (count === 1) return 'сделку'
  if (count >= 2 && count <= 4) return 'сделки'
  return 'сделок'
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(value)
}
