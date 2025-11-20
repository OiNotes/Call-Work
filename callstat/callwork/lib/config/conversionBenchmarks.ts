export type FunnelStageId =
  | 'zoomBooked'
  | 'zoom1Held'
  | 'zoom2Held'
  | 'contractReview'
  | 'push'
  | 'deal'

export interface FunnelStageMeta {
  id: FunnelStageId
  label: string
  description: string
}

export const FUNNEL_STAGES: FunnelStageMeta[] = [
  {
    id: 'zoomBooked',
    label: 'Записан на Zoom',
    description: 'Вход в воронку продаж. Лид записан на первую встречу.',
  },
  {
    id: 'zoom1Held',
    label: '1-й Zoom',
    description: 'Первая Zoom-встреча состоялась.',
  },
  {
    id: 'zoom2Held',
    label: '2-й Zoom',
    description: 'Вторая Zoom-встреча проведена.',
  },
  {
    id: 'contractReview',
    label: 'Разбор договора',
    description: 'Клиент познакомился с условиями договора.',
  },
  {
    id: 'push',
    label: 'Дожим',
    description: 'Дожимаем клиента после договора.',
  },
  {
    id: 'deal',
    label: 'Оплата',
    description: 'Успешная сделка / оплата.',
  },
]

export const CONVERSION_BENCHMARKS = {
  BOOKED_TO_ZOOM1: 60, // % записей, дошедших до первого Zoom
  ZOOM1_TO_ZOOM2: 50,
  ZOOM2_TO_CONTRACT: 40,
  CONTRACT_TO_PUSH: 60,
  PUSH_TO_DEAL: 70,
  ZOOM1_TO_DEAL_KPI: 5, // North Star KPI: 1-й Zoom → Оплата
}

export const DEFAULT_REFUSAL_BENCHMARK = 20 // базовый порог для отказов от входа на этап, % от входа
