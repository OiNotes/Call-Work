'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertCard } from '@/components/alerts/AlertCard'
import { Bell, BellOff, CheckCheck } from 'lucide-react'

interface Alert {
  id: string
  type: 'NO_REPORTS' | 'LOW_CONVERSION' | 'NO_DEALS' | 'BEHIND_PACE'
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  description: string
  isRead: boolean
  createdAt: string
  user?: {
    id: string
    name: string
  }
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [severityFilter, setSeverityFilter] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === 'unread') params.set('isRead', 'false')
      if (severityFilter) params.set('severity', severityFilter)

      const res = await fetch(`/api/alerts?${params}`)
      const data = await res.json()

      setAlerts(data.alerts)
      setUnreadCount(data.unreadCount)
    } catch (error) {
      console.error('Failed to fetch alerts:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, severityFilter])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  async function markAsRead(id: string) {
    try {
      await fetch(`/api/alerts/${id}/read`, { method: 'PATCH' })
      setAlerts(alerts.map((a) => a.id === id ? { ...a, isRead: true } : a))
      setUnreadCount(Math.max(0, unreadCount - 1))
    } catch (error) {
      console.error('Failed to mark alert as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      await fetch('/api/alerts', { method: 'POST' })
      setAlerts(alerts.map((a) => ({ ...a, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'unread' && alert.isRead) return false
    if (severityFilter && alert.severity !== severityFilter) return false
    return true
  })

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="w-8 h-8" />
            Уведомления
          </h1>
          {unreadCount > 0 && (
            <p className="text-gray-600 mt-2">
              {unreadCount} непрочитанных
            </p>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Отметить все прочитанными
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {/* Status filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              filter === 'unread'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Непрочитанные {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {/* Severity filter */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setSeverityFilter(null)}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              !severityFilter
                ? 'bg-gray-700 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Все уровни
          </button>
          <button
            onClick={() => setSeverityFilter('CRITICAL')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              severityFilter === 'CRITICAL'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Критичные
          </button>
          <button
            onClick={() => setSeverityFilter('WARNING')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              severityFilter === 'WARNING'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Предупреждения
          </button>
          <button
            onClick={() => setSeverityFilter('INFO')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              severityFilter === 'INFO'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Инфо
          </button>
        </div>
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center">
          <BellOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Нет уведомлений
          </h3>
          <p className="text-gray-500">
            {filter === 'unread' 
              ? 'Все уведомления прочитаны' 
              : 'У вас пока нет уведомлений'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onMarkRead={markAsRead}
            />
          ))}
        </div>
      )}
    </div>
  )
}
