'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Users, X, Check, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PeriodPreset } from '@/components/filters/PeriodSelector'

interface SideControlsProps {
  // Period Props
  selectedPreset: PeriodPreset
  range: { start: Date; end: Date }
  onPresetChange: (preset: PeriodPreset, range: { start: Date; end: Date }) => void
  
  // Manager Props
  managers: Array<{ id: string; name: string }>
  selectedManagerId: string
  onSelectManager: (id: string) => void
}

const toDateInputValue = (date: Date) => {
  if (!date) return ''
  return date.toISOString().split('T')[0]
}

export function SideControls({ 
  selectedPreset, 
  range, 
  onPresetChange,
  managers,
  selectedManagerId,
  onSelectManager
}: SideControlsProps) {
  const [mounted, setMounted] = useState(false)
  const [activePanel, setActivePanel] = useState<'none' | 'manager' | 'customDate'>('none')

  useEffect(() => {
    setMounted(true)
  }, [])

  // --- Logic Helpers ---

  const presets = [
    { key: 'today', label: 'День' },
    { key: 'week', label: 'Неделя' },
    { key: 'thisMonth', label: 'Месяц' },
    { key: 'lastMonth', label: 'Пред.' },
  ] as const

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
      default:
        break
    }
    onPresetChange(preset, { start, end })
    setActivePanel('none')
  }

  const handleCustomChange = (key: 'start' | 'end', value: string) => {
    if (!value) return
    const next = {
      start: key === 'start' ? new Date(value) : range.start,
      end: key === 'end' ? new Date(value) : range.end,
    }
    onPresetChange('custom', next)
  }

  // Get manager display info
  const selectedManager = managers.find(m => m.id === selectedManagerId)
  const managerInitials = selectedManager 
    ? selectedManager.name.slice(0, 2).toUpperCase() 
    : (selectedManagerId === 'all' ? 'ВС' : '??')
  
  if (!mounted) return null

  return createPortal(
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
      
      {/* Main Vertical Dock */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-2 flex flex-col gap-2 pointer-events-auto w-[64px] items-center"
      >
        {/* 1. Manager Trigger */}
        <div className="relative group w-full flex justify-center">
            <button 
                onClick={() => setActivePanel(activePanel === 'manager' ? 'none' : 'manager')}
                className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200
                    ${activePanel === 'manager' ? 'bg-gray-900 text-white ring-2 ring-gray-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                `}
            >
                {managerInitials}
            </button>
            <span className="absolute right-[120%] top-1/2 -translate-y-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {selectedManager ? selectedManager.name : 'Все менеджеры'}
            </span>
        </div>

        <div className="w-8 h-[1px] bg-gray-200/60" />

        {/* 2. Period Buttons */}
        <div className="flex flex-col gap-1 w-full items-center">
            {presets.map((item) => {
                const isActive = selectedPreset === item.key
                return (
                    <button
                        key={item.key}
                        onClick={() => handlePreset(item.key)}
                        className={`
                            w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200
                            ${isActive 
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                : 'text-gray-500 hover:bg-gray-50 hover:text-blue-600'}
                        `}
                    >
                        {item.label}
                    </button>
                )
            })}
        </div>

        <div className="w-8 h-[1px] bg-gray-200/60" />

        {/* 3. Custom Date Trigger */}
        <button
            onClick={() => setActivePanel(activePanel === 'customDate' ? 'none' : 'customDate')}
            className={`
                w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200
                ${selectedPreset === 'custom' || activePanel === 'customDate'
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-400 hover:text-blue-600 hover:bg-gray-50'}
            `}
        >
            <Calendar className="w-4 h-4" />
        </button>

      </motion.div>


      {/* --- Sliding Panels --- */}
      <AnimatePresence>
        
        {/* Manager Selection Panel */}
        {activePanel === 'manager' && (
            <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: -12, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className="pointer-events-auto absolute right-full top-0 mr-2 bg-white/95 backdrop-blur-xl border border-gray-100 shadow-2xl rounded-2xl p-2 w-[240px] max-h-[400px] flex flex-col overflow-hidden origin-top-right"
                style={{ top: '-20px' }} // Align with top of dock
            >
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 mb-1">
                    <span className="text-xs font-bold text-gray-900 uppercase">Сотрудники</span>
                    <button onClick={() => setActivePanel('none')} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
                </div>
                <div className="overflow-y-auto flex-1 p-1 space-y-0.5 custom-scrollbar">
                    <button
                        onClick={() => { onSelectManager('all'); setActivePanel('none'); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedManagerId === 'all' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-700'}`}
                    >
                        <span>Все менеджеры</span>
                        {selectedManagerId === 'all' && <Check size={14} />}
                    </button>
                    {managers.map(m => (
                        <button
                            key={m.id}
                            onClick={() => { onSelectManager(m.id); setActivePanel('none'); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selectedManagerId === m.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-700'}`}
                        >
                            <span>{m.name}</span>
                            {selectedManagerId === m.id && <Check size={14} />}
                        </button>
                    ))}
                </div>
            </motion.div>
        )}

        {/* Date Selection Panel */}
        {activePanel === 'customDate' && (
            <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: -12, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className="pointer-events-auto absolute right-full bottom-0 mr-2 bg-white/95 backdrop-blur-xl border border-gray-100 shadow-2xl rounded-2xl p-4 w-[260px] origin-bottom-right"
                style={{ bottom: '0px' }} // Align with bottom of dock
            >
                 <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-900 uppercase">Диапазон дат</span>
                    <button onClick={() => setActivePanel('none')} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 font-medium ml-1">С</label>
                        <input
                            type="date"
                            value={toDateInputValue(range.start)}
                            onChange={(e) => handleCustomChange('start', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 font-medium ml-1">По</label>
                        <input
                            type="date"
                            value={toDateInputValue(range.end)}
                            onChange={(e) => handleCustomChange('end', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                    </div>
                </div>
            </motion.div>
        )}

      </AnimatePresence>
    </div>,
    document.body
  )
}
