import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'

// Хранилище активных SSE соединений
const clients = new Set<ReadableStreamDefaultController>()

// Функция для отправки события всем подключённым клиентам
export function broadcastDeal(data: {
  employeeId: string
  employeeName: string
  amount: number
  dealsCount: number
}) {
  const message = `data: ${JSON.stringify(data)}\n\n`

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
    const _user = await requireAuth()

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
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }
}
