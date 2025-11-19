import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'

// Хранилище активных SSE соединений
const clients = new Set<ReadableStreamDefaultController>()

// Функция для отправки активности всем подключённым клиентам
export function broadcastActivity(data: {
  type: 'deal' | 'report' | 'alert'
  message: string
  details?: string
  userId: string
  userName: string
}) {
  const activity = {
    ...data,
    timestamp: new Date().toISOString(),
    id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  const message = `data: ${JSON.stringify(activity)}\n\n`
  
  clients.forEach(controller => {
    try {
      controller.enqueue(new TextEncoder().encode(message))
    } catch (error) {
      console.error('SSE broadcast error:', error)
      clients.delete(controller)
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const stream = new ReadableStream({
      start(controller) {
        // Добавить клиента в список
        clients.add(controller)

        // Отправить initial heartbeat
        controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))

        // Периодический heartbeat (каждые 30 секунд)
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))
          } catch {
            clearInterval(heartbeatInterval)
            clients.delete(controller)
          }
        }, 30000)

        // Очистка при закрытии соединения
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval)
          clients.delete(controller)
          controller.close()
        })
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  } catch (error) {
    return new Response('Unauthorized', { status: 401 })
  }
}
