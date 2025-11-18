import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-session'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DashboardContent } from '@/components/dashboard/DashboardContent'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  return (
    <DashboardLayout>
      <DashboardContent user={user} />
    </DashboardLayout>
  )
}
