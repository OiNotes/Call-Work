/**
 * Demo Event Handler - обработчик событий для Demo режима
 *
 * Показывает toast уведомления и запускает конфетти
 */

import { toast } from 'sonner'
import { dealConfetti, milestoneConfetti, positionChangeConfetti, miniConfetti } from './confettiEffects'
import type { DemoEvent } from './demoDataSimulator'

/**
 * Форматирует число в рублях
 */
function formatRubles(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Обрабатывает демо-событие: показывает уведомление и запускает конфетти
 */
export function handleDemoEvent(event: DemoEvent) {
  switch (event.type) {
    case 'NEW_DEAL':
      handleNewDeal(event)
      break
    case 'NEW_CALL':
      handleNewCall(event)
      break
    case 'MILESTONE':
      handleMilestone(event)
      break
    case 'POSITION_CHANGE':
      handlePositionChange(event)
      break
  }
}

/**
 * Новая сделка - toast + конфетти справа
 */
function handleNewDeal(event: DemoEvent) {
  const { employeeName, amount } = event.data

  toast.success(
    <div className="flex items-center gap-3">
      <div className="text-4xl">🎉</div>
      <div>
        <div className="font-bold text-lg">Новая сделка!</div>
        <div className="text-sm text-slate-600">
          {employeeName} • {formatRubles(amount || 0)}
        </div>
      </div>
    </div>,
    {
      duration: 4000,
      style: {
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
        border: 'none',
        color: '#1A1D21',
        padding: '16px 20px',
        fontSize: '16px',
        boxShadow: '0 10px 40px rgba(255, 165, 0, 0.3)'
      }
    }
  )

  // Запускаем конфетти
  dealConfetti()
}

/**
 * Новый звонок - мини toast + небольшое конфетти
 */
function handleNewCall(event: DemoEvent) {
  const { employeeName } = event.data

  toast(
    <div className="flex items-center gap-3">
      <div className="text-3xl">📞</div>
      <div>
        <div className="font-semibold">Новый звонок</div>
        <div className="text-sm text-slate-600">{employeeName}</div>
      </div>
    </div>,
    {
      duration: 2500,
      style: {
        background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
        border: 'none',
        color: '#FFFFFF',
        padding: '12px 16px',
        fontSize: '14px',
        boxShadow: '0 8px 30px rgba(16, 185, 129, 0.25)'
      }
    }
  )

  // Мини конфетти
  miniConfetti(0.9)
}

/**
 * Milestone достигнут - большой toast + фейерверк
 */
function handleMilestone(event: DemoEvent) {
  const { milestone, totalSales } = event.data

  toast.success(
    <div className="flex items-center gap-4">
      <div className="text-5xl">🏆</div>
      <div>
        <div className="font-bold text-xl">Milestone достигнут!</div>
        <div className="text-lg text-slate-700">
          {milestone} • Всего: {formatRubles(totalSales || 0)}
        </div>
      </div>
    </div>,
    {
      duration: 5000,
      style: {
        background: 'linear-gradient(135deg, #2997FF 0%, #007AFF 100%)',
        border: 'none',
        color: '#FFFFFF',
        padding: '20px 24px',
        fontSize: '18px',
        boxShadow: '0 15px 50px rgba(41, 151, 255, 0.4)'
      }
    }
  )

  // Фейерверк со всех сторон
  milestoneConfetti()
}

/**
 * Смена позиции в топе - toast + конфетти снизу
 */
function handlePositionChange(event: DemoEvent) {
  const { employeeName, position } = event.data

  if (!position) return

  toast(
    <div className="flex items-center gap-3">
      <div className="text-4xl">⬆️</div>
      <div>
        <div className="font-bold text-lg">Смена позиции!</div>
        <div className="text-sm text-slate-600">
          {employeeName} • #{position.from} → #{position.to}
        </div>
      </div>
    </div>,
    {
      duration: 3500,
      style: {
        background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
        border: 'none',
        color: '#FFFFFF',
        padding: '16px 20px',
        fontSize: '16px',
        boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)'
      }
    }
  )

  // Конфетти снизу
  positionChangeConfetti()
}
