'use client'

import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Target, DollarSign, Activity } from 'lucide-react'
import { formatMoney } from '@/lib/utils/format'

interface PulseGridProps {
    stats: {
        salesAmount: number
        planSales: number
        successfulDeals: number
        planDeals: number
        totalConversion: number
        prevConversion: number
    }
}

export function PulseGrid({ stats }: PulseGridProps) {
    const salesProgress = Math.min(100, (stats.salesAmount / stats.planSales) * 100)
    const dealsProgress = Math.min(100, (stats.successfulDeals / stats.planDeals) * 100)

    const conversionDiff = stats.totalConversion - stats.prevConversion
    const isConversionUp = conversionDiff >= 0

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Sales Plan/Fact */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6"
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm font-medium text-[var(--muted-foreground)]">Выполнение плана (₽)</p>
                        <h3 className="text-2xl font-bold text-[var(--foreground)] mt-1">
                            {formatMoney(stats.salesAmount)}
                        </h3>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>

                {/* Bullet Graph */}
                <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                        className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${salesProgress}%` }}
                    />
                    {/* Target Marker (80% for example) */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-black/20 left-[80%]" />
                </div>
                <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                    <span>Факт: {Math.round(salesProgress)}%</span>
                    <span>План: {formatMoney(stats.planSales)}</span>
                </div>
            </motion.div>

            {/* Deals Plan/Fact */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-6"
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm font-medium text-[var(--muted-foreground)]">Сделки (шт)</p>
                        <h3 className="text-2xl font-bold text-[var(--foreground)] mt-1">
                            {stats.successfulDeals}
                        </h3>
                    </div>
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                        <Target className="w-5 h-5" />
                    </div>
                </div>

                {/* Bullet Graph */}
                <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div
                        className="absolute top-0 left-0 h-full bg-purple-500 transition-all duration-500"
                        style={{ width: `${dealsProgress}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                    <span>Факт: {Math.round(dealsProgress)}%</span>
                    <span>План: {stats.planDeals}</span>
                </div>
            </motion.div>

            {/* Conversion Trend */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-6"
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm font-medium text-[var(--muted-foreground)]">Общая конверсия</p>
                        <h3 className="text-2xl font-bold text-[var(--foreground)] mt-1">
                            {stats.totalConversion}%
                        </h3>
                    </div>
                    <div className={`p-2 rounded-lg ${isConversionUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        <Activity className="w-5 h-5" />
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                    {isConversionUp ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${isConversionUp ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(conversionDiff)}% к прошлому периоду
                    </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-2">
                    Зум → Сделка
                </p>
            </motion.div>
        </div>
    )
}
