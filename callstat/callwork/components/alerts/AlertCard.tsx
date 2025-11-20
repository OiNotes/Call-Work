'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'

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

interface AlertCardProps {
  alert: Alert
  onMarkRead: (id: string) => void
}

export function AlertCard({ alert, onMarkRead }: AlertCardProps) {
  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          bg: 'from-red-50 to-red-100',
          border: 'border-red-500',
          icon: AlertTriangle,
          iconBg: 'bg-red-500',
          textColor: 'text-red-900'
        }
      case 'WARNING':
        return {
          bg: 'from-orange-50 to-orange-100',
          border: 'border-orange-500',
          icon: AlertCircle,
          iconBg: 'bg-orange-500',
          textColor: 'text-orange-900'
        }
      case 'INFO':
      default:
        return {
          bg: 'from-blue-50 to-blue-100',
          border: 'border-blue-500',
          icon: Info,
          iconBg: 'bg-blue-500',
          textColor: 'text-blue-900'
        }
    }
  }

  const config = getSeverityConfig(alert.severity)
  const Icon = config.icon

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} мин назад`
    if (diffHours < 24) return `${diffHours} ч назад`
    return `${diffDays} дн назад`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: alert.isRead ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`p-6 rounded-2xl border-2 ${config.border} bg-gradient-to-br ${config.bg} ${
        alert.isRead ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className={`text-lg font-semibold ${config.textColor}`}>
                {alert.title}
              </h3>
              {alert.user && (
                <p className="text-sm text-gray-600 mt-1">
                  Сотрудник: <strong>{alert.user.name}</strong>
                </p>
              )}
            </div>
            
            {!alert.isRead && (
              <button
                onClick={() => onMarkRead(alert.id)}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                aria-label="Пометить как прочитанное"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>

          <p className="text-gray-700 mb-3">{alert.description}</p>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{formatDate(alert.createdAt)}</span>
            <span className="w-1 h-1 bg-gray-400 rounded-full" />
            <span className="uppercase font-medium">{alert.type.replace('_', ' ')}</span>
            {alert.isRead && (
              <>
                <span className="w-1 h-1 bg-gray-400 rounded-full" />
                <span className="text-gray-400">Прочитано</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
