'use client'

import { useMemo, useState } from 'react'
import { Loader2, Save, AlertCircle, ShieldCheck } from 'lucide-react'

type RefusalStageKey = 'zoom1Held' | 'zoom2Held' | 'contractReview' | 'push'

interface FormState {
  date: string
  zoomAppointments: number
  pzmConducted: number
  refusalsCount: number
  refusalsReasons: string
  warmingUpCount: number
  vzmConducted: number
  contractReviewCount: number
  pushCount: number
  successfulDeals: number
  monthlySalesAmount: number
  comment: string
  refusalsByStage: Record<RefusalStageKey, number>
}

const refusalStageMeta: Array<{ key: RefusalStageKey; label: string }> = [
  { key: 'zoom1Held', label: 'После 1-го Zoom' },
  { key: 'zoom2Held', label: 'После 2-го Zoom' },
  { key: 'contractReview', label: 'После договора' },
  { key: 'push', label: 'После дожима' },
]

const defaultState = (): FormState => ({
  date: new Date().toISOString().slice(0, 10),
  zoomAppointments: 0,
  pzmConducted: 0,
  refusalsCount: 0,
  refusalsReasons: '',
  warmingUpCount: 0,
  vzmConducted: 0,
  contractReviewCount: 0,
  pushCount: 0,
  successfulDeals: 0,
  monthlySalesAmount: 0,
  comment: '',
  refusalsByStage: {
    zoom1Held: 0,
    zoom2Held: 0,
    contractReview: 0,
    push: 0,
  },
})

export function ManualReportForm() {
  const [form, setForm] = useState<FormState>({
    ...defaultState(),
    // Подставляем шаблон из примера, чтобы сотрудникам было проще
    zoomAppointments: 8,
    pzmConducted: 4,
    refusalsCount: 2,
    warmingUpCount: 13,
    vzmConducted: 2,
    contractReviewCount: 1,
    successfulDeals: 0,
    monthlySalesAmount: 590000,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const northStarPreview = useMemo(() => {
    if (!form.pzmConducted) return 0
    return Math.round((form.successfulDeals / Math.max(form.pzmConducted, 1)) * 100 * 10) / 10
  }, [form.pzmConducted, form.successfulDeals])

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === 'date' || key === 'refusalsReasons' || key === 'comment' ? value : Number(value),
    }))
  }

  const updateRefusalStage = (key: RefusalStageKey, value: string) => {
    setForm((prev) => ({
      ...prev,
      refusalsByStage: {
        ...prev.refusalsByStage,
        [key]: Number(value),
      },
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const payload = {
        date: new Date(form.date).toISOString(),
        zoomAppointments: form.zoomAppointments,
        pzmConducted: form.pzmConducted,
        refusalsCount: form.refusalsCount,
        refusalsReasons: form.refusalsReasons || undefined,
        refusalsByStage: form.refusalsByStage,
        warmingUpCount: form.warmingUpCount,
        vzmConducted: form.vzmConducted,
        contractReviewCount: form.contractReviewCount,
        pushCount: form.pushCount,
        successfulDeals: form.successfulDeals,
        monthlySalesAmount: form.monthlySalesAmount,
        comment: form.comment || undefined,
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Не удалось отправить отчёт')
      }

      setMessage({ type: 'success', text: 'Отчёт сохранён. Данные попадут в дашборды сразу.' })
      setForm(defaultState())
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Не удалось сохранить отчёт',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="glass-card p-6 border border-[var(--border)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">Личный кабинет сотрудника</p>
            <h2 className="text-2xl font-bold text-[var(--foreground)] mt-1">
              Единый отчёт за день
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Заполните показатели из CRM/Excel, чтобы дашборд считал конверсии автоматически.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-[var(--muted)]/30 px-3 py-2 text-sm">
            <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
            <span>Работаем без amoCRM API</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="space-y-1">
            <label className="text-sm text-[var(--muted-foreground)]">Дата отчёта</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => updateField('date', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[var(--muted-foreground)]">Записано на Zoom</label>
            <input
              type="number"
              min={0}
              value={form.zoomAppointments}
              onChange={(e) => updateField('zoomAppointments', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[var(--muted-foreground)]">Проведено 1-х Zoom</label>
            <input
              type="number"
              min={0}
              value={form.pzmConducted}
              onChange={(e) => updateField('pzmConducted', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[var(--muted-foreground)]">Проведено 2-х Zoom</label>
            <input
              type="number"
              min={0}
              value={form.vzmConducted}
              onChange={(e) => updateField('vzmConducted', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[var(--muted-foreground)]">Разбор договора</label>
            <input
              type="number"
              min={0}
              value={form.contractReviewCount}
              onChange={(e) => updateField('contractReviewCount', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[var(--muted-foreground)]">Дожимы</label>
            <input
              type="number"
              min={0}
              value={form.pushCount}
              onChange={(e) => updateField('pushCount', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[var(--muted-foreground)]">Оплаты / сделки</label>
            <input
              type="number"
              min={0}
              value={form.successfulDeals}
              onChange={(e) => updateField('successfulDeals', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[var(--muted-foreground)]">Сумма продаж за месяц</label>
            <input
              type="number"
              min={0}
              value={form.monthlySalesAmount}
              onChange={(e) => updateField('monthlySalesAmount', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[var(--muted-foreground)]">Прогрев (теплые)</label>
            <input
              type="number"
              min={0}
              value={form.warmingUpCount}
              onChange={(e) => updateField('warmingUpCount', e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
              Отказы (итого)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                value={form.refusalsCount}
                onChange={(e) => updateField('refusalsCount', e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
                placeholder="Кол-во отказов"
              />
              <input
                type="text"
                value={form.refusalsReasons}
                onChange={(e) => updateField('refusalsReasons', e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
                placeholder="Причины (опционально)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {refusalStageMeta.map((stage) => (
                <div key={stage.key} className="space-y-1">
                  <label className="text-xs text-[var(--muted-foreground)]">{stage.label}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.refusalsByStage[stage.key]}
                    onChange={(e) => updateRefusalStage(stage.key, e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--foreground)]">Комментарий (что получилось / сложности / нужна помощь)</label>
            <textarea
              value={form.comment}
              onChange={(e) => updateField('comment', e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 bg-white"
              placeholder="Расскажите, что получилось, где нужны разборы звонков"
            />
            <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)]/20 rounded-lg p-3">
              KPI 1-й Zoom → Оплата: <span className="font-semibold text-[var(--foreground)]">{northStarPreview}%</span> (цель 5%)
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-[var(--muted-foreground)]">
            Все поля сохраняются в едином отчёте. Эти данные пойдут в воронку и таблицы менеджеров.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] text-white px-4 py-2 font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить отчёт
          </button>
        </div>
      </div>
    </form>
  )
}
