'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'

interface Alert {
    id: string
    type: 'critical' | 'warning' | 'info'
    title: string
    description: string
    managerName?: string
}

interface RedZoneAlertsProps {
    alerts: Alert[]
}

export function RedZoneAlerts({ alerts }: RedZoneAlertsProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    if (alerts.length === 0) return null

    // 1. Group alerts by Manager
    const groupedAlerts = alerts.reduce((acc, alert) => {
        const key = alert.managerName || 'General'
        if (!acc[key]) {
            acc[key] = {
                managerName: alert.managerName,
                alerts: [],
                hasCritical: false
            }
        }

        // Deduplicate: Check if an alert with the same title already exists in this group
        const exists = acc[key].alerts.some(a => a.title === alert.title)
        if (!exists) {
            acc[key].alerts.push(alert)
            if (alert.type === 'critical') acc[key].hasCritical = true
        }

        return acc
    }, {} as Record<string, { managerName?: string; alerts: Alert[]; hasCritical: boolean }>)

    // 2. Sort groups: Critical first, then by number of alerts
    const sortedGroups = Object.values(groupedAlerts).sort((a, b) => {
        if (a.hasCritical && !b.hasCritical) return -1
        if (!a.hasCritical && b.hasCritical) return 1
        return b.alerts.length - a.alerts.length
    })

    // 3. Separate into visible and hidden
    const VISIBLE_COUNT = 3
    const visibleGroups = isExpanded ? sortedGroups : sortedGroups.slice(0, VISIBLE_COUNT)
    const hiddenCount = sortedGroups.length - VISIBLE_COUNT

    return (
        <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-8 bg-red-500 rounded-full" />
                <h2 className="text-xl font-bold text-[var(--foreground)]">Точки внимания</h2>
            </div>

            <div className="grid gap-3">
                {visibleGroups.map((group, index) => (
                    <motion.div
                        key={group.managerName || 'general'}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`
              p-4 rounded-lg border-l-4 shadow-sm
              ${group.hasCritical
                                ? 'bg-red-50 border-l-red-500'
                                : 'bg-gray-50 border-l-amber-500'}
            `}
                    >
                        <div className="flex items-start gap-4">
                            <div className="mt-0.5">
                                {group.hasCritical ? (
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className={`font-bold text-sm flex items-center gap-2 ${group.hasCritical ? 'text-red-900' : 'text-gray-900'}`}>
                                    {group.managerName ? (
                                        <span>{group.managerName}</span>
                                    ) : (
                                        <span>Общая проблема</span>
                                    )}
                                </h4>

                                <div className="mt-1 space-y-1">
                                    {group.alerts.map(alert => (
                                        <div key={alert.id} className="text-sm opacity-90 flex items-start gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0 opacity-50" />
                                            <span>
                                                <span className="font-medium">{alert.title.replace('Проблема на этапе ', '')}:</span> {alert.description}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {hiddenCount > 0 && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors bg-[var(--muted)]/20 rounded-lg hover:bg-[var(--muted)]/40"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="w-4 h-4" />
                            Свернуть
                        </>
                    ) : (
                        <>
                            <ChevronDown className="w-4 h-4" />
                            Показать еще {hiddenCount} {hiddenCount === 1 ? 'сотрудника' : 'сотрудников'}
                        </>
                    )}
                </button>
            )}
        </div>
    )
}
