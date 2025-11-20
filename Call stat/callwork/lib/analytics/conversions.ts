export interface Stats {
  zoomBooked: number
  zoom1Held: number
  zoom2Held: number
  contractReview: number
  pushCount: number
  successfulDeals: number
  monthlySalesAmount: number
}

export interface Conversions {
  bookedToZoom1: number
  zoom1ToZoom2: number
  zoom2ToContract: number
  contractToPush: number
  pushToDeal: number
  overallConversion: number
  northStar: number
}

export function calculateConversions(stats: Stats): Conversions {
  const safeDiv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

  const bookedToZoom1 = safeDiv(stats.zoom1Held, stats.zoomBooked)
  const zoom1ToZoom2 = safeDiv(stats.zoom2Held, stats.zoom1Held)
  const zoom2ToContract = safeDiv(stats.contractReview, stats.zoom2Held)
  const contractToPush = safeDiv(stats.pushCount, stats.contractReview)
  const pushToDeal = safeDiv(stats.successfulDeals, stats.pushCount)

  return {
    bookedToZoom1,
    zoom1ToZoom2,
    zoom2ToContract,
    contractToPush,
    pushToDeal,
    overallConversion: safeDiv(stats.successfulDeals, stats.zoomBooked),
    northStar: safeDiv(stats.successfulDeals, stats.zoom1Held || stats.zoomBooked),
  }
}

export type DateRange = 'week' | 'month' | 'quarter' | 'year'

export function getDateRange(range: DateRange): { startDate: Date; endDate: Date } {
  const now = new Date()
  const endDate = now
  const startDate = new Date()

  switch (range) {
    case 'week':
      startDate.setDate(now.getDate() - 7)
      break
    case 'month':
      startDate.setMonth(now.getMonth() - 1)
      break
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3)
      break
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1)
      break
  }

  return { startDate, endDate }
}
