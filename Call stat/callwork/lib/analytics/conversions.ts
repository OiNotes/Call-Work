// Утилиты для расчёта конверсий и анализа

export interface Stats {
  zoomAppointments: number
  pzmConducted: number
  vzmConducted: number
  successfulDeals: number
  monthlySalesAmount: number
}

export interface Conversions {
  pzmConversion: number        // % проведённых ПЗМ от запланированных
  pzToVzmConversion: number    // % ВЗМ от проведённых ПЗМ
  vzmToDealConversion: number  // % сделок от ВЗМ
  overallConversion: number    // % сделок от запланированных ПЗМ
}

export function calculateConversions(stats: Stats): Conversions {
  const safe = (value: number) => value || 0
  
  const pzmConversion = stats.zoomAppointments > 0 
    ? Math.round((stats.pzmConducted / stats.zoomAppointments) * 100) 
    : 0
    
  const pzToVzmConversion = stats.pzmConducted > 0
    ? Math.round((stats.vzmConducted / stats.pzmConducted) * 100)
    : 0
    
  const vzmToDealConversion = stats.vzmConducted > 0
    ? Math.round((stats.successfulDeals / stats.vzmConducted) * 100)
    : 0
    
  const overallConversion = stats.zoomAppointments > 0
    ? Math.round((stats.successfulDeals / stats.zoomAppointments) * 100)
    : 0
  
  return {
    pzmConversion,
    pzToVzmConversion,
    vzmToDealConversion,
    overallConversion,
  }
}

export type DateRange = 'week' | 'month' | 'quarter' | 'year'

export function getDateRange(range: DateRange): { startDate: Date; endDate: Date } {
  const now = new Date()
  const endDate = now
  let startDate = new Date()
  
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
