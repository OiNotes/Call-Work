'use client'

import { useState, useEffect } from 'react'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import { VirtualGong } from '@/components/leaderboard/VirtualGong'

interface LeaderboardItem {
  id: string
  name: string
  deals: number
  sales: number
  avgCheck: number
  goalProgress: number | null
  finalConversion: number
  rank: number
  medal?: 'gold' | 'silver' | 'bronze'
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([])
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [period])

  async function fetchLeaderboard() {
    setLoading(true)
    try {
      const res = await fetch(`/api/leaderboard?period=${period}`)
      const data = await res.json()
      setLeaderboard(data.leaderboard)
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <VirtualGong />

      <div className="p-8 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold mb-8">Лидерборд команды</h1>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
          </div>
        ) : (
          <LeaderboardTable
            leaderboard={leaderboard}
            period={period}
            onPeriodChange={(p) => setPeriod(p as any)}
          />
        )}
      </div>
    </>
  )
}
