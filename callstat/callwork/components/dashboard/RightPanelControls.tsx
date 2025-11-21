'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PeriodSelector, PeriodPreset } from '@/components/filters/PeriodSelector'
import { ManagerSelector } from '@/components/filters/ManagerSelector'

interface RightPanelControlsProps {
  isVisible: boolean
  selectedPreset: PeriodPreset
  range: { start: Date; end: Date }
  onPresetChange: (preset: PeriodPreset, range: { start: Date; end: Date }) => void
  managers: Array<{ id: string; name: string }>
  selectedManagerId: string
  onSelectManager: (id: string) => void
}

export function RightPanelControls({ 
  isVisible,
  selectedPreset, 
  range, 
  onPresetChange,
  managers,
  selectedManagerId,
  onSelectManager
}: RightPanelControlsProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[9999] flex flex-col gap-4 pointer-events-none">
          <motion.div
             initial={{ opacity: 0, x: 50 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: 50 }}
             transition={{ type: 'spring', stiffness: 300, damping: 30 }}
             className="flex flex-col gap-4 items-end pointer-events-auto"
          >
            {/* Reusing the exact same components with vertical orientation */}
            <div className="shadow-2xl rounded-2xl">
                <ManagerSelector
                    managers={managers}
                    selectedManagerId={selectedManagerId}
                    onSelectManager={onSelectManager}
                    title="Сотрудник"
                    orientation="vertical"
                />
            </div>

            <div className="shadow-2xl rounded-2xl">
                <PeriodSelector
                    selectedPreset={selectedPreset}
                    range={range}
                    onPresetChange={onPresetChange}
                    title="Период"
                    orientation="vertical"
                />
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
