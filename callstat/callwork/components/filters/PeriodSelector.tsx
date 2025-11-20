'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'

export type PeriodPreset = 'today' | 'week' | 'thisMonth' | 'lastMonth' | 'custom'

interface PeriodSelectorProps {
  selectedPreset: PeriodPreset
  range: { start: Date; end: Date }
  onPresetChange: (preset: PeriodPreset, range: { start: Date; end: Date }) => void
  title?: string
}

const toDateInputValue = (date: Date) => date.toISOString().split('T')[0]

export function PeriodSelector({ selectedPreset, range, onPresetChange, title = 'Период' }: PeriodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const presets: Array<{ key: PeriodPreset; label: string }> = useMemo(
    () => [
      { key: 'today', label: 'Сегодня' },
      { key: 'week', label: '7 дней' },
      { key: 'thisMonth', label: 'Этот месяц' },
      { key: 'lastMonth', label: 'Прошлый месяц' },
      { key: 'custom', label: 'Свой диапазон' },
    ],
    []
  )

  // Close click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handlePreset = (preset: PeriodPreset) => {
    const now = new Date()
    let start = new Date(range.start)
    let end = new Date(range.end)

    switch (preset) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        start = new Date(now)
        start.setDate(now.getDate() - 7)
        end = now
        break
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = now
        break
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        end = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'custom':
      default:
        break
    }
    onPresetChange(preset, { start, end })
    if (preset !== 'custom') {
        setIsOpen(false)
    }
  }

  const handleCustomChange = (key: 'start' | 'end', value: string) => {
    const next = {
      start: key === 'start' ? new Date(value) : range.start,
      end: key === 'end' ? new Date(value) : range.end,
    }
    onPresetChange('custom', next)
  }

  const formattedRange = `${range.start.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} - ${range.end.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
  const activeLabel = presets.find(p => p.key === selectedPreset)?.label || 'Свой диапазон'

  return (
    <div 
      ref={containerRef}
      className="bg-white rounded-2xl p-4 shadow-md border border-[#E5E5E7] space-y-3 w-full sm:w-[280px]"
    >
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-[#007AFF]" />
        <span className="text-sm font-semibold text-[#1D1D1F]">{title}</span>
      </div>

      <div className="relative">
        <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] text-sm font-medium px-3 py-2 rounded-lg transition-colors duration-200 border border-transparent focus:border-[#007AFF] outline-none"
        >
            <span className="truncate">{activeLabel}: {formattedRange}</span>
            <ChevronDown className={`w-4 h-4 text-[#86868B] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
            <div className="absolute top-full right-0 mt-2 w-[320px] bg-white border border-[#E5E5E7] rounded-xl shadow-xl z-50 p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#1D1D1F]">Выберите период</span>
                    <button onClick={() => setIsOpen(false)} className="text-[#86868B] hover:text-[#1D1D1F]">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                    {presets.map((item) => (
                    <button
                        key={item.key}
                        onClick={() => handlePreset(item.key)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-center ${
                        selectedPreset === item.key
                            ? 'bg-[#007AFF] text-white shadow-sm'
                            : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5E7]'
                        }`}
                    >
                        {item.label}
                    </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E5E5E7]">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-[#86868B]">Начало</label>
                        <input
                            type="date"
                            value={toDateInputValue(range.start)}
                            onChange={(e) => handleCustomChange('start', e.target.value)}
                            className="w-full rounded-lg border border-[#E5E5E7] bg-[#F5F5F7] px-3 py-2 text-sm focus:border-[#007AFF] focus:bg-white transition-colors outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-[#86868B]">Конец</label>
                        <input
                            type="date"
                            value={toDateInputValue(range.end)}
                            onChange={(e) => handleCustomChange('end', e.target.value)}
                            className="w-full rounded-lg border border-[#E5E5E7] bg-[#F5F5F7] px-3 py-2 text-sm focus:border-[#007AFF] focus:bg-white transition-colors outline-none"
                        />
                    </div>
                </div>
            </div>
        )}
      </div>
      
       <p className="text-[10px] text-[#86868B]">
        {range.start.toLocaleDateString('ru-RU')} — {range.end.toLocaleDateString('ru-RU')}
      </p>
    </div>
  )
}