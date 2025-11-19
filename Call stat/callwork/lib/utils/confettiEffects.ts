/**
 * Confetti Effects - для празднования событий в TV Dashboard
 *
 * Использует canvas-confetti для создания визуальных эффектов
 */

import confetti from 'canvas-confetti'

/**
 * Конфетти для новой сделки - взрыв справа
 */
export function dealConfetti() {
  const duration = 2000
  const end = Date.now() + duration

  const colors = ['#FFD700', '#FFA500', '#FF6B00', '#FFED4E']

  ;(function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0.95, y: 0.5 },
      colors: colors,
      ticks: 200,
      gravity: 1,
      decay: 0.94,
      startVelocity: 30,
      shapes: ['circle', 'square'],
      scalar: 1.2
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  })()
}

/**
 * Конфетти для достижения milestone - фейерверк со всех сторон
 */
export function milestoneConfetti() {
  const duration = 3000
  const animationEnd = Date.now() + duration
  const defaults = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: 9999,
    colors: ['#2997FF', '#007AFF', '#5AC8FA', '#34D399', '#FFD700']
  }

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now()

    if (timeLeft <= 0) {
      return clearInterval(interval)
    }

    const particleCount = 50 * (timeLeft / duration)

    // Взрывы из разных точек
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
    })

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
    })
  }, 250)
}

/**
 * Конфетти для смены позиции - небольшой взрыв снизу
 */
export function positionChangeConfetti() {
  const colors = ['#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE']

  confetti({
    particleCount: 50,
    angle: 90,
    spread: 60,
    origin: { x: 0.5, y: 0.8 },
    colors: colors,
    ticks: 150,
    gravity: 1.2,
    decay: 0.92,
    startVelocity: 35,
    shapes: ['circle'],
    scalar: 1
  })
}

/**
 * Мини-конфетти для обычных событий (звонки и т.д.)
 */
export function miniConfetti(x: number = 0.5) {
  confetti({
    particleCount: 20,
    angle: 90,
    spread: 45,
    origin: { x, y: 0.6 },
    colors: ['#10B981', '#34D399', '#6EE7B7'],
    ticks: 100,
    gravity: 1,
    decay: 0.95,
    startVelocity: 20,
    shapes: ['circle'],
    scalar: 0.8
  })
}

/**
 * Непрерывный дождь конфетти (для экстремального wow-эффекта)
 */
export function confettiRain(durationMs: number = 5000) {
  const end = Date.now() + durationMs
  const colors = ['#FFD700', '#FF6B00', '#2997FF', '#10B981', '#F59E0B']

  ;(function frame() {
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors
    })

    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  })()
}

/**
 * Залп конфетти - мощный одиночный взрыв
 */
export function confettiBurst() {
  const count = 200
  const defaults = {
    origin: { y: 0.5, x: 0.5 },
    zIndex: 9999,
    colors: ['#FFD700', '#FFA500', '#FF6B00', '#2997FF', '#10B981']
  }

  function fire(particleRatio: number, opts: any) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    })
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55
  })

  fire(0.2, {
    spread: 60
  })

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  })

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
  })

  fire(0.1, {
    spread: 120,
    startVelocity: 45
  })
}
