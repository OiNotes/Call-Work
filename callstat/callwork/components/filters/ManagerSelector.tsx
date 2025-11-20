'use client'

import { useState, useRef, useEffect } from 'react'
import { Users, ChevronDown, Check } from 'lucide-react'

interface ManagerSelectorProps {
  managers: Array<{ id: string; name: string }>
  selectedManagerId: string
  onSelectManager: (id: string) => void
  title?: string
}

export function ManagerSelector({ managers, selectedManagerId, onSelectManager, title = 'Сотрудник' }: ManagerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedManager = managers.find(m => m.id === selectedManagerId)
  const displayName = selectedManager ? selectedManager.name : (selectedManagerId === 'all' ? 'Вся команда' : 'Выберите сотрудника')

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

  return (
    <div 
      ref={containerRef}
      className="bg-white rounded-2xl p-4 shadow-md border border-[#E5E5E7] space-y-3 w-full sm:w-[280px]"
    >
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-[#007AFF]" />
        <span className="text-sm font-semibold text-[#1D1D1F]">{title}</span>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-[#F5F5F7] hover:bg-[#E5E5E7] text-[#1D1D1F] text-sm font-medium px-3 py-2 rounded-lg transition-colors duration-200 border border-transparent focus:border-[#007AFF] outline-none"
        >
          <span className="truncate">{displayName}</span>
          <ChevronDown className={`w-4 h-4 text-[#86868B] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E5E7] rounded-lg shadow-lg z-50 max-h-[240px] overflow-y-auto py-1">
            <button
              onClick={() => {
                onSelectManager('all')
                setIsOpen(false)
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-[#F5F5F7] transition-colors"
            >
              <span className={selectedManagerId === 'all' ? 'text-[#007AFF] font-medium' : 'text-[#1D1D1F]'}>
                Вся команда
              </span>
              {selectedManagerId === 'all' && <Check className="w-4 h-4 text-[#007AFF]" />}
            </button>
            
            {managers.length > 0 && <div className="h-px bg-[#E5E5E7] my-1" />}
            
            {managers.map((manager) => (
              <button
                key={manager.id}
                onClick={() => {
                  onSelectManager(manager.id)
                  setIsOpen(false)
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-[#F5F5F7] transition-colors"
              >
                <span className={selectedManagerId === manager.id ? 'text-[#007AFF] font-medium' : 'text-[#1D1D1F]'}>
                  {manager.name}
                </span>
                {selectedManagerId === manager.id && <Check className="w-4 h-4 text-[#007AFF]" />}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <p className="text-[10px] text-[#86868B]">
        {selectedManagerId === 'all' ? 'Статистика по всему отделу' : 'Персональная статистика'}
      </p>
    </div>
  )
}
