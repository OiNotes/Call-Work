'use client'

import { useEffect, useState } from 'react'
import { ForecastChart } from '@/components/analytics/ForecastChart'
import { Users } from 'lucide-react'

export default function DepartmentForecastPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/forecast/department')
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <div className="animate-pulse h-96 bg-gray-100 rounded-2xl" />
  }

  if (!data) return <div>Ошибка загрузки данных</div>

  const { metrics, chartData, teamSize } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm w-fit">
            <Users className="w-4 h-4" />
            <span>Размер команды: <b>{teamSize}</b></span>
         </div>
      </div>

      <ForecastChart 
        data={{
          forecast: metrics,
          chartData: chartData
        }} 
        userName="Отдел продаж"
      />
    </div>
  )
}