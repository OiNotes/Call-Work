'use client'

import { ManagerStats, BENCHMARKS, getHeatmapColor } from '@/lib/analytics/funnel'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { formatMoney } from '@/lib/utils/format'

interface ManagersTableProps {
    managers: ManagerStats[]
}

export function ManagersTable({ managers }: ManagersTableProps) {
    // Sort by sales amount desc by default
    const sortedManagers = [...managers].sort((a, b) => b.salesAmount - a.salesAmount)

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-separate border-spacing-y-2">
                <thead className="text-xs text-[var(--muted-foreground)] uppercase">
                    <tr>
                        <th className="px-4 py-2">Ранг</th>
                        <th className="px-4 py-2">Менеджер</th>
                        <th className="px-4 py-2">План/Факт</th>
                        <th className="px-4 py-2">Сделки</th>
                        <th className="px-4 py-2 text-center">
                            <div>Зум → ПЗМ</div>
                            <div className="text-[10px] opacity-70">Норма {BENCHMARKS.pzmConversion}%</div>
                        </th>
                        <th className="px-4 py-2 text-center">
                            <div>ПЗМ → ВЗМ</div>
                            <div className="text-[10px] opacity-70">Норма {BENCHMARKS.vzmConversion}%</div>
                        </th>
                        <th className="px-4 py-2 text-center">
                            <div>ВЗМ → Договор</div>
                            <div className="text-[10px] opacity-70">Норма {BENCHMARKS.contractConversion}%</div>
                        </th>
                        <th className="px-4 py-2 text-center">
                            <div>Договор → Сделка</div>
                            <div className="text-[10px] opacity-70">Норма {BENCHMARKS.dealConversion}%</div>
                        </th>
                        <th className="px-4 py-2 text-center">Активность</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedManagers.map((manager, index) => {
                        const planProgress = Math.min(100, (manager.salesAmount / manager.planSales) * 100)
                        const rank = index + 1

                        return (
                            <tr key={manager.id} className="bg-white/50 hover:bg-white/80 transition-colors shadow-sm rounded-lg group">
                                {/* Rank */}
                                <td className="px-4 py-3 font-bold text-[var(--foreground)] bg-gray-50/50 rounded-l-lg text-center w-12 border-r border-gray-100">
                                    {rank}
                                </td>

                                {/* Name & Trend */}
                                <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                                    <div className="flex items-center gap-2">
                                        {manager.name}
                                        {manager.trend === 'up' && <ArrowUp className="w-3 h-3 text-green-500" />}
                                        {manager.trend === 'down' && <ArrowDown className="w-3 h-3 text-red-500" />}
                                        {manager.trend === 'flat' && <Minus className="w-3 h-3 text-gray-400" />}
                                    </div>
                                </td>

                                {/* Plan/Fact (Sales) */}
                                <td className="px-4 py-3">
                                    <div className="w-32">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium">{formatMoney(manager.salesAmount)}</span>
                                            <span className="text-[var(--muted-foreground)]">{Math.round(planProgress)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${planProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                style={{ width: `${planProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>

                                {/* Deals (Data Bar) */}
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold w-6">{manager.successfulDeals}</span>
                                        {/* Simple Data Bar inside cell */}
                                        <div className="h-1.5 bg-purple-100 rounded-full flex-1 max-w-[60px]">
                                            <div
                                                className="h-full bg-purple-600 rounded-full"
                                                style={{ width: `${Math.min(100, (manager.successfulDeals / 10) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>

                                {/* Heatmap Columns */}
                                <td className={`px-4 py-3 text-center font-mono font-medium border-l border-white ${getHeatmapColor(manager.pzmConversion, BENCHMARKS.pzmConversion)}`}>
                                    {manager.pzmConversion}%
                                </td>
                                <td className={`px-4 py-3 text-center font-mono font-medium border-l border-white ${getHeatmapColor(manager.vzmConversion, BENCHMARKS.vzmConversion)}`}>
                                    {manager.vzmConversion}%
                                </td>
                                <td className={`px-4 py-3 text-center font-mono font-medium border-l border-white ${getHeatmapColor(manager.contractConversion, BENCHMARKS.contractConversion)}`}>
                                    {manager.contractConversion}%
                                </td>
                                <td className={`px-4 py-3 text-center font-mono font-medium border-l border-white ${getHeatmapColor(manager.dealConversion, BENCHMARKS.dealConversion)}`}>
                                    {manager.dealConversion}%
                                </td>

                                {/* Activity */}
                                <td className="px-4 py-3 text-center rounded-r-lg">
                                    <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${manager.activityScore >= BENCHMARKS.activityScore
                                        ? 'bg-gray-100 text-gray-700'
                                        : 'bg-red-50 text-red-600'
                                        }`}>
                                        {manager.activityScore}
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
