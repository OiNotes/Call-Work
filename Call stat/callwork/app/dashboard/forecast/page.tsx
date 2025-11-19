import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-session'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ForecastChart } from '@/components/analytics/ForecastChart'

async function getForecastData(userId: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  try {
    const response = await fetch(`${baseUrl}/api/analytics/forecast?userId=${userId}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        error: errorData.message || errorData.error || 'Не удалось загрузить данные прогноза'
      }
    }

    return await response.json()
  } catch (err) {
    console.error('Failed to fetch forecast:', err)
    return { error: 'Не удалось загрузить данные прогноза' }
  }
}

export default async function ForecastPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const forecastData = await getForecastData(user.id)

  return (
    <DashboardLayout>
      <div className="p-8 bg-[#F5F5F7] min-h-screen">
        {forecastData.error ? (
          <div className="bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 border border-[#FF9500]/20 rounded-[16px] p-6 shadow-[0_2px_12px_rgba(255,149,0,0.1)]">
            <h2 className="text-xl font-semibold text-[#1D1D1F] mb-2">
              Прогноз недоступен
            </h2>
            <p className="text-[#86868B]">{forecastData.error}</p>
            <p className="text-sm text-[#86868B] mt-2">
              Убедитесь, что у вас установлена месячная цель продаж
            </p>
          </div>
        ) : forecastData.forecast ? (
          <ForecastChart
            data={forecastData}
            userName={user.name || undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007AFF] mx-auto mb-4"></div>
              <p className="text-[#86868B]">Загрузка прогноза...</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
