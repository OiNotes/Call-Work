import { getCurrentUser } from '@/lib/auth/get-session'
import { redirect } from 'next/navigation'

export default async function ForecastRootPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role === 'MANAGER') {
    redirect('/dashboard/forecast/department')
  } else {
    redirect('/dashboard/forecast/income')
  }
}