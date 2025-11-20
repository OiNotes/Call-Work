import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-session'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST() {
  try {
    const user = await requireAuth()

    // Генерация 6-значного кода
    const code = crypto.randomInt(100000, 999999).toString()
    
    // Истечение через 15 минут
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramCode: code,
        codeExpiresAt: expiresAt,
      },
    })

    return NextResponse.json({ code, expiresAt })
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
