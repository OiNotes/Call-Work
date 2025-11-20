'use client'

import { motion } from 'framer-motion'
import { FunnelStage } from '@/lib/analytics/funnel'
import { ArrowDown } from 'lucide-react'

interface FunnelChartProps {
    data: FunnelStage[]
}

export function FunnelChart({ data }: FunnelChartProps) {
    const maxVal = Math.max(...data.map(d => d.value)) || 1

    return (
        <div className="space-y-6">
            {data.map((stage, index) => {
                const isLast = index === data.length - 1
                const dropOff = stage.dropOff || 0

                return (
                    <div key={stage.id} className="relative">
                        {/* Stage Bar */}
                        <div className="flex items-center gap-4">
                            <div className="w-32 text-sm font-medium text-[var(--muted-foreground)] text-right shrink-0">
                                {stage.label}
                            </div>

                            <div className="flex-1 h-12 bg-[var(--muted)]/30 rounded-r-lg relative group">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(stage.value / maxVal) * 100}%` }}
                                    transition={{ duration: 1, delay: index * 0.1 }}
                                    className={`h-full rounded-r-lg flex items-center px-4 transition-colors ${stage.isRedZone ? 'bg-red-500/20' : 'bg-[var(--primary)]/10'
                                        }`}
                                >
                                    <span className="font-bold text-[var(--foreground)]">
                                        {stage.value}
                                    </span>
                                </motion.div>
                            </div>

                            <div className="w-24 text-right shrink-0">
                                <div className={`text-sm font-bold ${stage.isRedZone ? 'text-red-600' : 'text-green-600'}`}>
                                    {stage.conversion}%
                                </div>
                                <div className="text-xs text-[var(--muted-foreground)]">конверсия</div>
                            </div>
                        </div>

                        {/* Drop-off Connector */}
                        {!isLast && (
                            <div className="ml-32 pl-4 py-2 flex items-center gap-2">
                                <div className="w-0.5 h-8 bg-gray-200 mx-4 relative">
                                    {dropOff > 20 && ( // Only show significant drop-offs
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-red-500 whitespace-nowrap bg-red-50 px-2 py-0.5 rounded-full">
                                            <ArrowDown className="w-3 h-3" />
                                            -{dropOff}% отвал
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
