export interface ReportState {
  step: string
  date: Date
  data: Partial<ReportData>
  lastReport?: Partial<ReportData>
}

export interface ReportData {
  zoomAppointments: number
  pzmConducted: number
  refusalsCount: number
  refusalsReasons?: string
  warmingUpCount: number
  vzmConducted: number
  contractReviewCount: number
  successfulDeals: number
  monthlySalesAmount: number
}

export type SessionState = 'awaiting_code' | ReportState
