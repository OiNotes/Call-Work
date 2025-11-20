import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireManager() {
  const user = await requireAuth()
  if (user.role !== 'MANAGER') {
    throw new Error('Forbidden: Manager access required')
  }
  return user
}
