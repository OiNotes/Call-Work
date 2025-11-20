/**
 * amoCRM client abstraction.
 *
 * NOTE: This is a placeholder ready for wiring real OAuth credentials.
 * Keep secrets in env: AMO_CLIENT_ID, AMO_CLIENT_SECRET, AMO_REDIRECT_URI, AMO_BASE_URL
 */

import type { FunnelStageId } from '@/lib/config/conversionBenchmarks'

export interface AmoDealStage {
  stage: FunnelStageId
  count: number
}

export interface AmoDealRecord {
  id: string
  managerId: string
  createdAt: string
  updatedAt: string
  stageId: FunnelStageId
  amount: number
  lost?: boolean
}

export interface DealsByPeriodParams {
  from: Date
  to: Date
  managerId?: string
}

// Placeholder implementation – replace with real amoCRM API calls once credentials are available.
export async function getDealsByPeriod(_params: DealsByPeriodParams): Promise<AmoDealRecord[]> {
  return []
}

export async function refreshAmoTokenIfNeeded(): Promise<void> {
  // TODO: implement OAuth2 refresh logic using stored tokens.
  return
}
