export interface RedZone {
  severity: 'critical' | 'warning' | 'ok'
  title: string
  description: string
  current: number
  teamAverage: number
  recommendation: string
  stage: string
}

interface ConversionsWithTeam {
  pzmConversion: number
  pzToVzmConversion: number
  vzmToDealConversion: number
  teamAverage: {
    pzmConversion: number
    pzToVzmConversion: number
    vzmToDealConversion: number
  }
}

export function analyzeRedZones(conversions: ConversionsWithTeam): RedZone[] {
  const zones: RedZone[] = []
  const { teamAverage } = conversions
  
  // ПЗМ конверсия
  if (conversions.pzmConversion < 65) {
    zones.push({
      severity: conversions.pzmConversion < 50 ? 'critical' : 'warning',
      stage: 'pzm',
      title: 'Низкая явка на ПЗМ',
      description: 'Много записанных клиентов не приходят на первичную встречу',
      current: conversions.pzmConversion,
      teamAverage: teamAverage.pzmConversion,
      recommendation: 'Работать над подтверждением встреч. Звонить/писать напоминания за 2-3 часа до встречи.'
    })
  }
  
  // ПЗМ → ВЗМ
  if (conversions.pzToVzmConversion < 60) {
    zones.push({
      severity: conversions.pzToVzmConversion < 50 ? 'critical' : 'warning',
      stage: 'pz_to_vzm',
      title: 'Мало переходов ПЗМ → ВЗМ',
      description: 'Клиенты не переходят на вторичную встречу после первой',
      current: conversions.pzToVzmConversion,
      teamAverage: teamAverage.pzToVzmConversion,
      recommendation: 'Улучшить презентацию на ПЗМ. Работать над возражениями и прогревом клиента.'
    })
  }
  
  // ВЗМ → Сделка
  if (conversions.vzmToDealConversion < 70) {
    zones.push({
      severity: conversions.vzmToDealConversion < 60 ? 'critical' : 'warning',
      stage: 'vzm_to_deal',
      title: 'Проседание на закрытии',
      description: 'Клиенты доходят до ВЗМ, но сделки не закрываются',
      current: conversions.vzmToDealConversion,
      teamAverage: teamAverage.vzmToDealConversion,
      recommendation: 'Проблема в работе с возражениями на ВЗМ. Пересмотреть скрипты закрытия сделки.'
    })
  }
  
  return zones
}

export function getSeverityColor(severity: RedZone['severity']): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-50 border-red-200'
    case 'warning':
      return 'bg-yellow-50 border-yellow-200'
    case 'ok':
      return 'bg-green-50 border-green-200'
  }
}

export function getSeverityIcon(severity: RedZone['severity']): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500 text-white'
    case 'warning':
      return 'bg-yellow-500 text-white'
    case 'ok':
      return 'bg-green-500 text-white'
  }
}
