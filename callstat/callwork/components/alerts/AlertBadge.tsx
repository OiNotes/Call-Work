'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { motion } from 'framer-motion'

export function AlertBadge() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetchUnreadCount()
    
    // Обновлять каждые 60 секунд
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  async function fetchUnreadCount() {
    try {
      const res = await fetch('/api/alerts?isRead=false')
      const data = await res.json()
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  if (unreadCount === 0) return null

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
    >
      <span className="text-xs font-bold text-white">{unreadCount}</span>
    </motion.div>
  )
}
